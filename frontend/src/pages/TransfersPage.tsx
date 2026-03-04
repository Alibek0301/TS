import React, { useEffect, useMemo, useState } from 'react';
import { transfersApi, driversApi, carsApi } from '../api';
import type { Transfer, Driver, Car } from '../types';
import {
  getTransferStatusClass,
  getTransferStatusLabel,
  formatTime,
} from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Plus, Pencil, Trash2, Calendar, Table2, Filter, MapPin, Clock, CheckCircle2, XCircle } from 'lucide-react';
import TransferModal from '../components/Transfers/TransferModal';
import TransferCalendar from '../components/Transfers/TransferCalendar';

type TransferSortKey = 'date' | 'status' | 'driver' | 'car';
type QuickPreset = 'NONE' | 'TODAY' | 'TOMORROW' | 'WEEK';

interface TransferFilters {
  driverId: string;
  carId: string;
  date: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface PersistedTransfersState {
  filters: TransferFilters;
  search: string;
  sortKey: TransferSortKey;
  sortDir: 'asc' | 'desc';
  pageSize: number;
  viewMode: 'table' | 'calendar';
  quickPreset: QuickPreset;
}

const STORAGE_KEY = 'ts_transfers_page_state_v1';

const DEFAULT_FILTERS: TransferFilters = {
  driverId: '',
  carId: '',
  date: '',
  startDate: '',
  endDate: '',
  status: '',
};

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekRange(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diffToMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    startDate: toLocalDateString(start),
    endDate: toLocalDateString(end),
  };
}

