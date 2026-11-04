import { createHmac } from 'node:crypto';
import { HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type ReservationInput = { phone: string; installationId: string; ipAddress?: string };

@Injectable()
export class OtpAbuseService {
  private readonly secret = process.env.OTP_ABUSE_HMAC_SECRET ?? '';

  constructor(private readonly database: DatabaseService) {}

  async reserve(input: ReservationInput) {
    if (this.secret.length < 32) {
      throw new UnauthorizedException('OTP protection is not configured.');
    }

    const phone = input.phone.replaceAll(' ', '').replaceAll('-', '').replaceAll('(', '').replaceAll(')', '');
    const isValidUkrainianPhone =
      phone.startsWith('+380') &&
      phone.length === 13 &&
      [...phone.slice(1)].every((character) => character >= '0' && character <= '9');
    if (!isValidUkrainianPhone) {
      throw new UnauthorizedException('Only valid Ukrainian phone numbers are supported.');
    }
    if (input.installationId.length < 20 || input.installationId.length > 200) {
      throw new UnauthorizedException('A valid app installation identifier is required.');
    }

    const deviceHash = this.hash('device', input.installationId);
    const phoneHash = this.hash('phone', phone);
    const ipHash = input.ipAddress ? this.hash('ip', input.ipAddress) : null;

    const reservation = await this.database.withTransaction(async (client) => {
      const lockKeys = [deviceHash, phoneHash, ...(ipHash ? [ipHash] : [])].sort();
      for (const key of lockKeys) {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
      }

      const deviceCount = await client.query(
        `SELECT count(*)::int AS count FROM otp_request_events
         WHERE device_hash = $1 AND outcome IN ('reserved', 'sent')
           AND created_at >= now() - interval '30 days'`, [deviceHash],
      );
      const phoneCount = await client.query(
        `SELECT count(*)::int AS count FROM otp_request_events
         WHERE phone_hash = $1 AND outcome IN ('reserved', 'sent')
           AND created_at >= now() - interval '24 hours'`, [phoneHash],
      );
      const ipCount = ipHash
        ? await client.query(
            `SELECT count(*)::int AS count FROM otp_request_events
             WHERE ip_hash = $1 AND outcome IN ('reserved', 'sent')
               AND created_at >= now() - interval '10 minutes'`, [ipHash],
          )
        : { rows: [{ count: 0 }] };

      const limits = {
        deviceMonthly: Number(process.env.OTP_DEVICE_MONTHLY_LIMIT ?? 5),
        phoneDaily: Number(process.env.OTP_PHONE_DAILY_LIMIT ?? 3),
        ipTenMinutes: Number(process.env.OTP_IP_TEN_MINUTES_LIMIT ?? 10),
      };
      const counts = {
        deviceMonthly: deviceCount.rows[0].count as number,
        phoneDaily: phoneCount.rows[0].count as number,
        ipTenMinutes: ipCount.rows[0].count as number,
      };
      const exceeded = Object.entries(limits).find(([key, limit]) =>
        counts[key as keyof typeof counts] >= limit,
      );

      if (exceeded) {
        await client.query(
          `INSERT INTO otp_request_events(device_hash, phone_hash, ip_hash, outcome)
           VALUES ($1, $2, $3, 'blocked')`, [deviceHash, phoneHash, ipHash],
        );
        return { blocked: true as const };
      }

      const result = await client.query(
        `INSERT INTO otp_request_events(device_hash, phone_hash, ip_hash, outcome)
         VALUES ($1, $2, $3, 'reserved') RETURNING id, created_at`,
        [deviceHash, phoneHash, ipHash],
      );
      return {
        blocked: false as const,
        reservationId: result.rows[0].id as string,
        reservedAt: result.rows[0].created_at as Date,
        limits,
        remaining: {
          deviceMonthly: Math.max(0, limits.deviceMonthly - counts.deviceMonthly - 1),
          phoneDaily: Math.max(0, limits.phoneDaily - counts.phoneDaily - 1),
          ipTenMinutes: Math.max(0, limits.ipTenMinutes - counts.ipTenMinutes - 1),
        },
      };
    });

    if (reservation.blocked) {
      throw new HttpException({
        code: 'OTP_RATE_LIMITED',
        message: 'Too many verification requests. Try again later or contact support.',
      }, 429);
    }
    return reservation;
  }

  private hash(scope: string, value: string): string {
    return createHmac('sha256', this.secret).update(`${scope}:${value}`).digest('hex');
  }
}
