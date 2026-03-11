import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

function toPercent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function calcAverageDurationMinutes(items: { startTime: Date; endTime: Date; status: string }[]): number {
  const valid = items.filter((item) => item.status !== 'CANCELLED');
  if (!valid.length) return 0;

  const totalMinutes = valid.reduce((acc, item) => {
    const diff = item.endTime.getTime() - item.startTime.getTime();
    return acc + Math.max(0, Math.round(diff / 60000));
  }, 0);

  return Math.round(totalMinutes / valid.length);
}

function toHourKey(date: Date): string {
  const hour = String(date.getHours()).padStart(2, '0');
  return `${hour}:00`;
}

export async function getDashboard(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthRequest;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (authReq.user?.role === 'DRIVER') {
      if (!authReq.user.driverId) {
        res.status(400).json({ error: 'Для роли DRIVER не назначен driverId' });
        return;
      }

      const [
        todayTransfersCount,
        plannedToday,
        completedToday,
        cancelledToday,
        upcomingTransfers,
        todayTransfers,
      ] = await Promise.all([
        prisma.transfer.count({
          where: {
            driverId: authReq.user.driverId,
            date: { gte: today, lt: tomorrow },
          },
        }),
        prisma.transfer.count({
          where: {
            driverId: authReq.user.driverId,
            date: { gte: today, lt: tomorrow },
            status: 'PLANNED',
          },
        }),
        prisma.transfer.count({
          where: {
            driverId: authReq.user.driverId,
            date: { gte: today, lt: tomorrow },
            status: 'COMPLETED',
          },
        }),
        prisma.transfer.count({
          where: {
            driverId: authReq.user.driverId,
            date: { gte: today, lt: tomorrow },
            status: 'CANCELLED',
          },
        }),
        prisma.transfer.findMany({
          where: {
            driverId: authReq.user.driverId,
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
        prisma.transfer.findMany({
          where: {
            driverId: authReq.user.driverId,
            date: { gte: today, lt: tomorrow },
          },
          select: {
            startTime: true,
            endTime: true,
            status: true,
          },
        }),
      ]);

      const overduePlannedCount = todayTransfers.filter(
        (item) => item.status === 'PLANNED' && item.endTime < new Date()
      ).length;

      res.json({
        todayTransfersCount,
        freeCarsCount: 0,
        busyCarsCount: 0,
        activeDriversCount: 0,
        upcomingTransfers,
        driverStats: {
          plannedToday,
          completedToday,
          cancelledToday,
        },
        topDrivers: [],
        topRoutes: [],
        hourlyLoad: [],
        kpi: {
          completionRate: toPercent(completedToday, todayTransfersCount),
          cancellationRate: toPercent(cancelledToday, todayTransfersCount),
          avgDurationMinutes: calcAverageDurationMinutes(todayTransfers),
          overduePlannedCount,
        },
      });
      return;
    }

    const [
      todayTransfersCount,
      freeCarsCount,
      busyCarsCount,
      activeDriversCount,
      upcomingTransfers,
      todayTransfers,
      completedToday,
      cancelledToday,
      plannedToday,
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
      prisma.transfer.findMany({
        where: {
          date: { gte: today, lt: tomorrow },
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          status: true,
          origin: true,
          destination: true,
          driverId: true,
          driver: { select: { id: true, fullName: true } },
        },
      }),
      prisma.transfer.count({
        where: {
          date: { gte: today, lt: tomorrow },
          status: 'COMPLETED',
        },
      }),
      prisma.transfer.count({
        where: {
          date: { gte: today, lt: tomorrow },
          status: 'CANCELLED',
        },
      }),
      prisma.transfer.count({
        where: {
          date: { gte: today, lt: tomorrow },
          status: 'PLANNED',
        },
      }),
    ]);

    const overduePlannedCount = todayTransfers.filter(
      (item) => item.status === 'PLANNED' && item.endTime < new Date()
    ).length;

    const topDriverMap = new Map<number, { id: number; fullName: string; total: number; completed: number; cancelled: number }>();
    todayTransfers.forEach((item) => {
      const existing = topDriverMap.get(item.driverId) || {
        id: item.driver.id,
        fullName: item.driver.fullName,
        total: 0,
        completed: 0,
        cancelled: 0,
      };
      existing.total += 1;
      if (item.status === 'COMPLETED') existing.completed += 1;
      if (item.status === 'CANCELLED') existing.cancelled += 1;
      topDriverMap.set(item.driverId, existing);
    });

    const topDrivers = Array.from(topDriverMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const routeMap = new Map<string, { route: string; total: number; completed: number; cancelled: number }>();
    todayTransfers.forEach((item) => {
      const key = `${item.origin} -> ${item.destination}`;
      const existing = routeMap.get(key) || {
        route: key,
        total: 0,
        completed: 0,
        cancelled: 0,
      };
      existing.total += 1;
      if (item.status === 'COMPLETED') existing.completed += 1;
      if (item.status === 'CANCELLED') existing.cancelled += 1;
      routeMap.set(key, existing);
    });

    const topRoutes = Array.from(routeMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const hourlyMap = new Map<string, { hour: string; total: number; completed: number; cancelled: number }>();
    todayTransfers.forEach((item) => {
      const key = toHourKey(item.startTime);
      const existing = hourlyMap.get(key) || { hour: key, total: 0, completed: 0, cancelled: 0 };
      existing.total += 1;
      if (item.status === 'COMPLETED') existing.completed += 1;
      if (item.status === 'CANCELLED') existing.cancelled += 1;
      hourlyMap.set(key, existing);
    });

    const hourlyLoad = Array.from(hourlyMap.values()).sort((a, b) => a.hour.localeCompare(b.hour));

    res.json({
      todayTransfersCount,
      freeCarsCount,
      busyCarsCount,
      activeDriversCount,
      upcomingTransfers,
      driverStats: {
        plannedToday,
        completedToday,
        cancelledToday,
      },
      topDrivers,
      topRoutes,
      hourlyLoad,
      kpi: {
        completionRate: toPercent(completedToday, todayTransfers.length),
        cancellationRate: toPercent(cancelledToday, todayTransfers.length),
        avgDurationMinutes: calcAverageDurationMinutes(todayTransfers),
        overduePlannedCount,
      },
    });
  } catch (error) {
    console.error('GetDashboard error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}