function readPersistedState(): Partial<PersistedTransfersState> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default function TransfersPage() {
  const persistedState = useMemo(() => readPersistedState(), []);
  const { user } = useAuth();
  const { showToast } = useToast();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>(
    persistedState.viewMode === 'calendar' ? 'calendar' : 'table'
  );
  const [search, setSearch] = useState(persistedState.search || '');
  const [sortKey, setSortKey] = useState<TransferSortKey>(persistedState.sortKey || 'date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(persistedState.sortDir || 'desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(persistedState.pageSize || 10);
  const [quickPreset, setQuickPreset] = useState<QuickPreset>(persistedState.quickPreset || 'NONE');
  const [showModal, setShowModal] = useState(false);
  const [editTransfer, setEditTransfer] = useState<Transfer | null>(null);
  const [defaultModalDate, setDefaultModalDate] = useState<string>('');
  const [error, setError] = useState('');

  const [filters, setFilters] = useState<TransferFilters>({
    ...DEFAULT_FILTERS,
    ...(persistedState.filters || {}),
  });

  const canEdit = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';
  const canDelete = user?.role === 'ADMIN';
  const isDriver = user?.role === 'DRIVER';

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.driverId) params.driverId = Number(filters.driverId);
      if (filters.carId) params.carId = Number(filters.carId);
      if (filters.date) params.date = filters.date;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.status) params.status = filters.status;

      if (isDriver) {
        const tRes = await transfersApi.getAll(params);
        setTransfers(tRes.data);
        setDrivers([]);
        setCars([]);
      } else {
        const [tRes, dRes, cRes] = await Promise.all([
          transfersApi.getAll(params),
          driversApi.getAll(),
          carsApi.getAll(),
        ]);
        setTransfers(tRes.data);
        setDrivers(dRes.data);
        setCars(cRes.data);
      }
      setError('');
    } catch (err: any) {
      const message = err.response?.data?.error || 'Не удалось загрузить трансферы';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters, isDriver]);

  const handleDriverStatus = async (id: number, status: 'COMPLETED' | 'CANCELLED') => {
    try {
      await transfersApi.updateMyStatus(id, status);
      showToast(status === 'COMPLETED' ? 'Трансфер отмечен как выполненный' : 'Трансфер отменён', 'success');
      load();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Не удалось изменить статус';
      setError(message);
      showToast(message, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить трансфер?')) return;
    try {
      await transfersApi.delete(id);
      showToast('Трансфер удалён', 'success');
      load();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Ошибка удаления';
      setError(message);
      showToast(message, 'error');
    }
  };

  const handleSave = () => {
    setShowModal(false);
    setEditTransfer(null);
    setDefaultModalDate('');
    load();
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearch('');
    setQuickPreset('NONE');
  };

  const filtered = transfers.filter((t) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      t.origin.toLowerCase().includes(q) ||
      t.destination.toLowerCase().includes(q) ||
      (t.driver?.fullName || '').toLowerCase().includes(q) ||
      `${t.car?.brand || ''} ${t.car?.model || ''}`.toLowerCase().includes(q) ||
      (t.car?.plateNumber || '').toLowerCase().includes(q) ||
      (t.comment || '').toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const direction = sortDir === 'asc' ? 1 : -1;

    if (sortKey === 'date') {
      return (new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) * direction;
    }

    if (sortKey === 'status') {
      return a.status.localeCompare(b.status) * direction;
    }

    if (sortKey === 'driver') {
      return (a.driver?.fullName || '').localeCompare(b.driver?.fullName || '') * direction;
    }

    return (`${a.car?.brand || ''} ${a.car?.model || ''}`).localeCompare(`${b.car?.brand || ''} ${b.car?.model || ''}`) * direction;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filters, search, sortKey, sortDir, pageSize]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stateToSave: PersistedTransfersState = {
      filters,
      search,
      sortKey,
      sortDir,
      pageSize,
      viewMode,
      quickPreset,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [filters, search, sortKey, sortDir, pageSize, viewMode, quickPreset]);

  const setPresetToday = () => {
    const today = toLocalDateString(new Date());
    setFilters((prev) => ({ ...prev, date: today, startDate: '', endDate: '' }));
    setQuickPreset('TODAY');
  };

  const setPresetTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFilters((prev) => ({ ...prev, date: toLocalDateString(tomorrow), startDate: '', endDate: '' }));
    setQuickPreset('TOMORROW');
  };

  const setPresetWeek = () => {
    const { startDate, endDate } = getWeekRange(new Date());
    setFilters((prev) => ({ ...prev, date: '', startDate, endDate }));
    setQuickPreset('WEEK');
  };

  const hasActiveFilters =
    !!search ||
    !!filters.driverId ||
    !!filters.carId ||
    !!filters.date ||
    !!filters.startDate ||
    !!filters.endDate ||
    !!filters.status;

  return (
    <div>
      <div className="page-header">
        <h2>Трансферы</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button
              className={`tab-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              <Table2 size={14} style={{ display: 'inline', marginRight: 4 }} />
              Таблица
            </button>
            <button
              className={`tab-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              <Calendar size={14} style={{ display: 'inline', marginRight: 4 }} />
              Календарь
            </button>
          </div>
          {canEdit && (
            <button
              className="btn btn-primary"
              onClick={() => { setEditTransfer(null); setDefaultModalDate(''); setShowModal(true); }}
            >
              <Plus size={16} /> Создать трансфер
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Filter size={15} color="var(--gray-500)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)' }}>Фильтры</span>
            {hasActiveFilters && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ marginLeft: 'auto' }}>
                Сбросить
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button type="button" className={`btn btn-sm ${quickPreset === 'TODAY' ? 'btn-primary' : 'btn-secondary'}`} onClick={setPresetToday}>Сегодня</button>
            <button type="button" className={`btn btn-sm ${quickPreset === 'TOMORROW' ? 'btn-primary' : 'btn-secondary'}`} onClick={setPresetTomorrow}>Завтра</button>
            <button type="button" className={`btn btn-sm ${quickPreset === 'WEEK' ? 'btn-primary' : 'btn-secondary'}`} onClick={setPresetWeek}>Эта неделя</button>
            {(filters.startDate && filters.endDate) && (
              <span style={{ alignSelf: 'center', color: 'var(--gray-500)', fontSize: 13 }}>
                Период: {filters.startDate} — {filters.endDate}
              </span>
            )}
          </div>

          <div className="filter-bar">
            <div className="form-group" style={{ minWidth: 240 }}>
              <label>Поиск</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Маршрут, водитель, авто, номер..."
              />
            </div>
            <div className="form-group">
              <label>Дата</label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => {
                  setFilters({ ...filters, date: e.target.value, startDate: '', endDate: '' });
                  setQuickPreset('NONE');
                }}
              />
            </div>
            <div className="form-group">
              <label>Водитель</label>
              <select
                value={filters.driverId}
                onChange={(e) => setFilters({ ...filters, driverId: e.target.value })}
                disabled={isDriver}
              >
                <option value="">Все водители</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.fullName}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Автомобиль</label>
              <select
                value={filters.carId}
                onChange={(e) => setFilters({ ...filters, carId: e.target.value })}
                disabled={isDriver}
              >
                <option value="">Все автомобили</option>
                {cars.map((c) => (
                  <option key={c.id} value={c.id}>{c.brand} {c.model} ({c.plateNumber})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Статус</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">Все статусы</option>
                <option value="PLANNED">Запланирован</option>
                <option value="COMPLETED">Выполнен</option>
                <option value="CANCELLED">Отменён</option>
              </select>
            </div>
            <div className="form-group">
              <label>Сортировка</label>
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as TransferSortKey)}>
                <option value="date">По дате</option>
                <option value="status">По статусу</option>
                {!isDriver && <option value="driver">По водителю</option>}
                {!isDriver && <option value="car">По автомобилю</option>}
              </select>
            </div>
            <div className="form-group">
              <label>Порядок</label>
              <select value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}>
                <option value="desc">Сначала новые</option>
                <option value="asc">Сначала старые</option>
              </select>
            </div>
            <div className="form-group">
              <label>На странице</label>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="card">
            <div className="table-skeleton">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="skeleton-row" />
              ))}
            </div>
          </div>
        ) : viewMode === 'calendar' ? (
          <TransferCalendar
            transfers={sorted}
            onSelect={(t) => {
              if (!canEdit) return;
              setDefaultModalDate('');
              setEditTransfer(t);
              setShowModal(true);
            }}
            onNew={(date) => {
              if (!canEdit) return;
              setEditTransfer(null);
              setDefaultModalDate(toLocalDateString(date));
              setShowModal(true);
            }}
          />
        ) : (
          <div className="card">
            {sorted.length === 0 ? (
              <div className="empty-state">
                <Calendar size={40} />
                <p>По выбранным фильтрам ничего не найдено</p>
              </div>
            ) : (
              <>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Дата / Время</th>
                        <th>Маршрут</th>
                        <th>Водитель</th>
                        <th>Автомобиль</th>
                        <th>Статус</th>
                        <th>Комментарий</th>
                        {(canEdit || isDriver) && <th>Действия</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((t) => (
                        <tr key={t.id}>
                          <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{t.id}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>
                              {new Date(t.date).toLocaleDateString('ru-RU')}
                            </div>
                            <div className="time-range">
                              <Clock size={12} />
                              {formatTime(t.startTime)} — {formatTime(t.endTime)}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                                <MapPin size={12} color="var(--success)" />
                                {t.origin}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--gray-500)' }}>
                                <MapPin size={12} color="var(--danger)" />
                                {t.destination}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="entity-info">
                              <div className="entity-avatar driver" style={{ fontSize: 10 }}>
                                {t.driver?.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                              </div>
                              <div>
                                <div className="entity-name" style={{ fontSize: 13 }}>{t.driver?.fullName}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="entity-name" style={{ fontSize: 13 }}>
                              {t.car?.brand} {t.car?.model}
                            </div>
                            <span className="chip">{t.car?.plateNumber}</span>
                          </td>
                          <td>
                            <span className={`badge ${getTransferStatusClass(t.status)}`}>
                              {getTransferStatusLabel(t.status)}
                            </span>
                          </td>
                          <td style={{ color: 'var(--gray-500)', fontSize: 13, maxWidth: 200 }}>
                            {t.comment || '—'}
                          </td>
                          {(canEdit || isDriver) && (
                            <td>
                              <div className="actions">
                                {canEdit ? (
                                  <>
                                    <button
                                      className="btn btn-ghost btn-icon"
                                      onClick={() => { setDefaultModalDate(''); setEditTransfer(t); setShowModal(true); }}
                                      title="Редактировать"
                                    >
                                      <Pencil size={15} />
                                    </button>
                                    {canDelete && (
                                      <button
                                        className="btn btn-ghost btn-icon"
                                        style={{ color: 'var(--danger)' }}
                                        onClick={() => handleDelete(t.id)}
                                        title="Удалить"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}
                                  </>
                                ) : isDriver && t.status === 'PLANNED' ? (
                                  <>
                                    <button
                                      className="btn btn-ghost btn-icon"
                                      style={{ color: 'var(--success)' }}
                                      onClick={() => handleDriverStatus(t.id, 'COMPLETED')}
                                      title="Отметить выполненным"
                                    >
                                      <CheckCircle2 size={15} />
                                    </button>
                                    <button
                                      className="btn btn-ghost btn-icon"
                                      style={{ color: 'var(--danger)' }}
                                      onClick={() => handleDriverStatus(t.id, 'CANCELLED')}
                                      title="Отменить"
                                    >
                                      <XCircle size={15} />
                                    </button>
                                  </>
                                ) : (
                                  <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>—</span>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="table-meta">
                  <span>Показано {paged.length} из {sorted.length}</span>
                  <div className="pagination">
                    <button className="btn btn-secondary" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Назад</button>
                    <span>Страница {currentPage} / {totalPages}</span>
                    <button className="btn btn-secondary" disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Вперёд</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showModal && canEdit && (
        <TransferModal
          transfer={editTransfer}
          drivers={drivers}
          cars={cars}
          defaultDate={defaultModalDate}
          onClose={() => { setShowModal(false); setEditTransfer(null); setDefaultModalDate(''); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
