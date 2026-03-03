import prisma from './prisma';

interface ConflictCheckParams {
  startTime: Date;
  endTime: Date;
  driverId?: number;
  carId?: number;
  excludeTransferId?: number;
}

interface ConflictResult {
  hasConflict: boolean;
  driverConflict: boolean;
  carConflict: boolean;
  message?: string;
}

export async function checkScheduleConflicts(params: ConflictCheckParams): Promise<ConflictResult> {
  const { startTime, endTime, driverId, carId, excludeTransferId } = params;

  const whereBase = {
    NOT: excludeTransferId ? { id: excludeTransferId } : undefined,
    status: { not: 'CANCELLED' as const },
    AND: [
      { startTime: { lt: endTime } },
      { endTime: { gt: startTime } },
    ],
  };

  let driverConflict = false;
  let carConflict = false;

  if (driverId) {
    const driverTransfer = await prisma.transfer.findFirst({
      where: {
        ...whereBase,
        driverId,
      },
    });
    driverConflict = !!driverTransfer;
  }

  if (carId) {
    const carTransfer = await prisma.transfer.findFirst({
      where: {
        ...whereBase,
        carId,
      },
    });
    carConflict = !!carTransfer;
  }

  const hasConflict = driverConflict || carConflict;
  let message: string | undefined;

  if (driverConflict && carConflict) {
    message = 'Конфликт расписания: водитель уже назначен на трансфер в это время, и автомобиль занят в указанное время';
  } else if (driverConflict) {
    message = 'Конфликт расписания: водитель уже назначен на трансфер в это время';
  } else if (carConflict) {
    message = 'Автомобиль занят в указанное время';
  }

  return { hasConflict, driverConflict, carConflict, message };
}
