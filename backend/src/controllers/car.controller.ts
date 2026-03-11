import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { CarStatus, CarMaintenanceType } from '@prisma/client';

function parsePositiveInt(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

function parseNonNegativeInt(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) return null;
  return num;
}

function parseOptionalDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseMaintenanceType(value: unknown): CarMaintenanceType | null {
  if (!value) return null;
  const raw = String(value);
  if (raw === CarMaintenanceType.OIL_CHANGE) return CarMaintenanceType.OIL_CHANGE;
  if (raw === CarMaintenanceType.FLUID_CHANGE) return CarMaintenanceType.FLUID_CHANGE;
  if (raw === CarMaintenanceType.INSPECTION) return CarMaintenanceType.INSPECTION;
  if (raw === CarMaintenanceType.REPAIR) return CarMaintenanceType.REPAIR;
  if (raw === CarMaintenanceType.OTHER) return CarMaintenanceType.OTHER;
  return null;
}

export async function getCars(req: Request, res: Response): Promise<void> {
  try {
    const cars = await prisma.car.findMany({
      orderBy: { brand: 'asc' },
      include: {
        _count: { select: { transfers: true } },
      },
    });
    res.json(cars);
  } catch (error) {
    console.error('GetCars error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function getMaintenanceLog(req: Request, res: Response): Promise<void> {
  const { carId, type, startDate, endDate, limit } = req.query;

  try {
    const where: any = {};

    if (carId) {
      const parsedCarId = parsePositiveInt(carId);
      if (!parsedCarId) {
        res.status(400).json({ error: 'Некорректный carId' });
        return;
      }
      where.carId = parsedCarId;
    }

    if (type) {
      const parsedType = parseMaintenanceType(type);
      if (!parsedType) {
        res.status(400).json({ error: 'Некорректный тип обслуживания' });
        return;
      }
      where.type = parsedType;
    }

    if (startDate || endDate) {
      where.performedAt = {};

      if (startDate) {
        const parsedStart = parseOptionalDate(startDate);
        if (!parsedStart) {
          res.status(400).json({ error: 'Некорректный startDate' });
          return;
        }
        where.performedAt.gte = parsedStart;
      }

      if (endDate) {
        const parsedEnd = parseOptionalDate(endDate);
        if (!parsedEnd) {
          res.status(400).json({ error: 'Некорректный endDate' });
          return;
        }
        parsedEnd.setHours(23, 59, 59, 999);
        where.performedAt.lte = parsedEnd;
      }
    }

    const parsedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const records = await prisma.carMaintenance.findMany({
      where,
      include: {
        car: {
          select: {
            id: true,
            brand: true,
            model: true,
            plateNumber: true,
          },
        },
      },
      orderBy: { performedAt: 'desc' },
      take: parsedLimit,
    });

    res.json(records);
  } catch (error) {
    console.error('GetMaintenanceLog error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function getCar(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const carId = parsePositiveInt(id);
  if (!carId) {
    res.status(400).json({ error: 'Некорректный ID автомобиля' });
    return;
  }
  try {
    const car = await prisma.car.findUnique({
      where: { id: carId },
      include: {
        transfers: {
          orderBy: { date: 'desc' },
          take: 10,
          include: { driver: true },
        },
        maintenanceRecords: {
          orderBy: { performedAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!car) {
      res.status(404).json({ error: 'Автомобиль не найден' });
      return;
    }
    res.json(car);
  } catch (error) {
    console.error('GetCar error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function createCar(req: Request, res: Response): Promise<void> {
  const {
    brand,
    model,
    plateNumber,
    status,
    mileage,
    nextServiceMileage,
    isUnderRepair,
    repairNotes,
  } = req.body;

  if (!brand || !model || !plateNumber) {
    res.status(400).json({ error: 'Марка, модель и госномер обязательны' });
    return;
  }

  const parsedMileage = mileage !== undefined ? parseNonNegativeInt(mileage) : 0;
  if (parsedMileage === null) {
    res.status(400).json({ error: 'Пробег должен быть целым числом >= 0' });
    return;
  }

  const parsedNextServiceMileage =
    nextServiceMileage !== undefined && nextServiceMileage !== null && nextServiceMileage !== ''
      ? parsePositiveInt(nextServiceMileage)
      : null;

  if (nextServiceMileage !== undefined && nextServiceMileage !== null && nextServiceMileage !== '' && !parsedNextServiceMileage) {
    res.status(400).json({ error: 'Некорректный пробег следующего ТО' });
    return;
  }

  try {
    const car = await prisma.car.create({
      data: {
        brand: String(brand).trim(),
        model: String(model).trim(),
        plateNumber: String(plateNumber).trim().toUpperCase(),
        status: status || CarStatus.FREE,
        mileage: parsedMileage,
        nextServiceMileage: parsedNextServiceMileage,
        isUnderRepair: Boolean(isUnderRepair),
        repairNotes: repairNotes ? String(repairNotes).trim() : null,
      },
    });
    res.status(201).json(car);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Автомобиль с таким госномером уже существует' });
      return;
    }
    console.error('CreateCar error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function updateCar(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const {
    brand,
    model,
    plateNumber,
    status,
    mileage,
    nextServiceMileage,
    isUnderRepair,
    repairNotes,
    oilChangeMileage,
    coolantChangeDate,
    brakeFluidChangeDate,
    transmissionFluidChangeDate,
  } = req.body;
  const carId = parsePositiveInt(id);

  if (!carId) {
    res.status(400).json({ error: 'Некорректный ID автомобиля' });
    return;
  }

  if (mileage !== undefined) {
    const parsedMileage = parseNonNegativeInt(mileage);
    if (parsedMileage === null) {
      res.status(400).json({ error: 'Пробег должен быть целым числом >= 0' });
      return;
    }
  }

  if (nextServiceMileage !== undefined && nextServiceMileage !== null && nextServiceMileage !== '') {
    const parsedNext = parsePositiveInt(nextServiceMileage);
    if (!parsedNext) {
      res.status(400).json({ error: 'Некорректный пробег следующего ТО' });
      return;
    }
  }

  if (oilChangeMileage !== undefined && oilChangeMileage !== null && oilChangeMileage !== '') {
    const parsedOilMileage = parsePositiveInt(oilChangeMileage);
    if (!parsedOilMileage) {
      res.status(400).json({ error: 'Некорректный пробег замены масла' });
      return;
    }
  }

  const parsedCoolantDate = parseOptionalDate(coolantChangeDate);
  const parsedBrakeDate = parseOptionalDate(brakeFluidChangeDate);
  const parsedTransmissionDate = parseOptionalDate(transmissionFluidChangeDate);

  if (coolantChangeDate !== undefined && coolantChangeDate !== null && coolantChangeDate !== '' && !parsedCoolantDate) {
    res.status(400).json({ error: 'Некорректная дата замены охлаждающей жидкости' });
    return;
  }

  if (brakeFluidChangeDate !== undefined && brakeFluidChangeDate !== null && brakeFluidChangeDate !== '' && !parsedBrakeDate) {
    res.status(400).json({ error: 'Некорректная дата замены тормозной жидкости' });
    return;
  }

  if (transmissionFluidChangeDate !== undefined && transmissionFluidChangeDate !== null && transmissionFluidChangeDate !== '' && !parsedTransmissionDate) {
    res.status(400).json({ error: 'Некорректная дата замены трансмиссионной жидкости' });
    return;
  }

  try {
    const data: any = {
      brand,
      model,
      plateNumber,
      status,
      mileage,
      nextServiceMileage,
      isUnderRepair,
      repairNotes,
      oilChangeMileage,
    };

    if (plateNumber !== undefined) {
      data.plateNumber = String(plateNumber).trim().toUpperCase();
    }

    if (brand !== undefined) {
      data.brand = String(brand).trim();
    }

    if (model !== undefined) {
      data.model = String(model).trim();
    }

    if (coolantChangeDate !== undefined) {
      data.coolantChangeDate = parsedCoolantDate;
    }

    if (brakeFluidChangeDate !== undefined) {
      data.brakeFluidChangeDate = parsedBrakeDate;
    }

    if (transmissionFluidChangeDate !== undefined) {
      data.transmissionFluidChangeDate = parsedTransmissionDate;
    }

    if (isUnderRepair === true) {
      data.status = CarStatus.MAINTENANCE;
    }

    const car = await prisma.car.update({
      where: { id: carId },
      data,
    });
    res.json(car);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Автомобиль не найден' });
      return;
    }
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Автомобиль с таким госномером уже существует' });
      return;
    }
    console.error('UpdateCar error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function deleteCar(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const carId = parsePositiveInt(id);
  if (!carId) {
    res.status(400).json({ error: 'Некорректный ID автомобиля' });
    return;
  }
  try {
    await prisma.car.delete({ where: { id: carId } });
    res.json({ message: 'Автомобиль удалён' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Автомобиль не найден' });
      return;
    }
    console.error('DeleteCar error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function getCarMaintenance(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const carId = parsePositiveInt(id);
  if (!carId) {
    res.status(400).json({ error: 'Некорректный ID автомобиля' });
    return;
  }

  try {
    const car = await prisma.car.findUnique({ where: { id: carId }, select: { id: true } });
    if (!car) {
      res.status(404).json({ error: 'Автомобиль не найден' });
      return;
    }

    const records = await prisma.carMaintenance.findMany({
      where: { carId },
      orderBy: { performedAt: 'desc' },
      take: 100,
    });

    res.json(records);
  } catch (error) {
    console.error('GetCarMaintenance error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function addCarMaintenance(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const carId = parsePositiveInt(id);
  if (!carId) {
    res.status(400).json({ error: 'Некорректный ID автомобиля' });
    return;
  }

  const {
    type,
    mileage,
    performedAt,
    notes,
    cost,
    oilChanged,
    coolantChanged,
    brakeFluidChanged,
    transmissionFluidChanged,
    setFreeAfterService,
    nextServiceMileage,
  } = req.body;

  const parsedType = parseMaintenanceType(type);
  if (!parsedType) {
    res.status(400).json({ error: 'Некорректный тип обслуживания' });
    return;
  }

  const parsedMileage = parseNonNegativeInt(mileage);
  if (parsedMileage === null) {
    res.status(400).json({ error: 'Пробег должен быть целым числом >= 0' });
    return;
  }

  const parsedPerformedAt = parseOptionalDate(performedAt);
  if (!parsedPerformedAt) {
    res.status(400).json({ error: 'Некорректная дата обслуживания' });
    return;
  }

  const parsedCost = cost !== undefined && cost !== null && cost !== '' ? Number(cost) : null;
  if (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
    res.status(400).json({ error: 'Некорректная стоимость обслуживания' });
    return;
  }

  const parsedNextServiceMileage =
    nextServiceMileage !== undefined && nextServiceMileage !== null && nextServiceMileage !== ''
      ? parsePositiveInt(nextServiceMileage)
      : null;

  if (nextServiceMileage !== undefined && nextServiceMileage !== null && nextServiceMileage !== '' && !parsedNextServiceMileage) {
    res.status(400).json({ error: 'Некорректный пробег следующего ТО' });
    return;
  }

  try {
    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      res.status(404).json({ error: 'Автомобиль не найден' });
      return;
    }

    const normalizedNotes = notes ? String(notes).trim() : null;
    const oilChangedBool = Boolean(oilChanged);
    const coolantChangedBool = Boolean(coolantChanged);
    const brakeFluidChangedBool = Boolean(brakeFluidChanged);
    const transmissionFluidChangedBool = Boolean(transmissionFluidChanged);

    const record = await prisma.carMaintenance.create({
      data: {
        carId,
        type: parsedType,
        mileage: parsedMileage,
        performedAt: parsedPerformedAt,
        notes: normalizedNotes,
        cost: parsedCost,
        oilChanged: oilChangedBool,
        coolantChanged: coolantChangedBool,
        brakeFluidChanged: brakeFluidChangedBool,
        transmissionFluidChanged: transmissionFluidChangedBool,
      },
    });

    const updateData: any = {
      mileage: Math.max(car.mileage, parsedMileage),
      lastServiceDate: parsedPerformedAt,
      lastServiceMileage: parsedMileage,
    };

    if (parsedNextServiceMileage) {
      updateData.nextServiceMileage = parsedNextServiceMileage;
    }

    if (oilChangedBool) {
      updateData.oilChangeMileage = parsedMileage;
    }

    if (coolantChangedBool) {
      updateData.coolantChangeDate = parsedPerformedAt;
    }

    if (brakeFluidChangedBool) {
      updateData.brakeFluidChangeDate = parsedPerformedAt;
    }

    if (transmissionFluidChangedBool) {
      updateData.transmissionFluidChangeDate = parsedPerformedAt;
    }

    if (parsedType === CarMaintenanceType.REPAIR) {
      updateData.isUnderRepair = true;
      updateData.status = CarStatus.MAINTENANCE;
    }

    if (setFreeAfterService) {
      updateData.isUnderRepair = false;
      updateData.status = CarStatus.FREE;
    }

    const updatedCar = await prisma.car.update({
      where: { id: carId },
      data: updateData,
    });

    res.status(201).json({ record, car: updatedCar });
  } catch (error) {
    console.error('AddCarMaintenance error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}
