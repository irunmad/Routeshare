import { Module } from '@nestjs/common';
import { OtpAbuseModule } from './auth/otp-abuse.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { TestRequestsModule } from './test-mode/test-requests.module';

@Module({
  imports: [DatabaseModule, HealthModule, OtpAbuseModule, TestRequestsModule],
})
export class AppModule {}
