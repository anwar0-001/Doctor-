import { BookingService } from './booking.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BookingService availability boundaries', () => {
  const service = new BookingService({} as PrismaService);

  function makeTransaction(startLocal: string, endLocal: string) {
    return {
      doctorProfile: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) },
      availability: {
        findMany: jest.fn().mockResolvedValue([
          { timezone: 'UTC', startLocal, endLocal },
        ]),
      },
      availabilityException: { findMany: jest.fn().mockResolvedValue([]) },
    };
  }

  it('rejects an appointment that crosses the local calendar day', async () => {
    const tx = makeTransaction('22:00', '23:00');
    const available = await (service as any).withinAvailability(
      tx,
      'doctor-1',
      new Date('2030-04-02T22:30:00.000Z'),
      new Date('2030-04-03T01:00:00.000Z'),
      0,
      0,
    );

    expect(available).toBe(false);
    expect(tx.availability.findMany).not.toHaveBeenCalled();
  });

  it('accepts an appointment contained in a same-day local window', async () => {
    const tx = makeTransaction('09:00', '17:00');
    const available = await (service as any).withinAvailability(
      tx,
      'doctor-1',
      new Date('2030-04-02T10:00:00.000Z'),
      new Date('2030-04-02T10:30:00.000Z'),
      0,
      0,
    );

    expect(available).toBe(true);
    expect(tx.availabilityException.findMany).toHaveBeenCalledTimes(1);
  });
});
