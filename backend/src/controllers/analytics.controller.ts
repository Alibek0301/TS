import { Request, Response } from 'express';
import prisma from '../utils/prisma';

type AnalyticsTransfer = {
  id: number;
  status: string;
  startTime: Date;
  endTime: Date;
  origin: string;
  destination: string;
  clientName: string | null;
  clientPhone: string | null;
  driverId: number;
  carId: number;
  createdAt: Date;
  driver?: { id: number; fullName: string };
  car?: { id: number; brand: string; model: string; plateNumber: string };
};

type AnalyticsMaintenance = {
  id: number;
  carId: number;
  cost: number | null;
  performedAt: Date;
};

function parsePositiveInt(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

function calcMetrics(items: AnalyticsTransfer[]) {
  const totalOrders = items.length;
  const completed = items.filter((item) => item.status === 'COMPLETED').length;
  const cancelled = items.filter((item) => item.status === 'CANCELLED').length;
  const planned = items.filter((item) => item.status === 'PLANNED').length;

  const avgDurationMinutes = totalOrders
    ? Math.round(items.reduce((acc, item) => acc + Math.max(0, Math.round((item.endTime.getTime() - item.startTime.getTime()) / 60000)), 0) / totalOrders)
    : 0;

  const uniqueClients = new Set(items.map((item) => item.clientName).filter(Boolean)).size;
  const uniqueRoutes = new Set(items.map((item) => `${item.origin} -> ${item.destination}`)).size;

  const topRoutesMap = new Map<string, number>();
  items.forEach((item) => {
    const key = `${item.origin} -> ${item.destination}`;
    topRoutesMap.set(key, (topRoutesMap.get(key) || 0) + 1);
  });

  const topRoutes = Array.from(topRoutesMap.entries())
    .map(([route, total]) => ({ route, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    totalOrders,
    completed,
    cancelled,
    planned,
    avgDurationMinutes,
    uniqueClients,
    uniqueRoutes,
    topRoutes,
  };
}

export async function getClients(req: Request, res: Response): Promise<void> {
  try {
    const rows = await (prisma.transfer as any).findMany({
      where: {
        clientName: {
          not: null,
        },
      },
      select: {
        clientName: true,
      },
    }) as Array<{ clientName: string | null }>;

    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const name = (row.clientName || '').trim();
      if (!name) return;
      counts.set(name, (counts.get(name) || 0) + 1);
    });

    const clients = Array.from(counts.entries())
      .map(([name, orders]) => ({ name, orders }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json(clients);
  } catch (error) {
    console.error('GetClients error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function getDriverAnalytics(req: Request, res: Response): Promise<void> {
  const driverId = parsePositiveInt(req.params.id);
  if (!driverId) {
    res.status(400).json({ error: 'Некорректный ID водителя' });
    return;
  }

  try {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, fullName: true, phone: true, status: true },
    });

    if (!driver) {
      res.status(404).json({ error: 'Водитель не найден' });
      return;
    }

    const transfers = await (prisma.transfer as any).findMany({
      where: { driverId },
      include: {
        car: { select: { id: true, brand: true, model: true, plateNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    }) as AnalyticsTransfer[];

    const metrics = calcMetrics(transfers);
    const uniqueCars = new Set(transfers.map((item) => item.carId)).size;

    const clientsMap = new Map<string, number>();
    transfers.forEach((item: AnalyticsTransfer) => {
      const client = (item.clientName || '').trim();
      if (!client) return;
      clientsMap.set(client, (clientsMap.get(client) || 0) + 1);
    });

    const topClients = Array.from(clientsMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    res.json({
      entity: driver,
      metrics: {
        ...metrics,
        uniqueCars,
      },
      topClients,
      recentOrders: transfers.slice(0, 10),
    });
  } catch (error) {
    console.error('GetDriverAnalytics error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function getCarAnalytics(req: Request, res: Response): Promise<void> {
  const carId = parsePositiveInt(req.params.id);
  if (!carId) {
    res.status(400).json({ error: 'Некорректный ID автомобиля' });
    return;
  }

  try {
    const car = await (prisma.car as any).findUnique({
      where: { id: carId },
      select: {
        id: true,
        brand: true,
        model: true,
        plateNumber: true,
        status: true,
        mileage: true,
        nextServiceMileage: true,
      },
    }) as {
      id: number;
      brand: string;
      model: string;
      plateNumber: string;
      status: string;
      mileage: number;
      nextServiceMileage: number | null;
    } | null;

    if (!car) {
      res.status(404).json({ error: 'Автомобиль не найден' });
      return;
    }

    const [transfers, maintenance] = await Promise.all([
      (prisma.transfer as any).findMany({
        where: { carId },
        include: {
          driver: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }) as Promise<AnalyticsTransfer[]>,
      (prisma as any).carMaintenance.findMany({
        where: { carId },
        orderBy: { performedAt: 'desc' },
      }) as Promise<AnalyticsMaintenance[]>,
    ]);

    const metrics = calcMetrics(transfers);
    const uniqueDrivers = new Set(transfers.map((item: AnalyticsTransfer) => item.driverId)).size;
    const maintenanceCostTotal = maintenance.reduce((sum: number, item: AnalyticsMaintenance) => sum + (item.cost || 0), 0);

    const driversMap = new Map<string, number>();
    transfers.forEach((item: AnalyticsTransfer) => {
      const name = item.driver?.fullName || `ID ${item.driverId}`;
      driversMap.set(name, (driversMap.get(name) || 0) + 1);
    });

    const topDrivers = Array.from(driversMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    res.json({
      entity: car,
      metrics: {
        ...metrics,
        uniqueDrivers,
        maintenanceRecords: maintenance.length,
        maintenanceCostTotal: Math.round(maintenanceCostTotal),
      },
      topDrivers,
      recentOrders: transfers.slice(0, 10),
      recentMaintenance: maintenance.slice(0, 10),
    });
  } catch (error) {
    console.error('GetCarAnalytics error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function getClientAnalytics(req: Request, res: Response): Promise<void> {
  const clientName = decodeURIComponent(String(req.params.name || '')).trim();
  if (!clientName) {
    res.status(400).json({ error: 'Некорректное имя клиента' });
    return;
  }

  try {
    const transfers = await (prisma.transfer as any).findMany({
      where: {
        clientName: {
          equals: clientName,
          mode: 'insensitive',
        },
      },
      include: {
        driver: { select: { id: true, fullName: true } },
        car: { select: { id: true, brand: true, model: true, plateNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    }) as AnalyticsTransfer[];

    if (!transfers.length) {
      res.status(404).json({ error: 'Клиент не найден' });
      return;
    }

    const metrics = calcMetrics(transfers);
    const uniqueDrivers = new Set(transfers.map((item: AnalyticsTransfer) => item.driverId)).size;
    const uniqueCars = new Set(transfers.map((item: AnalyticsTransfer) => item.carId)).size;

    const topDriversMap = new Map<string, number>();
    const topCarsMap = new Map<string, number>();

    let clientPhone: string | null = null;
    transfers.forEach((item: AnalyticsTransfer) => {
      const driverName = item.driver?.fullName || `ID ${item.driverId}`;
      topDriversMap.set(driverName, (topDriversMap.get(driverName) || 0) + 1);

      const carName = `${item.car?.brand || ''} ${item.car?.model || ''} (${item.car?.plateNumber || ''})`.trim();
      topCarsMap.set(carName, (topCarsMap.get(carName) || 0) + 1);

      if (!clientPhone && item.clientPhone) {
        clientPhone = item.clientPhone;
      }
    });

    const topDrivers = Array.from(topDriversMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const topCars = Array.from(topCarsMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    res.json({
      entity: {
        name: clientName,
        phone: clientPhone,
      },
      metrics: {
        ...metrics,
        uniqueDrivers,
        uniqueCars,
      },
      topDrivers,
      topCars,
      recentOrders: transfers.slice(0, 10),
    });
  } catch (error) {
    console.error('GetClientAnalytics error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}
