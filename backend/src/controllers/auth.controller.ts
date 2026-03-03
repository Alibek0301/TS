import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email и пароль обязательны' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, driverId: user.driverId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        driverId: user.driverId,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const authReq = req as any;
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: authReq.user.id },
      select: { id: true, email: true, name: true, role: true, driverId: true },
    });
    
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }
    
    res.json(user);
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}
