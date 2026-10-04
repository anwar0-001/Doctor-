import { Module } from '@nestjs/common';
import { SecurityEventsService } from './security-events.service';

@Module({
  providers: [SecurityEventsService],
  exports: [SecurityEventsService],
})
export class SecurityModule {}
