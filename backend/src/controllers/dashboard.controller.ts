import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export async function getDashboard(_req: Request, res: Response): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todayTransfersCount,
      freeCarsCount,
      busyCarsCount,
      activeDriversCount,
      upcomingTransfers,
    ] = await Promise.all([
      prisma.transfer.count({
        where: {
          date: { gte: today, lt: tomorrow },
          status: { not: 'CANCELLED' },
        },
      }),
      prisma.car.count({ where: { status: 'FREE' } }),
      prisma.car.count({ where: { status: 'BUSY' } }),
      prisma.driver.count({ where: { status: 'ACTIVE' } }),
      prisma.transfer.findMany({
        where: {
          startTime: { gte: new Date() },
          status: { not: 'CANCELLED' },
        },
        include: {
          driver: { select: { id: true, fullName: true } },
          car: { select: { id: true, brand: true, model: true, plateNumber: true } },
        },
        orderBy: { startTime: 'asc' },
        take: 5,
      }),
    ]);

    res.json({
      todayTransfersCount,
      freeCarsCount,
      busyCarsCount,
      activeDriversCount,
      upcomingTransfers,
    });
  } catch (error) {
    console.error('GetDashboard error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}
