import api from './client';
import type { Driver, Car, Transfer, DashboardData, ManagedUser, TransferHistory } from '../types';

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
};

// Drivers
export const driversApi = {
  getAll: () => api.get<Driver[]>('/drivers'),
  getById: (id: number) => api.get<Driver>(`/drivers/${id}`),
  create: (data: Partial<Driver>) => api.post<Driver>('/drivers', data),
  update: (id: number, data: Partial<Driver>) => api.put<Driver>(`/drivers/${id}`, data),
  delete: (id: number) => api.delete(`/drivers/${id}`),
};

// Cars
export const carsApi = {
  getAll: () => api.get<Car[]>('/cars'),
  getById: (id: number) => api.get<Car>(`/cars/${id}`),
  create: (data: Partial<Car>) => api.post<Car>('/cars', data),
  update: (id: number, data: Partial<Car>) => api.put<Car>(`/cars/${id}`, data),
  delete: (id: number) => api.delete(`/cars/${id}`),
};

// Transfers
export const transfersApi = {
  getAll: (params?: {
    driverId?: number;
    carId?: number;
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }) => api.get<Transfer[]>('/transfers', { params }),
  getById: (id: number) => api.get<Transfer>(`/transfers/${id}`),
  getRecentHistory: (params?: {
    date?: string;
    limit?: number;
    userId?: number;
    action?: string;
    transferId?: number;
  }) =>
    api.get<TransferHistory[]>('/transfers/history/recent', { params }),
  create: (data: Partial<Transfer>) => api.post<Transfer>('/transfers', data),
  update: (id: number, data: Partial<Transfer>) =>
    api.put<Transfer>(`/transfers/${id}`, data),
  updateMyStatus: (id: number, status: 'COMPLETED' | 'CANCELLED') =>
    api.patch<Transfer>(`/transfers/${id}/my-status`, { status }),
  delete: (id: number) => api.delete(`/transfers/${id}`),
};

// Dashboard
export const dashboardApi = {
  get: () => api.get<DashboardData>('/dashboard'),
};

// Users (admin only)
export const usersApi = {
  getAll: () => api.get<ManagedUser[]>('/users'),
  create: (data: {
    email: string;
    password: string;
    name: string;
    role: 'ADMIN' | 'DISPATCHER' | 'DRIVER';
    driverId?: number;
  }) => api.post<ManagedUser>('/users', data),
  update: (id: number, data: {
    email?: string;
    password?: string;
    name?: string;
    role?: 'ADMIN' | 'DISPATCHER' | 'DRIVER';
    driverId?: number;
  }) => api.put<ManagedUser>(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
};
