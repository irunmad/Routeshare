import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async getHealth() {
    const database = await this.database.healthCheck();

    return {
      status: database === 'connected' ? 'ok' : 'degraded',
      service: 'routeshare-api',
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
