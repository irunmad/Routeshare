import { Module } from '@nestjs/common';
import { TestRequestsController } from './test-requests.controller';
import { TestRequestsService } from './test-requests.service';

@Module({
  controllers: [TestRequestsController],
  providers: [TestRequestsService],
})
export class TestRequestsModule {}
