import { Transfer } from '@prisma/client';
import prisma from './prisma';

interface BuildWaybillInput {
  transfer: Transfer & {
    driver?: { fullName: string } | null;
    car?: { brand: string; model: string; plateNumber: string } | null;
  };
  createdById?: number;
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function toYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

function normalizeSeriesToken(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned || 'GEN';
}

async function generateWaybillNumber(issueDate: Date, seriesBranchCode: string, seriesTypeCode: string): Promise<string> {
  const seriesMonth = toYearMonth(issueDate);
  const prefix = `PL-${seriesBranchCode}-${seriesTypeCode}-${seriesMonth}`;
  const latest = await (prisma as any).waybill.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { id: 'desc' },
    select: { number: true },
  });

  const nextSeq = latest
    ? Math.min(9999, Number(String(latest.number).split('-').pop()) + 1 || 1)
    : 1;

  return `${prefix}-${String(nextSeq).padStart(5, '0')}`;
}

export async function ensureWaybillForTransfer(input: BuildWaybillInput) {
  const { transfer, createdById } = input;

  const existing = await (prisma as any).waybill.findUnique({
    where: { transferId: transfer.id },
  });
  if (existing) return existing;

  const issueDate = transfer.date;
  const seriesBranchCode = normalizeSeriesToken(process.env.WAYBILL_SERIES_BRANCH || 'AST');
  const seriesTypeCode = normalizeSeriesToken(process.env.WAYBILL_SERIES_TYPE || 'TR');
  const seriesMonth = toYearMonth(issueDate);
  const number = await generateWaybillNumber(issueDate, seriesBranchCode, seriesTypeCode);

  const legalChecklist = {
    jurisdiction: 'KZ',
    documentName: 'Путевой лист',
    version: 'RK-basic-v1',
    requiredFieldsPresent: true,
    notes: [
      'Требуется проверка локальных нормативных актов и внутреннего регламента перевозчика.',
      'Поля медосмотра/техосмотра должны заполняться ответственными лицами перед выпуском на линию.',
    ],
  };

  return (prisma as any).waybill.create({
    data: {
      number,
      seriesBranchCode,
      seriesTypeCode,
      seriesMonth,
      transferId: transfer.id,
      createdById,
      issueDate,
      validFrom: transfer.startTime,
      validTo: transfer.endTime,
      organizationName: process.env.WAYBILL_ORG_NAME || 'ТОО TransferSchedule',
      organizationBin: process.env.WAYBILL_ORG_BIN || null,
      organizationAddress: process.env.WAYBILL_ORG_ADDRESS || null,
      dispatchAddress: process.env.WAYBILL_DISPATCH_ADDRESS || transfer.origin,
      driverName: transfer.driver?.fullName || 'Не указан',
      vehicleBrand: transfer.car?.brand || 'Не указана',
      vehicleModel: transfer.car?.model || 'Не указана',
      vehiclePlateNumber: transfer.car?.plateNumber || 'Не указан',
      route: `${transfer.origin} -> ${transfer.destination}`,
      notes: transfer.comment || null,
      legalChecklist,
    },
  });
}
