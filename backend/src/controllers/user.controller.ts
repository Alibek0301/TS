import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

function normalizeRole(role: string | undefined): UserRole | null {
  if (!role) return null;
  if (role === UserRole.ADMIN) return UserRole.ADMIN;
  if (role === UserRole.DISPATCHER) return UserRole.DISPATCHER;
  if (role === UserRole.DRIVER) return UserRole.DRIVER;
  return null;
}

function parsePositiveInt(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

export async function getUsers(_req: Request, res: Response): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        driverId: true,
        createdAt: true,
        updatedAt: true,
        driver: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            status: true,
          },
        },
      },
    });

    res.json(users);
  } catch (error) {
    console.error('GetUsers error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const { email, password, name, role, driverId } = req.body;

  if (!email || !password || !name || !role) {
    res.status(400).json({ error: 'Email, пароль, имя и роль обязательны' });
    return;
  }

  const parsedRole = normalizeRole(role);
  if (!parsedRole) {
    res.status(400).json({ error: 'Некорректная роль пользователя' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedName = String(name).trim();

  if (!normalizedEmail || !normalizedName) {
    res.status(400).json({ error: 'Email и имя не должны быть пустыми' });
    return;
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      return;
    }

    let parsedDriverId: number | null = null;
    if (parsedRole === UserRole.DRIVER) {
      if (!driverId) {
        res.status(400).json({ error: 'Для роли DRIVER необходимо выбрать водителя' });
        return;
      }

      parsedDriverId = parsePositiveInt(driverId);
      if (!parsedDriverId) {
        res.status(400).json({ error: 'Некорректный driverId' });
        return;
      }

      const driver = await prisma.driver.findUnique({ where: { id: parsedDriverId } });
      if (!driver) {
        res.status(404).json({ error: 'Водитель не найден' });
        return;
      }

      const occupiedDriver = await prisma.user.findFirst({ where: { driverId: parsedDriverId } });
      if (occupiedDriver) {
        res.status(409).json({ error: 'Этот водитель уже привязан к другому пользователю' });
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: normalizedName,
        role: parsedRole,
        driverId: parsedRole === UserRole.DRIVER ? parsedDriverId : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        driverId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('CreateUser error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { email, name, role, driverId, password } = req.body;
  const userId = Number(id);

  if (!Number.isFinite(userId)) {
    res.status(400).json({ error: 'Некорректный ID пользователя' });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    const data: {
      email?: string;
      name?: string;
      role?: UserRole;
      driverId?: number | null;
      password?: string;
    } = {};

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!normalizedEmail) {
        res.status(400).json({ error: 'Email не должен быть пустым' });
        return;
      }

      const emailUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (emailUser && emailUser.id !== userId) {
        res.status(409).json({ error: 'Пользователь с таким email уже существует' });
        return;
      }

      data.email = normalizedEmail;
    }

    if (name !== undefined) {
      const normalizedName = String(name).trim();
      if (!normalizedName) {
        res.status(400).json({ error: 'Имя не должно быть пустым' });
        return;
      }
      data.name = normalizedName;
    }

    const nextRole = role ? normalizeRole(role) : existing.role;
    if (!nextRole) {
      res.status(400).json({ error: 'Некорректная роль пользователя' });
      return;
    }

    data.role = nextRole;

    if (nextRole === UserRole.DRIVER) {
      const parsedDriverId = parsePositiveInt(driverId);
      if (!parsedDriverId) {
        res.status(400).json({ error: 'Для роли DRIVER необходимо передать корректный driverId' });
        return;
      }

      const driver = await prisma.driver.findUnique({ where: { id: parsedDriverId } });
      if (!driver) {
        res.status(404).json({ error: 'Водитель не найден' });
        return;
      }

      const occupiedDriver = await prisma.user.findFirst({
        where: {
          driverId: parsedDriverId,
          id: { not: userId },
        },
      });
      if (occupiedDriver) {
        res.status(409).json({ error: 'Этот водитель уже привязан к другому пользователю' });
        return;
      }

      data.driverId = parsedDriverId;
    } else {
      data.driverId = null;
    }

    if (password !== undefined && String(password).trim() !== '') {
      const rawPassword = String(password);
      if (rawPassword.length < 6) {
        res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
        return;
      }
      data.password = await bcrypt.hash(rawPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        driverId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('UpdateUser error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const authReq = req as AuthRequest;
  const userId = Number(id);

  if (!Number.isFinite(userId)) {
    res.status(400).json({ error: 'Некорректный ID пользователя' });
    return;
  }

  if (authReq.user?.id === userId) {
    res.status(400).json({ error: 'Нельзя удалить собственный аккаунт' });
    return;
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: 'Пользователь удалён' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }
    console.error('DeleteUser error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}
