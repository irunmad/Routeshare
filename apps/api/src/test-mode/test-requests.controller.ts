import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { CreateTestRequestInput, TestRequestsService } from './test-requests.service';

@Controller('test/passenger-requests')
export class TestRequestsController {
  constructor(private readonly requests: TestRequestsService) {}

  @Post('profiles')
  registerProfile(
    @Headers('x-test-installation-id') profileId: string,
    @Body() body: { name?: string; phone?: string },
  ) {
    return this.requests.registerProfile(profileId, body);
  }

  @Post()
  create(
    @Headers('x-test-installation-id') installationId: string,
    @Body() body: CreateTestRequestInput,
  ) {
    return this.requests.create(installationId, body);
  }

  @Get()
  list(@Headers('x-test-installation-id') installationId: string) {
    return this.requests.list(installationId);
  }

  @Get('readiness')
  readiness() {
    return this.requests.readiness();
  }

  @Get('finance-journal')
  financeJournal() {
    return this.requests.financeJournal();
  }

  @Get('wallet')
  wallet(@Headers('x-test-installation-id') profileId: string) {
    return this.requests.wallet(profileId);
  }

  @Post('wallet/topup')
  topup(@Headers('x-test-installation-id') profileId: string, @Body() body: { amountUah?: number }) {
    return this.requests.topup(profileId, body);
  }

  @Post(':id/start')
  start(@Headers('x-test-installation-id') profileId: string, @Param('id') id: string) {
    return this.requests.startTrip(profileId, id);
  }

  @Post(':id/complete')
  complete(@Headers('x-test-installation-id') profileId: string, @Param('id') id: string,
    @Body() body: { fareUah?: number }) {
    return this.requests.completeTrip(profileId, id, body);
  }

  @Post(':id/accept')
  accept(
    @Headers('x-test-installation-id') profileId: string,
    @Param('id') id: string,
  ) {
    return this.requests.accept(profileId, id);
  }

  @Post(':id/release')
  release(
    @Headers('x-test-installation-id') profileId: string,
    @Param('id') id: string,
  ) {
    return this.requests.release(profileId, id);
  }

  @Delete('admin/:id')
  adminCancel(@Headers('x-test-installation-id') installationId: string, @Param('id') id: string) {
    return this.requests.adminCancel(installationId, id);
  }

  @Delete(':id')
  cancel(
    @Headers('x-test-installation-id') installationId: string,
    @Param('id') id: string,
  ) {
    return this.requests.cancel(installationId, id);
  }
}
