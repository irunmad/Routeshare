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
      const result = await client.query(
        `INSERT INTO test_passenger_requests
          (id, installation_id, origin_label, destination_label, departure_start, departure_end, offered_rate_minor_per_km)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, origin_label AS origin, destination_label AS destination,
           departure_start AS "departureStart", departure_end AS "departureEnd",
           offered_rate_minor_per_km / 100.0 AS "offeredRateUahPerKm",
           status, created_at AS "createdAt"`,
        [id, owner, origin, destination, start.toISOString(), end.toISOString(), Math.round(rate * 100)],
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
          (installation_id = $1) AS "isMine"
         FROM test_passenger_requests
         WHERE status = 'searching'
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
         WHERE id = $1 AND installation_id = $2 AND status = 'searching'
         RETURNING id, status`,
        [requestId, owner],
      );
      if (!result.rowCount) throw new NotFoundException('Test request not found or not owned by this device.');
      return result.rows[0];
    });
  }
}
