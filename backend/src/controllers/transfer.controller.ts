import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { checkScheduleConflicts } from '../utils/conflict.utils';
import { TransferStatus } from '@prisma/client';
import { ensureWaybillForTransfer } from '../utils/waybill.utils';

interface AuthRequest extends Request {
  user?: { id: number; role: string; driverId?: number };
}

interface PresetStatePayload {
  filters: Record<string, unknown>;
  search: string;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  pageSize: number;
  viewMode: 'table' | 'calendar';
  quickPreset: string;
}

type RecurrencePattern = 'DAILY' | 'WEEKLY';

interface RecurrencePayload {
  pattern: RecurrencePattern;
  interval?: number;
  count?: number;
  untilDate?: string;
  weekdays?: number[];
}

const MAX_PRESETS_PER_USER = 30;

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

function combineDateAndTime(date: Date, timeSource: Date): Date {
  const dt = new Date(date);
  dt.setHours(
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds()
  );
  return dt;
}

function getOccurrenceDates(baseDate: Date, recurrence: RecurrencePayload): Date[] {
  const interval = Math.max(1, Number(recurrence.interval) || 1);
  const maxCount = Math.min(Math.max(Number(recurrence.count) || 0, 0), 100);
  const until = recurrence.untilDate ? parseValidDate(recurrence.untilDate) : null;

  const result: Date[] = [];

  if (!maxCount && !until) {
    return [];
  }

  const shouldContinue = (currentDate: Date): boolean => {
    if (result.length >= 100) return false;
    if (maxCount && result.length >= maxCount) return false;
    if (until) {
      const current = new Date(currentDate);
      current.setHours(0, 0, 0, 0);
      const untilLocal = new Date(until);
      untilLocal.setHours(0, 0, 0, 0);
      if (current > untilLocal) return false;
    }
    return true;
  };

  if (recurrence.pattern === 'DAILY') {
    const current = new Date(baseDate);
    while (shouldContinue(current)) {
      result.push(new Date(current));
      current.setDate(current.getDate() + interval);
    }
    return result;
  }

  const weekdays = Array.isArray(recurrence.weekdays) && recurrence.weekdays.length
    ? Array.from(new Set(recurrence.weekdays.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6))).sort((a, b) => a - b)
    : [baseDate.getDay()];

  const startWeek = new Date(baseDate);
  startWeek.setHours(0, 0, 0, 0);
  startWeek.setDate(startWeek.getDate() - startWeek.getDay());

  let weekOffset = 0;
  while (result.length < 100) {
    const weekStart = new Date(startWeek);
    weekStart.setDate(weekStart.getDate() + weekOffset * 7);

    for (const weekday of weekdays) {
      const candidate = new Date(weekStart);
      candidate.setDate(candidate.getDate() + weekday);
      if (candidate < baseDate) continue;

      if (!shouldContinue(candidate)) {
        return result;
      }

      result.push(candidate);
      if (!shouldContinue(candidate)) {
        return result;
      }
    }

    weekOffset += interval;
    if (until) {
      const nextWeekStart = new Date(startWeek);
      nextWeekStart.setDate(nextWeekStart.getDate() + weekOffset * 7);
      if (nextWeekStart > until && !maxCount) {
        break;
      }
    }
  }

  return result;
}

