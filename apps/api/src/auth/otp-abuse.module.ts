import { Module } from '@nestjs/common';
import { OtpAbuseController } from './otp-abuse.controller';
import { OtpAbuseService } from './otp-abuse.service';

@Module({
  controllers: [OtpAbuseController],
  providers: [OtpAbuseService],
})
export class OtpAbuseModule {}
