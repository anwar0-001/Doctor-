import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventSeverity, SecurityEventType } from '@prisma/client';

export interface SecurityEventContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger(SecurityEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    type: SecurityEventType,
    context: SecurityEventContext = {},
    severity: SecurityEventSeverity = SecurityEventSeverity.WARNING,
  ): Promise<void> {
    try {
      await this.prisma.securityEvent.create({
        data: {
          type,
          severity,
          userId: context.userId,
          ipAddress: context.ipAddress?.slice(0, 64),
          userAgent: context.userAgent?.slice(0, 512),
          requestId: context.requestId?.slice(0, 128),
          metadata: context.metadata,
        },
      });
    } catch (error) {
      this.logger.error(
        'Failed to persist security event',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
