import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { checkScheduleConflicts } from '../utils/conflict.utils';
import { TransferStatus } from '@prisma/client';

interface AuthRequest extends Request {
  user?: { id: number; role: string; driverId?: number };
}

function parsePositiveInt(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

function parseValidDate(value: unknown): Date | null {
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function getTransfers(req: AuthRequest, res: Response): Promise<void> {
  const { driverId, carId, date, startDate, endDate, status } = req.query;

  try {
    const where: any = {};

    // Driver role can only see their own transfers
    if (req.user?.role === 'DRIVER') {
      if (!req.user.driverId) {
        res.status(403).json({ error: 'Для роли DRIVER не назначен driverId' });
        return;
      }
      where.driverId = req.user.driverId;
    } else if (driverId) {
      const parsedDriverId = parsePositiveInt(driverId);
      if (!parsedDriverId) {
        res.status(400).json({ error: 'Некорректный driverId' });
        return;
      }
      where.driverId = parsedDriverId;
    }

    if (carId) {
      const parsedCarId = parsePositiveInt(carId);
      if (!parsedCarId) {
        res.status(400).json({ error: 'Некорректный carId' });
        return;
      }
      where.carId = parsedCarId;
    }
    if (status) where.status = status;

    if (date) {
      const d = parseValidDate(date);
      if (!d) {
        res.status(400).json({ error: 'Некорректная дата' });
        return;
      }
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      where.date = { gte: d, lt: nextDay };
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        const parsedStartDate = parseValidDate(startDate);
        if (!parsedStartDate) {
          res.status(400).json({ error: 'Некорректный startDate' });
          return;
        }
        where.date.gte = parsedStartDate;
      }
      if (endDate) {
        const end = parseValidDate(endDate);
        if (!end) {
          res.status(400).json({ error: 'Некорректный endDate' });
          return;
        }
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
  const transferId = parsePositiveInt(id);
  if (!transferId) {
    res.status(400).json({ error: 'Некорректный ID трансфера' });
    return;
  }

  try {
    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
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

  const start = parseValidDate(startTime);
  const end = parseValidDate(endTime);
  const transferDate = parseValidDate(date);
  const parsedDriverId = parsePositiveInt(driverId);
  const parsedCarId = parsePositiveInt(carId);

  if (!start || !end || !transferDate) {
    res.status(400).json({ error: 'Некорректные значения даты/времени' });
    return;
  }

  if (!parsedDriverId || !parsedCarId) {
    res.status(400).json({ error: 'Некорректный driverId или carId' });
    return;
  }

  if (end <= start) {
    res.status(400).json({ error: 'Время окончания должно быть позже времени начала' });
    return;
  }

  try {
    const conflict = await checkScheduleConflicts({
      startTime: start,
      endTime: end,
      driverId: parsedDriverId,
      carId: parsedCarId,
    });

    if (conflict.hasConflict) {
      res.status(409).json({ error: conflict.message });
      return;
    }

    const transfer = await prisma.transfer.create({
      data: {
        date: transferDate,
        startTime: start,
        endTime: end,
        origin,
        destination,
        driverId: parsedDriverId,
        carId: parsedCarId,
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
  const transferId = parsePositiveInt(id);

  if (!transferId) {
    res.status(400).json({ error: 'Некорректный ID трансфера' });
    return;
  }

  try {
    const existing = await prisma.transfer.findUnique({ where: { id: transferId } });
    if (!existing) {
      res.status(404).json({ error: 'Трансфер не найден' });
      return;
    }

    const parsedStartTime = startTime !== undefined ? parseValidDate(startTime) : existing.startTime;
    const parsedEndTime = endTime !== undefined ? parseValidDate(endTime) : existing.endTime;
    const parsedDate = date !== undefined ? parseValidDate(date) : existing.date;

    if (!parsedStartTime || !parsedEndTime) {
      res.status(400).json({ error: 'Некорректные значения времени' });
      return;
    }

    if (!parsedDate) {
      res.status(400).json({ error: 'Некорректная дата' });
      return;
    }

    const start = parsedStartTime;
    const end = parsedEndTime;

    if (end <= start) {
      res.status(400).json({ error: 'Время окончания должно быть позже времени начала' });
      return;
    }

    // Check conflicts only if time, driver, or car changed
    const parsedDriverId = driverId !== undefined ? parsePositiveInt(driverId) : existing.driverId;
    const parsedCarId = carId !== undefined ? parsePositiveInt(carId) : existing.carId;

    if (!parsedDriverId || !parsedCarId) {
      res.status(400).json({ error: 'Некорректный driverId или carId' });
      return;
    }

    const driverIdNum = parsedDriverId;
    const carIdNum = parsedCarId;

    const conflict = await checkScheduleConflicts({
      startTime: start,
      endTime: end,
      driverId: driverIdNum,
      carId: carIdNum,
      excludeTransferId: transferId,
    });

    if (conflict.hasConflict) {
      res.status(409).json({ error: conflict.message });
      return;
    }

    const updated = await prisma.transfer.update({
      where: { id: transferId },
      data: {
        date: parsedDate,
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
  const transferId = parsePositiveInt(id);
  if (!transferId) {
    res.status(400).json({ error: 'Некорректный ID трансфера' });
    return;
  }
  try {
    await prisma.transfer.delete({ where: { id: transferId } });
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

export async function updateMyTransferStatus(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { status } = req.body as { status?: TransferStatus };
  const transferId = parsePositiveInt(id);

  if (!transferId) {
    res.status(400).json({ error: 'Некорректный ID трансфера' });
    return;
  }

  if (!req.user || req.user.role !== 'DRIVER' || !req.user.driverId) {
    res.status(403).json({ error: 'Недостаточно прав доступа' });
    return;
  }

  if (status !== TransferStatus.COMPLETED && status !== TransferStatus.CANCELLED) {
    res.status(400).json({ error: 'Водитель может установить только статусы COMPLETED или CANCELLED' });
    return;
  }

  try {
    const transfer = await prisma.transfer.findUnique({ where: { id: transferId } });
    if (!transfer) {
      res.status(404).json({ error: 'Трансфер не найден' });
      return;
    }

    if (transfer.driverId !== req.user.driverId) {
      res.status(403).json({ error: 'Можно изменять только свои трансферы' });
      return;
    }

    if (transfer.status !== TransferStatus.PLANNED) {
      res.status(400).json({ error: 'Изменение доступно только для запланированных трансферов' });
      return;
    }

    const updated = await prisma.transfer.update({
      where: { id: transfer.id },
      data: { status },
      include: {
        driver: true,
        car: true,
      },
    });

    await prisma.transferHistory.create({
      data: {
        transferId: updated.id,
        userId: req.user.id,
        action: 'STATUS_UPDATE',
        description: `Водитель изменил статус на ${status}`,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('UpdateMyTransferStatus error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function getRecentTransferHistory(req: AuthRequest, res: Response): Promise<void> {
  const { date, limit, userId, action, transferId } = req.query;

  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'DISPATCHER')) {
    res.status(403).json({ error: 'Недостаточно прав доступа' });
    return;
  }

  try {
    const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

    let startDate: Date;
    let endDate: Date;

    if (date) {
      const parsedHistoryDate = parseValidDate(date);
      if (!parsedHistoryDate) {
        res.status(400).json({ error: 'Некорректная дата' });
        return;
      }
      startDate = parsedHistoryDate;
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    } else {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    }

    const where: any = {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    };

    if (userId) {
      const parsedUserId = parsePositiveInt(userId);
      if (!parsedUserId) {
        res.status(400).json({ error: 'Некорректный userId' });
        return;
      }
      where.userId = parsedUserId;
    }
    if (action) where.action = String(action);
    if (transferId) {
      const parsedTransferId = parsePositiveInt(transferId);
      if (!parsedTransferId) {
        res.status(400).json({ error: 'Некорректный transferId' });
        return;
      }
      where.transferId = parsedTransferId;
    }

    const history = await prisma.transferHistory.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        transfer: {
          select: {
            id: true,
            origin: true,
            destination: true,
            startTime: true,
            endTime: true,
            status: true,
            driver: { select: { id: true, fullName: true } },
            car: { select: { id: true, brand: true, model: true, plateNumber: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parsedLimit,
    });

    res.json(history);
  } catch (error) {
    console.error('GetRecentTransferHistory error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}
