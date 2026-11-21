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
  originPoint?: { lat: number; lon: number };
  destinationPoint?: { lat: number; lon: number };
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
    const validPoint = (p?: {lat:number;lon:number}) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat)<=90 && Math.abs(p.lon)<=180;
    if ((input.originPoint && !validPoint(input.originPoint)) || (input.destinationPoint && !validPoint(input.destinationPoint))) throw new BadRequestException('Invalid request coordinates.');

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
          (id, installation_id, user_id, origin_label, destination_label, departure_start, departure_end, offered_rate_minor_per_km, origin_lat, origin_lon, destination_lat, destination_lon)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, origin_label AS origin, destination_label AS destination,
           json_build_object('lat', origin_lat, 'lon', origin_lon) AS \"originPoint\",
           json_build_object('lat', destination_lat, 'lon', destination_lon) AS \"destinationPoint\",
           departure_start AS "departureStart", departure_end AS "departureEnd",
           offered_rate_minor_per_km / 100.0 AS "offeredRateUahPerKm",
           status, created_at AS "createdAt"`,
        [id, owner, identity.rows[0].user_id, origin, destination, start.toISOString(), end.toISOString(), Math.round(rate * 100), input.originPoint?.lat ?? null, input.originPoint?.lon ?? null, input.destinationPoint?.lat ?? null, input.destinationPoint?.lon ?? null],
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

  private async testUser(client: { query: (sql: string, params?: unknown[]) => Promise<any> }, profileId: string): Promise<string> {
    const identity = await client.query('SELECT user_id FROM test_profiles WHERE profile_id = $1', [this.validateInstallationId(profileId)]);
    if (!identity.rowCount) throw new BadRequestException('Register a test profile first.');
    return identity.rows[0].user_id as string;
  }

  private async postEntries(client: { query: (sql: string, params?: unknown[]) => Promise<any> },
    transactionId: string, entries: { userId: string; kind: string; delta: number }[], alreadyDebited?: { userId: string; kind: string }) {
    if (entries.reduce((sum, e) => sum + e.delta, 0) !== 0) throw new Error('Unbalanced virtual journal.');
    for (const e of entries) {
      await client.query(
        'INSERT INTO test_wallet_accounts (user_id, account_kind) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [e.userId, e.kind],
      );
      if (!(alreadyDebited && alreadyDebited.userId === e.userId && alreadyDebited.kind === e.kind)) {
        await client.query(
          'UPDATE test_wallet_accounts SET balance_minor = balance_minor + $3 WHERE user_id = $1 AND account_kind = $2',
          [e.userId, e.kind, e.delta],
        );
      }
      await client.query(
        'INSERT INTO test_wallet_entries (transaction_id, user_id, account_kind, delta_minor) VALUES ($1,$2,$3,$4)',
        [transactionId, e.userId, e.kind, e.delta],
      );
    }
  }

  async readiness() {
    this.assertEnabled();
    return this.database.withTransaction(async client => {
      const required = ['0004_test_passenger_requests', '0005_operational_observability',
        '0006_test_request_events', '0007_test_profiles', '0008_test_driver_acceptance',
        '0009_test_acceptance_grace', '0010_test_wallet_and_trip', '0011_test_request_coordinates'];
      const found = await client.query(
        'SELECT version FROM public.schema_migrations WHERE version = ANY($1::text[])',
        [required],
      );
      const applied = new Set<string>(found.rows.map((row: { version: string }) => row.version));
      const missing = required.filter(version => !applied.has(version));
      return { ready: missing.length === 0, applied: required.filter(v => applied.has(v)),
        missing, testMode: true, realPayments: false };
    });
  }

  async financeJournal() {
    this.assertEnabled();
    return this.database.withTransaction(async client => {
      // Simulator-only aggregate. No phone numbers, names or real ledger data.
      const rows = await client.query(
        `SELECT t.id, t.kind, t.request_id AS "requestId",
          t.amount_minor::text AS "amountMinor",
          t.platform_fee_minor::text AS "platformFeeMinor",
          t.created_at AS "createdAt",
          COALESCE(sum(e.delta_minor),0)::text AS "journalNetMinor",
          COALESCE(sum(e.delta_minor) FILTER (WHERE e.account_kind = 'passenger'),0)::text AS "passengerDeltaMinor",
          COALESCE(sum(e.delta_minor) FILTER (WHERE e.account_kind = 'driver'),0)::text AS "driverDeltaMinor",
          COALESCE(sum(e.delta_minor) FILTER (WHERE e.account_kind = 'platform'),0)::text AS "platformDeltaMinor",
          COALESCE(sum(e.delta_minor) FILTER (WHERE e.account_kind = 'test_source'),0)::text AS "sourceDeltaMinor",
          count(e.id)::int AS "entryCount"
         FROM test_wallet_transactions t
         LEFT JOIN test_wallet_entries e ON e.transaction_id = t.id
         GROUP BY t.id
         ORDER BY t.created_at DESC, t.id DESC
         LIMIT 100`,
      );
      const totals = await client.query(
        `SELECT account_kind AS kind, sum(balance_minor)::text AS balance
         FROM test_wallet_accounts GROUP BY account_kind ORDER BY account_kind`,
      );
      return { virtual: true, feePercent: 10, transactions: rows.rows, balances: totals.rows };
    });
  }

  async wallet(profileId: string) {
    this.assertEnabled();
    return this.database.withTransaction(async client => {
      const userId = await this.testUser(client, profileId);
      const accounts = await client.query(
        "SELECT account_kind AS kind, balance_minor::text AS balance FROM test_wallet_accounts WHERE user_id = $1",
        [userId],
      );
      const transactions = await client.query(
        `SELECT t.id, t.kind, t.request_id AS "requestId", t.amount_minor::text AS "amountMinor",
          t.platform_fee_minor::text AS "platformFeeMinor", t.created_at AS "createdAt"
         FROM test_wallet_transactions t
         WHERE t.actor_user_id = $1 OR EXISTS (
           SELECT 1 FROM test_wallet_entries e WHERE e.transaction_id = t.id AND e.user_id = $1 AND e.account_kind IN ('passenger','driver')
         )
         ORDER BY t.created_at DESC LIMIT 50`,
        [userId],
      );
      return { userId, accounts: accounts.rows, transactions: transactions.rows };
    });
  }

  async topup(profileId: string, input: { amountUah?: number }) {
    this.assertEnabled();
    const amount = Number(input?.amountUah);
    if (!Number.isFinite(amount) || amount < 1 || amount > 10000 || Math.round(amount * 100) !== amount * 100) {
      throw new BadRequestException('Virtual top-up must be 1–10000 UAH, at most two decimals.');
    }
    return this.database.withTransaction(async client => {
      const userId = await this.testUser(client, profileId);
      const minor = Math.round(amount * 100);
      const transactionId = randomUUID();
      await client.query(
        "INSERT INTO test_wallet_transactions (id, kind, actor_user_id, amount_minor) VALUES ($1,'topup',$2,$3)",
        [transactionId, userId, minor],
      );
      await this.postEntries(client, transactionId, [
        { userId, kind: 'test_source', delta: -minor },
        { userId, kind: 'passenger', delta: minor },
      ]);
      return { transactionId, amountMinor: minor, virtual: true };
    });
  }

  async startTrip(profileId: string, requestId: string) {
    this.assertEnabled();
    const id = this.validateInstallationId(requestId);
    return this.database.withTransaction(async client => {
      const driverId = await this.testUser(client, profileId);
      const result = await client.query(
        `UPDATE test_passenger_requests SET status = 'in_trip'
         WHERE id = $1 AND status = 'accepted' AND accepted_driver_user_id = $2
         RETURNING id, status`,
        [id, driverId],
      );
      if (!result.rowCount) throw new BadRequestException('Only the assigned driver can start an accepted request.');
      await client.query(
        "INSERT INTO test_request_events (request_id, actor_profile_id, event_type) VALUES ($1,$2,'request.started')",
        [id, profileId],
      );
      return result.rows[0];
    });
  }

  async completeTrip(profileId: string, requestId: string, input: { fareUah?: number }) {
    this.assertEnabled();
    const id = this.validateInstallationId(requestId);
    const fare = Number(input?.fareUah);
    if (!Number.isFinite(fare) || fare < 1 || fare > 10000 || Math.round(fare * 100) !== fare * 100) {
      throw new BadRequestException('Test fare must be 1–10000 UAH, at most two decimals.');
    }
    return this.database.withTransaction(async client => {
      const driverId = await this.testUser(client, profileId);
      const locked = await client.query(
        "SELECT user_id, accepted_driver_user_id, status FROM test_passenger_requests WHERE id = $1 FOR UPDATE",
        [id],
      );
      const ride = locked.rows[0];
      if (!ride || ride.status !== 'in_trip' || ride.accepted_driver_user_id !== driverId || !ride.user_id) {
        throw new BadRequestException('Only the assigned driver can complete an active trip once.');
      }
      const passengerId = ride.user_id as string;
      const minor = Math.round(fare * 100);
      const fee = Math.round(minor * 0.1); // Explicit test-only 10% platform fee.
      await client.query(
        "INSERT INTO test_wallet_accounts (user_id, account_kind) VALUES ($1,'passenger') ON CONFLICT DO NOTHING",
        [passengerId],
      );
      const debited = await client.query(
        "UPDATE test_wallet_accounts SET balance_minor = balance_minor - $2 WHERE user_id = $1 AND account_kind = 'passenger' AND balance_minor >= $2 RETURNING balance_minor",
        [passengerId, minor],
      );
      if (!debited.rowCount) throw new BadRequestException('Passenger virtual balance is insufficient.');
      const transactionId = randomUUID();
      await client.query(
        `INSERT INTO test_wallet_transactions (id, kind, request_id, actor_user_id, amount_minor, platform_fee_minor)
         VALUES ($1,'ride_settlement',$2,$3,$4,$5)`,
        [transactionId, id, driverId, minor, fee],
      );
      await this.postEntries(client, transactionId, [
        { userId: passengerId, kind: 'passenger', delta: -minor },
        { userId: driverId, kind: 'driver', delta: minor - fee },
        { userId: driverId, kind: 'platform', delta: fee },
      ].filter(e => e.delta !== 0), { userId: passengerId, kind: 'passenger' });
      await client.query(
        "UPDATE test_passenger_requests SET status = 'completed', completed_at = now() WHERE id = $1",
        [id],
      );
      await client.query(
        "INSERT INTO test_request_events (request_id,actor_profile_id,event_type,details) VALUES ($1,$2,'request.completed',$3::jsonb)",
        [id, profileId, JSON.stringify({ fareMinor: minor, driverNetMinor: minor - fee, platformFeeMinor: fee, transactionId })],
      );
      return { id, status: 'completed', fareMinor: minor, driverNetMinor: minor - fee, platformFeeMinor: fee, transactionId };
    });
  }

  async list(installationId: string) {
    this.assertEnabled();
    const owner = this.validateInstallationId(installationId);
    return this.database.withTransaction(async (client) => {
      const result = await client.query(
        `SELECT id, origin_label AS origin, destination_label AS destination,
          CASE WHEN origin_lat IS NOT NULL THEN json_build_object('lat', origin_lat, 'lon', origin_lon) END AS \"originPoint\",
          CASE WHEN destination_lat IS NOT NULL THEN json_build_object('lat', destination_lat, 'lon', destination_lon) END AS \"destinationPoint\",
          departure_start AS "departureStart", departure_end AS "departureEnd",
          offered_rate_minor_per_km / 100.0 AS "offeredRateUahPerKm",
          status, created_at AS "createdAt",
          (installation_id = $1 OR user_id = (SELECT user_id FROM test_profiles WHERE profile_id = $1)) AS "isMine",
          user_id AS "userId", accepted_driver_user_id AS "driverUserId", accepted_at AS "acceptedAt",
          (accepted_driver_user_id = (SELECT user_id FROM test_profiles WHERE profile_id = $1)) AS "acceptedByMe"
         FROM test_passenger_requests
         WHERE status IN ('searching','accepted','in_trip','completed')
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
