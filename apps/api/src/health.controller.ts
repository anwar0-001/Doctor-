import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check(){ return { status:'ok',service:'doctor-api',timestamp:new Date().toISOString() }; }

  @Get('ready')
  async ready(){
    await this.prisma.$queryRaw`SELECT 1`;
    return { status:'ready',service:'doctor-api',timestamp:new Date().toISOString() };
  }
}
