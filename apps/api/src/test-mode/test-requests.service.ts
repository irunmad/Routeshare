import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

export interface CreateTestRequestInput {
  origin: string;
  destination: string;
  departureStart: string;
  departureEnd: string;
  offeredRateUahPerKm: number;
}

@Injectable()
export class TestRequestsService {
  constructor(private readonly database: DatabaseService) {}

  private assertEnabled(): void {
    if (process.env.TEST_MODE_ENABLED !== 'true') {
      throw new ServiceUnavailableException('Shared test mode is disabled.');
    }
  }

  private validateInstallationId(value: string): string {
    const id = value?.trim();
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('A valid test installation ID is required.');
    }
    return id;
  }

  async registerProfile(profileId: string, input: { name?: string; phone?: string }) {
    this.assertEnabled();
    const profile = this.validateInstallationId(profileId);
    const name = String(input?.name ?? '').trim();
    const phone = String(input?.phone ?? '').trim();
    if (name.length < 2 || name.length > 100) throw new BadRequestException('Test profile name must be 2–100 characters.');
    if (phone.length > 30) throw new BadRequestException('Phone label is too long.');
    return this.database.withTransaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [profile]);
      const existing = await client.query('SELECT user_id FROM test_profiles WHERE profile_id = $1', [profile]);
      if (existing.rowCount) {
        await client.query('UPDATE test_profiles SET display_name = $2, phone_label = $3, updated_at = now() WHERE profile_id = $1', [profile, name, phone || null]);
        await client.query('UPDATE users SET display_name = $2, updated_at = now() WHERE id = $1', [existing.rows[0].user_id, name]);
        return { profileId: profile, userId: existing.rows[0].user_id };
      }
      const userId = randomUUID();
      // Unique synthetic number satisfies legacy users.phone_e164 NOT NULL constraint.
      // Real contact phone remains a non-verified label in test_profiles.
      const syntheticPhone = '+999' + BigInt('0x' + userId.replace(/-/g, '').slice(0, 12)).toString().padStart(15, '0');
      await client.query('INSERT INTO users (id, phone_e164, display_name) VALUES ($1, $2, $3)', [userId, syntheticPhone, name]);
      await client.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [userId, 'passenger']);
      await client.query('INSERT INTO test_profiles (profile_id, user_id, display_name, phone_label) VALUES ($1, $2, $3, $4)', [profile, userId, name, phone || null]);
      // Preserve old test requests when upgrading existing local profiles.
      await client.query('UPDATE test_passenger_requests SET user_id = $1 WHERE installation_id = $2 AND user_id IS NULL', [userId, profile]);
      return { profileId: profile, userId };
    });
  }

  async create(installationId: string, input: CreateTestRequestInput) {
    this.assertEnabled();
    const owner = this.validateInstallationId(installationId);
    const origin = String(input?.origin ?? '').trim();
    const destination = String(input?.destination ?? '').trim();
    const start = new Date(input?.departureStart);
    const end = new Date(input?.departureEnd);
    const rate = Number(input?.offeredRateUahPerKm);

    if (!origin || origin.length > 200 || !destination || destination.length > 200) {
      throw new BadRequestException('Origin and destination must contain 1–200 characters.');
    }
    if (origin.toLocaleLowerCase() === destination.toLocaleLowerCase()) {
      throw new BadRequestException('Origin and destination must be different.');
    }
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
      throw new BadRequestException('A valid departure time window is required.');
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > 10000) {
      throw new BadRequestException('Rate must be between 0 and 10,000 UAH/km.');
    }

    const id = randomUUID();
    return this.database.withTransaction(async (client) => {
      // Serialize creations from the same test installation to prevent concurrent limit bypasses.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [owner]);
      const quota = await client.query(
        `SELECT
           count(*) FILTER (WHERE status = 'searching')::int AS active,
           count(*) FILTER (WHERE created_at >= now() - interval '1 minute')::int AS recent
         FROM test_passenger_requests WHERE installation_id = $1`,
        [owner],
      );
      if (quota.rows[0].active >= 25 || quota.rows[0].recent >= 5) {
        throw new BadRequestException('Test request limit reached (25 active, 5 per minute per device).');
      }
      const identity = await client.query('SELECT user_id FROM test_profiles WHERE profile_id = $1', [owner]);
      if (!identity.rowCount) throw new BadRequestException('Register a test profile before creating requests.');
      const result = await client.query(
        `INSERT INTO test_passenger_requests
          (id, installation_id, user_id, origin_label, destination_label, departure_start, departure_end, offered_rate_minor_per_km)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, origin_label AS origin, destination_label AS destination,
           departure_start AS "departureStart", departure_end AS "departureEnd",
           offered_rate_minor_per_km / 100.0 AS "offeredRateUahPerKm",
           status, created_at AS "createdAt"`,
        [id, owner, identity.rows[0].user_id, origin, destination, start.toISOString(), end.toISOString(), Math.round(rate * 100)],
      );
      await client.query(
        `INSERT INTO test_request_events (request_id, actor_profile_id, event_type, details)
         VALUES ($1, $2, 'request.created', $3::jsonb)`,
        [id, owner, JSON.stringify({ origin, destination, offeredRateUahPerKm: rate })],
      );
      return result.rows[0];
    });
  }

  async accept(profileId: string, requestId: string) {
    this.assertEnabled();
    const actor = this.validateInstallationId(profileId);
    const id = this.validateInstallationId(requestId);
    return this.database.withTransaction(async client => {
      const identity = await client.query('SELECT user_id FROM test_profiles WHERE profile_id = $1', [actor]);
      if (!identity.rowCount) throw new BadRequestException('Register a driver test profile first.');
      const driverId = identity.rows[0].user_id;
      const result = await client.query(
        `UPDATE test_passenger_requests
         SET status = 'accepted', accepted_driver_user_id = $2, accepted_at = now()
         WHERE id = $1 AND status = 'searching' AND user_id IS DISTINCT FROM $2
         RETURNING id, status, user_id AS "passengerUserId", accepted_driver_user_id AS "driverUserId", accepted_at AS "acceptedAt"`,
        [id, driverId],
      );
      if (!result.rowCount) throw new BadRequestException('Request unavailable, already accepted, or belongs to this driver.');
      await client.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'driver') ON CONFLICT DO NOTHING", [driverId]);
      await client.query(
        `INSERT INTO test_request_events (request_id, actor_profile_id, event_type, details)
         VALUES ($1, $2, 'request.accepted', $3::jsonb)`,
        [id, actor, JSON.stringify({ driverUserId: driverId })],
      );
      return result.rows[0];
    });
  }

  async release(profileId: string, requestId: string) {
    this.assertEnabled();
    const actor = this.validateInstallationId(profileId);
    const id = this.validateInstallationId(requestId);
    return this.database.withTransaction(async client => {
      const result = await client.query(
        `UPDATE test_passenger_requests
         SET status = 'searching', accepted_driver_user_id = NULL, accepted_at = NULL
         WHERE id = $1 AND status = 'accepted'
           AND accepted_driver_user_id = (SELECT user_id FROM test_profiles WHERE profile_id = $2)
           AND accepted_at >= now() - interval '10 seconds'
         RETURNING id, status`,
        [id, actor],
      );
      if (!result.rowCount) throw new BadRequestException('Free driver cancellation window has expired or this request is not yours.');
      await client.query(
        "INSERT INTO test_request_events (request_id, actor_profile_id, event_type) VALUES ($1, $2, 'request.driver_released')",
        [id, actor],
      );
      return result.rows[0];
    });
  }

  async list(installationId: string) {
    this.assertEnabled();
    const owner = this.validateInstallationId(installationId);
    return this.database.withTransaction(async (client) => {
      const result = await client.query(
        `SELECT id, origin_label AS origin, destination_label AS destination,
          departure_start AS "departureStart", departure_end AS "departureEnd",
          offered_rate_minor_per_km / 100.0 AS "offeredRateUahPerKm",
          status, created_at AS "createdAt",
          (installation_id = $1 OR user_id = (SELECT user_id FROM test_profiles WHERE profile_id = $1)) AS "isMine",
          user_id AS "userId", accepted_driver_user_id AS "driverUserId", accepted_at AS "acceptedAt"
         FROM test_passenger_requests
         WHERE status IN ('searching','accepted')
         ORDER BY created_at DESC
         LIMIT 200`,
        [owner],
      );
      return result.rows;
    });
  }

  async cancel(installationId: string, requestId: string) {
    this.assertEnabled();
    const owner = this.validateInstallationId(installationId);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      throw new BadRequestException('A valid request ID is required.');
    }

    return this.database.withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE test_passenger_requests
         SET status = 'cancelled', cancelled_at = now()
         WHERE id = $1 AND (installation_id = $2 OR user_id = (SELECT user_id FROM test_profiles WHERE profile_id = $2))
           AND (status = 'searching' OR (status = 'accepted' AND accepted_at >= now() - interval '10 seconds'))
         RETURNING id, status`,
        [requestId, owner],
      );
      if (!result.rowCount) throw new NotFoundException('Test request not found or not owned by this device.');
      await client.query(
        `INSERT INTO test_request_events (request_id, actor_profile_id, event_type)
         VALUES ($1, $2, 'request.cancelled')`,
        [requestId, owner],
      );
      return result.rows[0];
    });
  }
}
