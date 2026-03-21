import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { ensureWaybillForTransfer } from '../utils/waybill.utils';

type WaybillStatus = 'DRAFT' | 'ISSUED' | 'CLOSED';
const WAYBILL_STATUSES: WaybillStatus[] = ['DRAFT', 'ISSUED', 'CLOSED'];

type WaybillCandidate = {
  status: WaybillStatus;
  driverLicenseNumber: string | null;
  odometerStart: number | null;
  odometerEnd: number | null;
  mechanicName: string | null;
  medicName: string | null;
  preTripCheckPassed: boolean | null;
  postTripCheckPassed: boolean | null;
  preTripMedicalPassed: boolean | null;
  postTripMedicalPassed: boolean | null;
};

function normalizeString(value: unknown): string | null {
  const v = String(value ?? '').trim();
  return v || null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function validateForStatus(data: WaybillCandidate, targetStatus: WaybillStatus): string[] {
  const missing: string[] = [];

  const requiredForIssued: Array<{ key: string; ok: boolean }> = [
    { key: 'driverLicenseNumber', ok: Boolean(data.driverLicenseNumber) },
    { key: 'odometerStart', ok: data.odometerStart !== null && data.odometerStart >= 0 },
    { key: 'mechanicName', ok: Boolean(data.mechanicName) },
    { key: 'medicName', ok: Boolean(data.medicName) },
    { key: 'preTripCheckPassed', ok: data.preTripCheckPassed === true },
    { key: 'preTripMedicalPassed', ok: data.preTripMedicalPassed === true },
  ];

  for (const field of requiredForIssued) {
    if (!field.ok) missing.push(field.key);
  }

  if (targetStatus === 'CLOSED') {
    const requiredForClosed: Array<{ key: string; ok: boolean }> = [
      { key: 'odometerEnd', ok: data.odometerEnd !== null && data.odometerEnd >= 0 },
      { key: 'postTripCheckPassed', ok: data.postTripCheckPassed === true },
      { key: 'postTripMedicalPassed', ok: data.postTripMedicalPassed === true },
    ];

    for (const field of requiredForClosed) {
      if (!field.ok) missing.push(field.key);
    }

    if (
      data.odometerStart !== null &&
      data.odometerEnd !== null &&
      data.odometerEnd < data.odometerStart
    ) {
      missing.push('odometerEnd>=odometerStart');
    }
  }

  return Array.from(new Set(missing));
}

function parseIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
  return Array.from(new Set(ids));
}

