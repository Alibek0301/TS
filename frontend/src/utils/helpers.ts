import type { Driver, Car, Transfer } from '../types';

export function getDriverStatusLabel(status: Driver['status']): string {
  const map = {
    ACTIVE: 'Активен',
    DAY_OFF: 'Выходной',
    VACATION: 'Отпуск',
  };
  return map[status] || status;
}

export function getDriverStatusClass(status: Driver['status']): string {
  const map = {
    ACTIVE: 'badge-success',
    DAY_OFF: 'badge-warning',
    VACATION: 'badge-info',
  };
  return map[status] || 'badge-gray';
}

export function getCarStatusLabel(status: Car['status']): string {
  const map = {
    FREE: 'Свободна',
    MAINTENANCE: 'На ТО',
    BUSY: 'Занята',
  };
  return map[status] || status;
}

export function getCarStatusClass(status: Car['status']): string {
  const map = {
    FREE: 'badge-success',
    MAINTENANCE: 'badge-warning',
    BUSY: 'badge-danger',
  };
  return map[status] || 'badge-gray';
}

export function getTransferStatusLabel(status: Transfer['status']): string {
  const map = {
    PLANNED: 'Запланирован',
    COMPLETED: 'Выполнен',
    CANCELLED: 'Отменён',
  };
  return map[status] || status;
}

export function getTransferStatusClass(status: Transfer['status']): string {
  const map = {
    PLANNED: 'badge-primary',
    COMPLETED: 'badge-success',
    CANCELLED: 'badge-danger',
  };
  return map[status] || 'badge-gray';
}

export function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    ADMIN: 'Администратор',
    DISPATCHER: 'Диспетчер',
    DRIVER: 'Водитель',
  };
  return map[role] || role;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(dateStr: string): string {
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
}
