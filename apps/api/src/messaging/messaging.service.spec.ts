import { ForbiddenException } from '@nestjs/common';
import { MessagingService } from './messaging.service';

describe('MessagingService authorization', () => {
  it('requires a real doctor-patient appointment before medical document sharing', async () => {
    const prisma:any = {
      doctorProfile:{findUnique:jest.fn().mockResolvedValue({userId:'d',status:'VERIFIED'})},
      appointment:{findFirst:jest.fn().mockResolvedValue(null)},
    };
    const storage:any = {};
    const crypto:any = {};
    const service = new MessagingService(prisma,crypto,storage);
    await expect(service.initDocument('patient',{doctorId:'d',originalName:'report.pdf',mimeType:'application/pdf',sizeBytes:100} as any))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
