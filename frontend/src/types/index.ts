export interface User {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'DISPATCHER' | 'DRIVER';
  driverId?: number;
}

export interface ManagedUser {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'DISPATCHER' | 'DRIVER';
  driverId?: number | null;
  createdAt: string;
  updatedAt: string;
  driver?: {
    id: number;
    fullName: string;
    phone: string;
    status: 'ACTIVE' | 'DAY_OFF' | 'VACATION';
  } | null;
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
  mileage: number;
  nextServiceMileage?: number | null;
  lastServiceMileage?: number | null;
  lastServiceDate?: string | null;
  oilChangeMileage?: number | null;
  coolantChangeDate?: string | null;
  brakeFluidChangeDate?: string | null;
  transmissionFluidChangeDate?: string | null;
  isUnderRepair: boolean;
  repairNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { transfers: number; maintenanceRecords?: number };
  maintenanceRecords?: CarMaintenance[];
}

export type CarMaintenanceType = 'OIL_CHANGE' | 'FLUID_CHANGE' | 'INSPECTION' | 'REPAIR' | 'OTHER';

export interface CarMaintenance {
  id: number;
  carId: number;
  type: CarMaintenanceType;
  mileage: number;
  performedAt: string;
  notes?: string | null;
  cost?: number | null;
  oilChanged: boolean;
  coolantChanged: boolean;
  brakeFluidChanged: boolean;
  transmissionFluidChanged: boolean;
  createdAt: string;
}

export interface CarMaintenanceLogItem extends CarMaintenance {
  car?: {
    id: number;
    brand: string;
    model: string;
    plateNumber: string;
  };
}

export interface Transfer {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  origin: string;
  destination: string;
  clientName?: string | null;
  clientPhone?: string | null;
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

export interface TransferFilterPreset {
  id: number;
  userId: number;
  name: string;
  state: unknown;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Waybill {
  id: number;
  number: string;
  seriesBranchCode: string;
  seriesTypeCode: string;
  seriesMonth: string;
  transferId: number;
  status: 'DRAFT' | 'ISSUED' | 'CLOSED';
  issueDate: string;
  validFrom: string;
  validTo: string;
  organizationName: string;
  organizationBin?: string | null;
  organizationAddress?: string | null;
  dispatchAddress?: string | null;
  driverName: string;
  driverLicenseNumber?: string | null;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlateNumber: string;
  route: string;
  odometerStart?: number | null;
  odometerEnd?: number | null;
  fuelType?: string | null;
  fuelIssuedLiters?: number | null;
  fuelRemainingLiters?: number | null;
  mechanicName?: string | null;
  medicName?: string | null;
  preTripCheckPassed?: boolean | null;
  postTripCheckPassed?: boolean | null;
  preTripMedicalPassed?: boolean | null;
  postTripMedicalPassed?: boolean | null;
  notes?: string | null;
  printedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  transfer?: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    origin: string;
    destination: string;
    status: 'PLANNED' | 'COMPLETED' | 'CANCELLED';
  };
}

export interface ClientOption {
  name: string;
  orders: number;
}

export interface DriverAnalytics {
  entity: { id: number; fullName: string; phone: string; status: string };
  metrics: {
    totalOrders: number;
    completed: number;
    cancelled: number;
    planned: number;
    avgDurationMinutes: number;
    uniqueClients: number;
    uniqueRoutes: number;
    uniqueCars: number;
  };
  topClients: Array<{ name: string; total: number }>;
  topRoutes: Array<{ route: string; total: number }>;
  recentOrders: Transfer[];
}

export interface CarAnalytics {
  entity: {
    id: number;
    brand: string;
    model: string;
    plateNumber: string;
    status: string;
    mileage: number;
    nextServiceMileage?: number | null;
  };
  metrics: {
    totalOrders: number;
    completed: number;
    cancelled: number;
    planned: number;
    avgDurationMinutes: number;
    uniqueClients: number;
    uniqueRoutes: number;
    uniqueDrivers: number;
    maintenanceRecords: number;
    maintenanceCostTotal: number;
  };
  topDrivers: Array<{ name: string; total: number }>;
  topRoutes: Array<{ route: string; total: number }>;
  recentOrders: Transfer[];
  recentMaintenance: CarMaintenance[];
}

export interface ClientAnalytics {
  entity: { name: string; phone?: string | null };
  metrics: {
    totalOrders: number;
    completed: number;
    cancelled: number;
    planned: number;
    avgDurationMinutes: number;
    uniqueRoutes: number;
    uniqueDrivers: number;
    uniqueCars: number;
  };
  topDrivers: Array<{ name: string; total: number }>;
  topCars: Array<{ name: string; total: number }>;
  topRoutes: Array<{ route: string; total: number }>;
  recentOrders: Transfer[];
}

export interface TransferHistory {
  id: number;
  transferId: number;
  userId: number;
  action: string;
  description: string;
  createdAt: string;
  user?: { id: number; name: string; email: string; role?: 'ADMIN' | 'DISPATCHER' | 'DRIVER' };
  transfer?: {
    id: number;
    origin: string;
    destination: string;
    startTime: string;
    endTime: string;
    status: 'PLANNED' | 'COMPLETED' | 'CANCELLED';
    driver?: { id: number; fullName: string };
    car?: { id: number; brand: string; model: string; plateNumber: string };
  };
}

export interface DashboardData {
  todayTransfersCount: number;
  freeCarsCount: number;
  busyCarsCount: number;
  activeDriversCount: number;
  upcomingTransfers: Transfer[];
  driverStats?: {
    plannedToday: number;
    completedToday: number;
    cancelledToday: number;
  } | null;
  kpi?: {
    completionRate: number;
    cancellationRate: number;
    avgDurationMinutes: number;
    overduePlannedCount: number;
  } | null;
  topDrivers?: Array<{
    id: number;
    fullName: string;
    total: number;
    completed: number;
    cancelled: number;
  }>;
  topRoutes?: Array<{
    route: string;
    total: number;
    completed: number;
    cancelled: number;
  }>;
  hourlyLoad?: Array<{
    hour: string;
    total: number;
    completed: number;
    cancelled: number;
  }>;
  waybillKpi?: {
    totalToday: number;
    draftsToday: number;
    issuedToday: number;
    closedToday: number;
    missingRequiredToday: number;
  };
  recentWaybills?: Array<{
    id: number;
    number: string;
    status: 'DRAFT' | 'ISSUED' | 'CLOSED';
    driverName: string;
    vehiclePlateNumber: string;
    route: string;
    updatedAt: string;
  }>;
  criticalAlerts?: {
    overdueTransfers: Array<{
      id: number;
      startTime: string;
      endTime: string;
      origin: string;
      destination: string;
      driver?: { fullName: string } | null;
      car?: { plateNumber: string } | null;
    }>;
    problematicWaybills: Array<{
      id: number;
      number: string;
      status: 'DRAFT' | 'ISSUED' | 'CLOSED';
      driverName: string;
      vehiclePlateNumber: string;
      route: string;
      updatedAt: string;
    }>;
  };
}
