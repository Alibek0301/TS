export interface User {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'DISPATCHER' | 'DRIVER';
  driverId?: number;
}

export interface Driver {
  id: number;
  fullName: string;
  phone: string;
  status: 'ACTIVE' | 'DAY_OFF' | 'VACATION';
  note?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { transfers: number };
}

export interface Car {
  id: number;
  brand: string;
  model: string;
  plateNumber: string;
  status: 'FREE' | 'MAINTENANCE' | 'BUSY';
  createdAt: string;
  updatedAt: string;
  _count?: { transfers: number };
}

export interface Transfer {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  origin: string;
  destination: string;
  driverId: number;
  carId: number;
  status: 'PLANNED' | 'COMPLETED' | 'CANCELLED';
  comment?: string;
  createdAt: string;
  updatedAt: string;
  driver?: Driver;
  car?: Car;
  history?: TransferHistory[];
}

export interface TransferHistory {
  id: number;
  transferId: number;
  userId: number;
  action: string;
  description: string;
  createdAt: string;
  user?: { id: number; name: string; email: string };
}

export interface DashboardData {
  todayTransfersCount: number;
  freeCarsCount: number;
  busyCarsCount: number;
  activeDriversCount: number;
  upcomingTransfers: Transfer[];
}
