import { BadRequestException, Body, Controller, Param, Post, Req } from '@nestjs/common';
import { OtpAbuseService } from './otp-abuse.service';

type RequestWithIp = { ip?: string };

@Controller('auth/otp')
export class OtpAbuseController {
  constructor(private readonly otpAbuse: OtpAbuseService) {}

  @Post('reservations')
  @Post('reservations/:id/result')
  finalize(@Param('id') id: string, @Body() body: { outcome?: string }) {
    if (!/^[0-9a-f-]{36}$/i.test(id) || (body.outcome !== 'sent' && body.outcome !== 'failed')) {
      throw new BadRequestException('A valid reservation id and outcome are required.');
    }
    return this.otpAbuse.finalize(id, body.outcome);
  }

  reserve(@Body() body: { phone?: string; installationId?: string }, @Req() request: RequestWithIp) {
    if (typeof body.phone !== 'string' || typeof body.installationId !== 'string') {
      throw new BadRequestException('phone and installationId are required.');
    }
    return this.otpAbuse.reserve({
      phone: body.phone,
      installationId: body.installationId,
      ipAddress: request.ip,
    });
  }
}
