import api from './client';
import type {
  Driver,
  Car,
  Transfer,
  DashboardData,
  ManagedUser,
  TransferHistory,
  CarMaintenance,
  CarMaintenanceType,
  CarMaintenanceLogItem,
  ClientOption,
  DriverAnalytics,
  CarAnalytics,
  ClientAnalytics,
  TransferFilterPreset,
  Waybill,
} from '../types';

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
  getMaintenance: (id: number) => api.get<CarMaintenance[]>(`/cars/${id}/maintenance`),
  addMaintenance: (id: number, data: {
    type: CarMaintenanceType;
    mileage: number;
    performedAt: string;
    notes?: string;
    cost?: number;
    oilChanged?: boolean;
    coolantChanged?: boolean;
    brakeFluidChanged?: boolean;
    transmissionFluidChanged?: boolean;
    nextServiceMileage?: number;
    setFreeAfterService?: boolean;
  }) => api.post<{ record: CarMaintenance; car: Car }>(`/cars/${id}/maintenance`, data),
  getMaintenanceLog: (params?: {
    carId?: number;
    type?: CarMaintenanceType;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) => api.get<CarMaintenanceLogItem[]>('/cars/maintenance/log', { params }),
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
    clientName?: string;
    origin?: string;
    destination?: string;
    commentMode?: 'ALL' | 'WITH_COMMENT' | 'WITHOUT_COMMENT';
    minDuration?: number;
    maxDuration?: number;
    overdueOnly?: boolean;
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
  createRecurring: (data: {
    date: string;
    startTime: string;
    endTime: string;
    origin: string;
    destination: string;
    clientName?: string;
    clientPhone?: string;
    driverId: number;
    carId: number;
    status: 'PLANNED' | 'COMPLETED' | 'CANCELLED';
    comment?: string;
    recurrence: {
      pattern: 'DAILY' | 'WEEKLY';
      interval?: number;
      count?: number;
      untilDate?: string;
      weekdays?: number[];
    };
  }) => api.post<{
    totalRequested: number;
    createdCount: number;
    skippedCount: number;
    createdTransfers: Array<{ id: number; date: string; startTime: string; endTime: string }>;
    skipped: Array<{ date: string; reason: string }>;
  }>('/transfers/recurring', data),
  update: (id: number, data: Partial<Transfer>) =>
    api.put<Transfer>(`/transfers/${id}`, data),
  updateMyStatus: (id: number, status: 'COMPLETED' | 'CANCELLED') =>
    api.patch<Transfer>(`/transfers/${id}/my-status`, { status }),
  delete: (id: number) => api.delete(`/transfers/${id}`),
  getPresets: (params?: { sortBy?: 'updatedAt' | 'name'; sortDir?: 'asc' | 'desc' }) =>
    api.get<TransferFilterPreset[]>('/transfers/presets', { params }),
  savePreset: (data: {
    name: string;
    state: unknown;
    isDefault?: boolean;
  }) => api.post<TransferFilterPreset>('/transfers/presets', data),
  renamePreset: (id: number, name: string) =>
    api.patch<TransferFilterPreset>(`/transfers/presets/${id}/rename`, { name }),
  setDefaultPreset: (id: number) =>
    api.patch<TransferFilterPreset>(`/transfers/presets/${id}/default`),
  clearDefaultPreset: () =>
    api.patch<{ message: string }>('/transfers/presets/default/clear'),
  deletePreset: (id: number) => api.delete(`/transfers/presets/${id}`),
};

export const analyticsApi = {
  getClients: () => api.get<ClientOption[]>('/analytics/clients'),
  getDriver: (id: number) => api.get<DriverAnalytics>(`/analytics/drivers/${id}`),
  getCar: (id: number) => api.get<CarAnalytics>(`/analytics/cars/${id}`),
  getClient: (name: string) => api.get<ClientAnalytics>(`/analytics/clients/${encodeURIComponent(name)}`),
};

export const waybillsApi = {
  getAll: (params?: { date?: string; status?: 'DRAFT' | 'ISSUED' | 'CLOSED'; search?: string }) =>
    api.get<Waybill[]>('/waybills', { params }),
  getById: (id: number) => api.get<Waybill>(`/waybills/${id}`),
  autoGenerate: (date: string) =>
    api.post<{
      date: string;
      totalTransfers: number;
      createdCount: number;
      skippedCount: number;
      skipped: Array<{ transferId: number; reason: string }>;
    }>('/waybills/auto-generate', { date }),
  update: (id: number, data: Partial<Waybill>) =>
    api.patch<Waybill>(`/waybills/${id}`, data),
  markPrinted: (id: number) =>
    api.patch<Waybill>(`/waybills/${id}/printed`),
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
