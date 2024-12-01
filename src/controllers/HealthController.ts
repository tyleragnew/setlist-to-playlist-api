import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  constructor() {}

  @Get()
  getHealth() {
    return { message: 'App is Up.' };
  }
}
