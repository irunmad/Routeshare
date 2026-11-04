import { Module } from '@nestjs/common';
import { OtpAbuseModule } from './auth/otp-abuse.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [DatabaseModule, HealthModule, OtpAbuseModule],
})
export class AppModule {}
