import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { checkScheduleConflicts } from '../utils/conflict.utils';
import { TransferStatus } from '@prisma/client';

interface AuthRequest extends Request {
  user?: { id: number; role: string; driverId?: number };
}

export async function getTransfers(req: AuthRequest, res: Response): Promise<void> {
  const { driverId, carId, date, startDate, endDate, status } = req.query;

  try {
    const where: any = {};

    // Driver role can only see their own transfers
    if (req.user?.role === 'DRIVER' && req.user.driverId) {
      where.driverId = req.user.driverId;
    } else if (driverId) {
      where.driverId = Number(driverId);
    }

    if (carId) where.carId = Number(carId);
    if (status) where.status = status;

    if (date) {
      const d = new Date(date as string);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      where.date = { gte: d, lt: nextDay };
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setDate(end.getDate() + 1);
        where.date.lt = end;
      }
    }

    const transfers = await prisma.transfer.findMany({
      where,
      include: {
        driver: { select: { id: true, fullName: true, phone: true, status: true } },
        car: { select: { id: true, brand: true, model: true, plateNumber: true, status: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json(transfers);
  } catch (error) {
    console.error('GetTransfers error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function getTransfer(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const transfer = await prisma.transfer.findUnique({
      where: { id: Number(id) },
      include: {
        driver: true,
        car: true,
        history: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!transfer) {
      res.status(404).json({ error: 'Трансфер не найден' });
      return;
    }

    // Driver can only see their transfers
    if (req.user?.role === 'DRIVER' && transfer.driverId !== req.user.driverId) {
      res.status(403).json({ error: 'Нет доступа' });
      return;
    }

    res.json(transfer);
  } catch (error) {
    console.error('GetTransfer error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function createTransfer(req: AuthRequest, res: Response): Promise<void> {
  const { date, startTime, endTime, origin, destination, driverId, carId, status, comment } = req.body;

  if (!date || !startTime || !endTime || !origin || !destination || !driverId || !carId) {
    res.status(400).json({ error: 'Заполните все обязательные поля' });
    return;
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (end <= start) {
    res.status(400).json({ error: 'Время окончания должно быть позже времени начала' });
    return;
  }

  try {
    const conflict = await checkScheduleConflicts({
      startTime: start,
      endTime: end,
      driverId: Number(driverId),
      carId: Number(carId),
    });

    if (conflict.hasConflict) {
      res.status(409).json({ error: conflict.message });
      return;
    }

    const transfer = await prisma.transfer.create({
      data: {
        date: new Date(date),
        startTime: start,
        endTime: end,
        origin,
        destination,
        driverId: Number(driverId),
        carId: Number(carId),
        status: (status as TransferStatus) || TransferStatus.PLANNED,
        comment,
      },
      include: {
        driver: true,
        car: true,
      },
    });

    // Log history
    if (req.user) {
      await prisma.transferHistory.create({
        data: {
          transferId: transfer.id,
          userId: req.user.id,
          action: 'CREATE',
          description: `Трансфер создан: ${origin} → ${destination}`,
        },
      });
    }

    res.status(201).json(transfer);
  } catch (error) {
    console.error('CreateTransfer error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function updateTransfer(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { date, startTime, endTime, origin, destination, driverId, carId, status, comment } = req.body;

  try {
    const existing = await prisma.transfer.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      res.status(404).json({ error: 'Трансфер не найден' });
      return;
    }

    const start = startTime ? new Date(startTime) : existing.startTime;
    const end = endTime ? new Date(endTime) : existing.endTime;

    if (end <= start) {
      res.status(400).json({ error: 'Время окончания должно быть позже времени начала' });
      return;
    }

    // Check conflicts only if time, driver, or car changed
    const driverIdNum = driverId ? Number(driverId) : existing.driverId;
    const carIdNum = carId ? Number(carId) : existing.carId;

    const conflict = await checkScheduleConflicts({
      startTime: start,
      endTime: end,
      driverId: driverIdNum,
      carId: carIdNum,
      excludeTransferId: Number(id),
    });

    if (conflict.hasConflict) {
      res.status(409).json({ error: conflict.message });
      return;
    }

    const updated = await prisma.transfer.update({
      where: { id: Number(id) },
      data: {
        date: date ? new Date(date) : existing.date,
        startTime: start,
        endTime: end,
        origin: origin || existing.origin,
        destination: destination || existing.destination,
        driverId: driverIdNum,
        carId: carIdNum,
        status: status || existing.status,
        comment: comment !== undefined ? comment : existing.comment,
      },
      include: {
        driver: true,
        car: true,
      },
    });

    // Log history
    if (req.user) {
      await prisma.transferHistory.create({
        data: {
          transferId: updated.id,
          userId: req.user.id,
          action: 'UPDATE',
          description: `Трансфер обновлён`,
        },
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('UpdateTransfer error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function deleteTransfer(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    await prisma.transfer.delete({ where: { id: Number(id) } });
    res.json({ message: 'Трансфер удалён' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Трансфер не найден' });
      return;
    }
    console.error('DeleteTransfer error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}