export async function getTransfers(req: AuthRequest, res: Response): Promise<void> {
  const {
    driverId,
    carId,
    date,
    startDate,
    endDate,
    status,
    origin,
    destination,
    clientName,
    clientPhone,
    commentMode,
    minDuration,
    maxDuration,
    overdueOnly,
  } = req.query;

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

    if (origin) {
      where.origin = {
        contains: String(origin),
        mode: 'insensitive',
      };
    }

    if (destination) {
      where.destination = {
        contains: String(destination),
        mode: 'insensitive',
      };
    }

    if (clientName) {
      where.clientName = {
        contains: String(clientName),
        mode: 'insensitive',
      };
    }

    if (commentMode === 'WITH_COMMENT') {
      where.comment = {
        not: null,
      };
    }

    if (commentMode === 'WITHOUT_COMMENT') {
      where.OR = [{ comment: null }, { comment: '' }];
    }

    if (overdueOnly === 'true') {
      where.status = TransferStatus.PLANNED;
      where.endTime = { lt: new Date() };
    }

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

    let transfers = await prisma.transfer.findMany({
      where,
      include: {
        driver: { select: { id: true, fullName: true, phone: true, status: true } },
        car: { select: { id: true, brand: true, model: true, plateNumber: true, status: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    const parsedMinDuration = minDuration !== undefined && minDuration !== '' ? Number(minDuration) : null;
    const parsedMaxDuration = maxDuration !== undefined && maxDuration !== '' ? Number(maxDuration) : null;

    if (parsedMinDuration !== null && (!Number.isFinite(parsedMinDuration) || parsedMinDuration < 0)) {
      res.status(400).json({ error: 'Некорректный minDuration' });
      return;
    }

    if (parsedMaxDuration !== null && (!Number.isFinite(parsedMaxDuration) || parsedMaxDuration < 0)) {
      res.status(400).json({ error: 'Некорректный maxDuration' });
      return;
    }

    if (parsedMinDuration !== null || parsedMaxDuration !== null) {
      transfers = transfers.filter((item) => {
        const durationMinutes = Math.max(0, Math.round((item.endTime.getTime() - item.startTime.getTime()) / 60000));

        const byMin = parsedMinDuration === null || durationMinutes >= parsedMinDuration;
        const byMax = parsedMaxDuration === null || durationMinutes <= parsedMaxDuration;

        return byMin && byMax;
      });
    }

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
  const { date, startTime, endTime, origin, destination, clientName, clientPhone, driverId, carId, status, comment } = req.body;

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
        clientName: clientName ? String(clientName).trim() : null,
        clientPhone: clientPhone ? String(clientPhone).trim() : null,
        driverId: parsedDriverId,
        carId: parsedCarId,
        status: (status as TransferStatus) || TransferStatus.PLANNED,
        comment,
      },
      include: {
        driver: { select: { fullName: true } },
        car: { select: { brand: true, model: true, plateNumber: true } },
      },
    });

    await ensureWaybillForTransfer({
      transfer,
      createdById: req.user?.id,
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

export async function createRecurringTransfers(req: AuthRequest, res: Response): Promise<void> {
  const {
    date,
    startTime,
    endTime,
    origin,
    destination,
    clientName,
    clientPhone,
    driverId,
    carId,
    status,
    comment,
    recurrence,
  } = req.body as {
    date?: string;
    startTime?: string;
    endTime?: string;
    origin?: string;
    destination?: string;
    clientName?: string;
    clientPhone?: string;
    driverId?: number;
    carId?: number;
    status?: TransferStatus;
    comment?: string;
    recurrence?: RecurrencePayload;
  };

  if (!date || !startTime || !endTime || !origin || !destination || !driverId || !carId) {
    res.status(400).json({ error: 'Заполните все обязательные поля' });
    return;
  }

  if (!recurrence || (recurrence.pattern !== 'DAILY' && recurrence.pattern !== 'WEEKLY')) {
    res.status(400).json({ error: 'Некорректные настройки повторения' });
    return;
  }

  const baseDate = parseValidDate(date);
  const templateStart = parseValidDate(startTime);
  const templateEnd = parseValidDate(endTime);
  const parsedDriverId = parsePositiveInt(driverId);
  const parsedCarId = parsePositiveInt(carId);

  if (!baseDate || !templateStart || !templateEnd) {
    res.status(400).json({ error: 'Некорректные значения даты/времени' });
    return;
  }

  if (!parsedDriverId || !parsedCarId) {
    res.status(400).json({ error: 'Некорректный driverId или carId' });
    return;
  }

  const durationMs = templateEnd.getTime() - templateStart.getTime();
  if (durationMs <= 0) {
    res.status(400).json({ error: 'Время окончания должно быть позже времени начала' });
    return;
  }

  if (durationMs > 24 * 60 * 60 * 1000) {
    res.status(400).json({ error: 'Длительность трансфера не должна превышать 24 часа' });
    return;
  }

  const occurrences = getOccurrenceDates(baseDate, recurrence);
  if (!occurrences.length) {
    res.status(400).json({ error: 'Не удалось сгенерировать даты повторений. Укажите количество или дату окончания.' });
    return;
  }

  try {
    const createdTransfers: Array<{ id: number; date: string; startTime: string; endTime: string }> = [];
    const skipped: Array<{ date: string; reason: string }> = [];

    for (const occurrenceDate of occurrences) {
      const start = combineDateAndTime(occurrenceDate, templateStart);
      const end = new Date(start.getTime() + durationMs);

      const conflict = await checkScheduleConflicts({
        startTime: start,
        endTime: end,
        driverId: parsedDriverId,
        carId: parsedCarId,
      });

      if (conflict.hasConflict) {
        skipped.push({
          date: occurrenceDate.toISOString(),
          reason: conflict.message || 'Конфликт расписания',
        });
        continue;
      }

      const transfer = await prisma.transfer.create({
        data: {
          date: occurrenceDate,
          startTime: start,
          endTime: end,
          origin: String(origin).trim(),
          destination: String(destination).trim(),
          clientName: clientName ? String(clientName).trim() : null,
          clientPhone: clientPhone ? String(clientPhone).trim() : null,
          driverId: parsedDriverId,
          carId: parsedCarId,
          status: status || TransferStatus.PLANNED,
          comment: comment ? String(comment).trim() : null,
        },
        include: {
          driver: { select: { fullName: true } },
          car: { select: { brand: true, model: true, plateNumber: true } },
        },
      });

      await ensureWaybillForTransfer({
        transfer,
        createdById: req.user?.id,
      });

      if (req.user) {
        await prisma.transferHistory.create({
          data: {
            transferId: transfer.id,
            userId: req.user.id,
            action: 'CREATE_RECURRING',
            description: `Регулярный трансфер создан: ${origin} → ${destination}`,
          },
        });
      }

      createdTransfers.push({
        id: transfer.id,
        date: transfer.date.toISOString(),
        startTime: transfer.startTime.toISOString(),
        endTime: transfer.endTime.toISOString(),
      });
    }

    res.status(201).json({
      totalRequested: occurrences.length,
      createdCount: createdTransfers.length,
      skippedCount: skipped.length,
      createdTransfers,
      skipped,
    });
  } catch (error) {
    console.error('CreateRecurringTransfers error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function updateTransfer(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { date, startTime, endTime, origin, destination, clientName, clientPhone, driverId, carId, status, comment } = req.body;
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
        clientName: clientName !== undefined ? (clientName ? String(clientName).trim() : null) : existing.clientName,
        clientPhone: clientPhone !== undefined ? (clientPhone ? String(clientPhone).trim() : null) : existing.clientPhone,
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

export async function getTransferFilterPresets(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }

  try {
    const sortBy = req.query.sortBy === 'name' ? 'name' : 'updatedAt';
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';

    const orderBy = sortBy === 'name'
      ? [{ isDefault: 'desc' as const }, { name: sortDir as 'asc' | 'desc' }]
      : [{ isDefault: 'desc' as const }, { updatedAt: sortDir as 'asc' | 'desc' }];

    const presets = await prisma.transferFilterPreset.findMany({
      where: { userId: req.user.id },
      orderBy,
    });

    res.json(presets);
  } catch (error) {
    console.error('GetTransferFilterPresets error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function saveTransferFilterPreset(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }

  const { name, state, isDefault } = req.body as {
    name?: string;
    state?: PresetStatePayload;
    isDefault?: boolean;
  };

  const normalizedName = String(name || '').trim();
  if (!normalizedName) {
    res.status(400).json({ error: 'Название набора обязательно' });
    return;
  }

  if (normalizedName.length > 50) {
    res.status(400).json({ error: 'Название набора должно быть не длиннее 50 символов' });
    return;
  }

  if (!state || typeof state !== 'object') {
    res.status(400).json({ error: 'Некорректное состояние фильтра' });
    return;
  }

  try {
    const existingByName = await prisma.transferFilterPreset.findUnique({
      where: {
        userId_name: {
          userId: req.user.id,
          name: normalizedName,
        },
      },
      select: { id: true },
    });

    if (!existingByName) {
      const presetCount = await prisma.transferFilterPreset.count({
        where: { userId: req.user.id },
      });

      if (presetCount >= MAX_PRESETS_PER_USER) {
        res.status(400).json({ error: `Достигнут лимит наборов (${MAX_PRESETS_PER_USER})` });
        return;
      }
    }

    const savedPreset = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.transferFilterPreset.updateMany({
          where: { userId: req.user!.id, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.transferFilterPreset.upsert({
        where: {
          userId_name: {
            userId: req.user!.id,
            name: normalizedName,
          },
        },
        update: {
          state,
          isDefault: Boolean(isDefault),
        },
        create: {
          userId: req.user!.id,
          name: normalizedName,
          state,
          isDefault: Boolean(isDefault),
        },
      });
    });

    res.status(201).json(savedPreset);
  } catch (error) {
    console.error('SaveTransferFilterPreset error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function deleteTransferFilterPreset(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }

  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Некорректный ID набора' });
    return;
  }

  try {
    const result = await prisma.transferFilterPreset.deleteMany({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!result.count) {
      res.status(404).json({ error: 'Набор фильтров не найден' });
      return;
    }

    res.json({ message: 'Набор фильтров удален' });
  } catch (error) {
    console.error('DeleteTransferFilterPreset error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function renameTransferFilterPreset(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }

  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Некорректный ID набора' });
    return;
  }

  const nextName = String(req.body?.name || '').trim();
  if (!nextName) {
    res.status(400).json({ error: 'Новое название обязательно' });
    return;
  }

  if (nextName.length > 50) {
    res.status(400).json({ error: 'Название набора должно быть не длиннее 50 символов' });
    return;
  }

  try {
    const existing = await prisma.transferFilterPreset.findFirst({
      where: { id, userId: req.user.id },
      select: { id: true, name: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Набор фильтров не найден' });
      return;
    }

    const duplicated = await prisma.transferFilterPreset.findFirst({
      where: {
        userId: req.user.id,
        name: nextName,
        id: { not: id },
      },
      select: { id: true },
    });

    if (duplicated) {
      res.status(409).json({ error: 'Набор с таким названием уже существует' });
      return;
    }

    const renamed = await prisma.transferFilterPreset.update({
      where: { id },
      data: { name: nextName },
    });

    res.json(renamed);
  } catch (error) {
    console.error('RenameTransferFilterPreset error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function setTransferFilterPresetDefault(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }

  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Некорректный ID набора' });
    return;
  }

  try {
    const updatedPreset = await prisma.$transaction(async (tx) => {
      const target = await tx.transferFilterPreset.findFirst({
        where: { id, userId: req.user!.id },
        select: { id: true },
      });

      if (!target) {
        return null;
      }

      await tx.transferFilterPreset.updateMany({
        where: { userId: req.user!.id, isDefault: true },
        data: { isDefault: false },
      });

      return tx.transferFilterPreset.update({
        where: { id },
        data: { isDefault: true },
      });
    });

    if (!updatedPreset) {
      res.status(404).json({ error: 'Набор фильтров не найден' });
      return;
    }

    res.json(updatedPreset);
  } catch (error) {
    console.error('SetTransferFilterPresetDefault error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function clearTransferFilterPresetDefault(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }

  try {
    await prisma.transferFilterPreset.updateMany({
      where: { userId: req.user.id, isDefault: true },
      data: { isDefault: false },
    });

    res.json({ message: 'Набор по умолчанию снят' });
  } catch (error) {
    console.error('ClearTransferFilterPresetDefault error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}