function parsePositiveInt(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function buildWaybillWhere(
  query: { date?: unknown; status?: unknown; search?: unknown },
  driverId?: number
): any | null {
  const { date, status, search } = query;
  const where: any = {};

  if (date) {
    const start = parseDate(date);
    if (!start) return null;
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.issueDate = { gte: start, lt: end };
  }

  if (status && WAYBILL_STATUSES.includes(status as WaybillStatus)) {
    where.status = status;
  }

  if (search) {
    const q = String(search);
    where.OR = [
      { number: { contains: q, mode: 'insensitive' } },
      { driverName: { contains: q, mode: 'insensitive' } },
      { vehiclePlateNumber: { contains: q, mode: 'insensitive' } },
      { route: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (driverId) {
    where.transfer = { driverId };
  }

  return where;
}

function toCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export async function getWaybills(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthRequest;

  try {
    const where = buildWaybillWhere(req.query, authReq.user?.role === 'DRIVER' ? authReq.user.driverId : undefined);
    if (!where) {
      res.status(400).json({ error: 'Некорректная дата' });
      return;
    }

    const rows = await (prisma as any).waybill.findMany({
      where,
      include: {
        transfer: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            origin: true,
            destination: true,
            status: true,
          },
        },
      },
      orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
      take: 300,
    });

    res.json(rows);
  } catch (error) {
    console.error('GetWaybills error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function exportWaybillsCsv(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthRequest;

  try {
    const where = buildWaybillWhere(req.query, authReq.user?.role === 'DRIVER' ? authReq.user.driverId : undefined);
    if (!where) {
      res.status(400).json({ error: 'Некорректная дата' });
      return;
    }

    const rows = await (prisma as any).waybill.findMany({
      where,
      orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
      take: 5000,
    });

    const header = [
      'Номер',
      'Дата выдачи',
      'Период с',
      'Период по',
      'Статус',
      'Водитель',
      'Госномер',
      'Маршрут',
      'Удостоверение',
      'Одометр выезд',
      'Одометр возврат',
      'Механик',
      'Медработник',
      'Дата печати',
    ];

    const csvRows = rows.map((item: any) => [
      item.number,
      new Date(item.issueDate).toLocaleDateString('ru-RU'),
      new Date(item.validFrom).toLocaleString('ru-RU'),
      new Date(item.validTo).toLocaleString('ru-RU'),
      item.status,
      item.driverName,
      item.vehiclePlateNumber,
      item.route,
      item.driverLicenseNumber || '',
      item.odometerStart ?? '',
      item.odometerEnd ?? '',
      item.mechanicName || '',
      item.medicName || '',
      item.printedAt ? new Date(item.printedAt).toLocaleString('ru-RU') : '',
    ]);

    const csv = [header, ...csvRows].map((row) => row.map(toCsvCell).join(',')).join('\n');

    const dateTag = String(req.query.date || new Date().toISOString().slice(0, 10));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="waybills-${dateTag}.csv"`);
    res.status(200).send('\uFEFF' + csv);
  } catch (error) {
    console.error('ExportWaybillsCsv error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function getWaybillById(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthRequest;
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Некорректный ID путевого листа' });
    return;
  }

  try {
    const waybill = await (prisma as any).waybill.findUnique({
      where: { id },
      include: {
        transfer: {
          include: {
            driver: true,
            car: true,
          },
        },
      },
    });

    if (!waybill) {
      res.status(404).json({ error: 'Путевой лист не найден' });
      return;
    }

    if (authReq.user?.role === 'DRIVER' && waybill.transfer.driverId !== authReq.user.driverId) {
      res.status(403).json({ error: 'Нет доступа' });
      return;
    }

    res.json(waybill);
  } catch (error) {
    console.error('GetWaybillById error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function autoGenerateWaybills(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthRequest;
  const { date } = req.body as { date?: string };

  const targetDate = parseDate(date || new Date().toISOString());
  if (!targetDate) {
    res.status(400).json({ error: 'Некорректная дата' });
    return;
  }

  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  try {
    const transfers = await prisma.transfer.findMany({
      where: {
        date: { gte: targetDate, lt: nextDay },
        status: { not: 'CANCELLED' },
      },
      include: {
        driver: { select: { fullName: true } },
        car: { select: { brand: true, model: true, plateNumber: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    let createdCount = 0;
    const skipped: Array<{ transferId: number; reason: string }> = [];

    for (const transfer of transfers) {
      try {
        const existing = await (prisma as any).waybill.findUnique({ where: { transferId: transfer.id } });
        if (existing) {
          skipped.push({ transferId: transfer.id, reason: 'Уже существует' });
          continue;
        }
        await ensureWaybillForTransfer({ transfer, createdById: authReq.user?.id });
        createdCount += 1;
      } catch (e: any) {
        skipped.push({ transferId: transfer.id, reason: e?.message || 'Ошибка генерации' });
      }
    }

    res.status(201).json({
      date: targetDate.toISOString(),
      totalTransfers: transfers.length,
      createdCount,
      skippedCount: skipped.length,
      skipped,
    });
  } catch (error) {
    console.error('AutoGenerateWaybills error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function updateWaybill(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Некорректный ID путевого листа' });
    return;
  }

  const body = req.body || {};

  try {
    const existing = await (prisma as any).waybill.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Путевой лист не найден' });
      return;
    }

    const candidate = {
      status: body.status && WAYBILL_STATUSES.includes(body.status) ? body.status : existing.status,
      driverLicenseNumber: body.driverLicenseNumber !== undefined ? normalizeString(body.driverLicenseNumber) : existing.driverLicenseNumber,
      odometerStart: body.odometerStart !== undefined ? normalizeNumber(body.odometerStart) : existing.odometerStart,
      odometerEnd: body.odometerEnd !== undefined ? normalizeNumber(body.odometerEnd) : existing.odometerEnd,
      fuelType: body.fuelType !== undefined ? normalizeString(body.fuelType) : existing.fuelType,
      fuelIssuedLiters: body.fuelIssuedLiters !== undefined ? normalizeNumber(body.fuelIssuedLiters) : existing.fuelIssuedLiters,
      fuelRemainingLiters: body.fuelRemainingLiters !== undefined ? normalizeNumber(body.fuelRemainingLiters) : existing.fuelRemainingLiters,
      mechanicName: body.mechanicName !== undefined ? normalizeString(body.mechanicName) : existing.mechanicName,
      medicName: body.medicName !== undefined ? normalizeString(body.medicName) : existing.medicName,
      preTripCheckPassed: body.preTripCheckPassed !== undefined ? Boolean(body.preTripCheckPassed) : existing.preTripCheckPassed,
      postTripCheckPassed: body.postTripCheckPassed !== undefined ? Boolean(body.postTripCheckPassed) : existing.postTripCheckPassed,
      preTripMedicalPassed: body.preTripMedicalPassed !== undefined ? Boolean(body.preTripMedicalPassed) : existing.preTripMedicalPassed,
      postTripMedicalPassed: body.postTripMedicalPassed !== undefined ? Boolean(body.postTripMedicalPassed) : existing.postTripMedicalPassed,
      notes: body.notes !== undefined ? normalizeString(body.notes) : existing.notes,
    };

    if (candidate.status === 'ISSUED' || candidate.status === 'CLOSED') {
      const missing = validateForStatus(candidate, candidate.status as WaybillStatus);
      if (missing.length) {
        res.status(400).json({
          error: `Недостаточно данных для статуса ${candidate.status}`,
          missing,
        });
        return;
      }
    }

    const updated = await (prisma as any).waybill.update({
      where: { id },
      data: candidate,
    });

    res.json(updated);
  } catch (error) {
    console.error('UpdateWaybill error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function markWaybillPrinted(req: Request, res: Response): Promise<void> {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Некорректный ID путевого листа' });
    return;
  }

  try {
    const updated = await (prisma as any).waybill.update({
      where: { id },
      data: { printedAt: new Date() },
    });

    res.json(updated);
  } catch (error) {
    console.error('MarkWaybillPrinted error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function bulkUpdateWaybillStatus(req: Request, res: Response): Promise<void> {
  const ids = parseIds(req.body?.ids);
  const status = req.body?.status as WaybillStatus;

  if (!ids.length) {
    res.status(400).json({ error: 'Нужно передать непустой массив ids' });
    return;
  }

  if (!WAYBILL_STATUSES.includes(status)) {
    res.status(400).json({ error: 'Некорректный целевой статус' });
    return;
  }

  try {
    const rows = await (prisma as any).waybill.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        number: true,
        status: true,
        driverLicenseNumber: true,
        odometerStart: true,
        odometerEnd: true,
        mechanicName: true,
        medicName: true,
        preTripCheckPassed: true,
        postTripCheckPassed: true,
        preTripMedicalPassed: true,
        postTripMedicalPassed: true,
      },
    });

    const skipped: Array<{ id: number; number: string; reason: string; missing?: string[] }> = [];
    const validIds: number[] = [];

    for (const row of rows) {
      if (row.status === status) {
        skipped.push({ id: row.id, number: row.number, reason: 'Статус уже установлен' });
        continue;
      }

      const missing =
        status === 'ISSUED' || status === 'CLOSED'
          ? validateForStatus(row as WaybillCandidate, status)
          : [];

      if (missing.length) {
        skipped.push({
          id: row.id,
          number: row.number,
          reason: `Недостаточно данных для статуса ${status}`,
          missing,
        });
        continue;
      }

      validIds.push(row.id);
    }

    if (validIds.length) {
      await (prisma as any).waybill.updateMany({
        where: { id: { in: validIds } },
        data: { status },
      });
    }

    const notFoundIds = ids.filter((id) => !rows.some((row: any) => row.id === id));
    for (const id of notFoundIds) {
      skipped.push({ id, number: '-', reason: 'Не найден' });
    }

    res.json({
      requestedCount: ids.length,
      updatedCount: validIds.length,
      skippedCount: skipped.length,
      skipped,
    });
  } catch (error) {
    console.error('BulkUpdateWaybillStatus error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function bulkMarkWaybillPrinted(req: Request, res: Response): Promise<void> {
  const ids = parseIds(req.body?.ids);

  if (!ids.length) {
    res.status(400).json({ error: 'Нужно передать непустой массив ids' });
    return;
  }

  try {
    const updated = await (prisma as any).waybill.updateMany({
      where: { id: { in: ids } },
      data: { printedAt: new Date() },
    });

    res.json({
      requestedCount: ids.length,
      updatedCount: updated.count,
      skippedCount: Math.max(0, ids.length - updated.count),
    });
  } catch (error) {
    console.error('BulkMarkWaybillPrinted error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}
