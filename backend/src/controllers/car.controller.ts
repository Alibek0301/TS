import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { CarStatus } from '@prisma/client';

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

export async function getCar(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const car = await prisma.car.findUnique({
      where: { id: Number(id) },
      include: {
        transfers: {
          orderBy: { date: 'desc' },
          take: 10,
          include: { driver: true },
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
  const { brand, model, plateNumber, status } = req.body;

  if (!brand || !model || !plateNumber) {
    res.status(400).json({ error: 'Марка, модель и госномер обязательны' });
    return;
  }

  try {
    const car = await prisma.car.create({
      data: { brand, model, plateNumber, status: status || CarStatus.FREE },
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
  const { brand, model, plateNumber, status } = req.body;

  try {
    const car = await prisma.car.update({
      where: { id: Number(id) },
      data: { brand, model, plateNumber, status },
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
  try {
    await prisma.car.delete({ where: { id: Number(id) } });
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
