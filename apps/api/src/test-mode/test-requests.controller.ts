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

  @Post()
  create(
    @Headers('x-test-installation-id') installationId: string,
    @Body() body: CreateTestRequestInput,
  ) {
    return this.requests.create(installationId, body);
  }

  @Get()
  list() {
    return this.requests.list();
  }

  @Delete(':id')
  cancel(
    @Headers('x-test-installation-id') installationId: string,
    @Param('id') id: string,
  ) {
    return this.requests.cancel(installationId, id);
  }
}
