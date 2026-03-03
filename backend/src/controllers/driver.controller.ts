import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { DriverStatus } from '@prisma/client';

export async function getDrivers(req: Request, res: Response): Promise<void> {
  try {
    const drivers = await prisma.driver.findMany({
      orderBy: { fullName: 'asc' },
      include: {
        _count: { select: { transfers: true } },
      },
    });
    res.json(drivers);
  } catch (error) {
    console.error('GetDrivers error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function getDriver(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: Number(id) },
      include: {
        transfers: {
          orderBy: { date: 'desc' },
          take: 10,
          include: { car: true },
        },
      },
    });
    if (!driver) {
      res.status(404).json({ error: 'Водитель не найден' });
      return;
    }
    res.json(driver);
  } catch (error) {
    console.error('GetDriver error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function createDriver(req: Request, res: Response): Promise<void> {
  const { fullName, phone, status, note } = req.body;

  if (!fullName || !phone) {
    res.status(400).json({ error: 'ФИО и телефон обязательны' });
    return;
  }

  try {
    const driver = await prisma.driver.create({
      data: { fullName, phone, status: status || DriverStatus.ACTIVE, note },
    });
    res.status(201).json(driver);
  } catch (error) {
    console.error('CreateDriver error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function updateDriver(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { fullName, phone, status, note } = req.body;

  try {
    const driver = await prisma.driver.update({
      where: { id: Number(id) },
      data: { fullName, phone, status, note },
    });
    res.json(driver);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Водитель не найден' });
      return;
    }
    console.error('UpdateDriver error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function deleteDriver(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    await prisma.driver.delete({ where: { id: Number(id) } });
    res.json({ message: 'Водитель удалён' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Водитель не найден' });
      return;
    }
    console.error('DeleteDriver error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}
