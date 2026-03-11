import React, { useEffect, useMemo, useState } from 'react';
import { driversApi } from '../api';
import type { Driver } from '../types';
import { getDriverStatusClass, getDriverStatusLabel } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Plus, Pencil, Trash2, Users, Search,
} from 'lucide-react';
import DriverModal from '../components/Drivers/DriverModal';

type DriverSortKey = 'fullName' | 'phone' | 'status' | 'transfers';

interface PersistedDriversState {
  search: string;
  statusFilter: 'ALL' | Driver['status'];
  hasNoteFilter: 'ALL' | 'WITH_NOTE' | 'WITHOUT_NOTE';
  minTransfersFilter: string;
  sortKey: DriverSortKey;
  sortDir: 'asc' | 'desc';
  pageSize: number;
}

const STORAGE_KEY = 'ts_drivers_page_state_v1';

function readPersistedState(): Partial<PersistedDriversState> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default function DriversPage() {
  const persistedState = useMemo(() => readPersistedState(), []);
  const { user } = useAuth();
  const { showToast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(persistedState.search || '');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Driver['status']>(persistedState.statusFilter || 'ALL');
  const [hasNoteFilter, setHasNoteFilter] = useState<'ALL' | 'WITH_NOTE' | 'WITHOUT_NOTE'>(persistedState.hasNoteFilter || 'ALL');
  const [minTransfersFilter, setMinTransfersFilter] = useState(persistedState.minTransfersFilter || '');
  const [sortKey, setSortKey] = useState<DriverSortKey>(persistedState.sortKey || 'fullName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(persistedState.sortDir || 'asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(persistedState.pageSize || 10);
  const [showModal, setShowModal] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [error, setError] = useState('');

  const canEdit = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';
  const canDelete = user?.role === 'ADMIN';

  const load = () => {
    setLoading(true);
    driversApi.getAll()
      .then((res) => {
        setDrivers(res.data);
        setError('');
      })
      .catch((err: any) => {
        const message = err.response?.data?.error || 'Не удалось загрузить водителей';
        setError(message);
        showToast(message, 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = drivers.filter((d) => {
    const bySearch =
      d.fullName.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search);
    const byStatus = statusFilter === 'ALL' || d.status === statusFilter;
    const hasNote = Boolean(d.note && d.note.trim());
    const byNote =
      hasNoteFilter === 'ALL' ||
      (hasNoteFilter === 'WITH_NOTE' && hasNote) ||
      (hasNoteFilter === 'WITHOUT_NOTE' && !hasNote);

    const minTransfers = minTransfersFilter ? Number(minTransfersFilter) : null;
    const byMinTransfers = minTransfers === null || (d._count?.transfers ?? 0) >= minTransfers;

    return bySearch && byStatus && byNote && byMinTransfers;
  });

  const analytics = {
    total: filtered.length,
    active: filtered.filter((d) => d.status === 'ACTIVE').length,
    dayOff: filtered.filter((d) => d.status === 'DAY_OFF').length,
    vacation: filtered.filter((d) => d.status === 'VACATION').length,
    withNotes: filtered.filter((d) => d.note && d.note.trim()).length,
    totalTransfers: filtered.reduce((acc, d) => acc + (d._count?.transfers ?? 0), 0),
  };

  const sorted = [...filtered].sort((a, b) => {
    const direction = sortDir === 'asc' ? 1 : -1;

    if (sortKey === 'transfers') {
      return ((a._count?.transfers ?? 0) - (b._count?.transfers ?? 0)) * direction;
    }

    const left = (a[sortKey] || '').toString().toLowerCase();
    const right = (b[sortKey] || '').toString().toLowerCase();
    return left.localeCompare(right) * direction;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, hasNoteFilter, minTransfersFilter, sortKey, sortDir, pageSize]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stateToSave: PersistedDriversState = {
      search,
      statusFilter,
      hasNoteFilter,
      minTransfersFilter,
      sortKey,
      sortDir,
      pageSize,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [search, statusFilter, hasNoteFilter, minTransfersFilter, sortKey, sortDir, pageSize]);

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить водителя?')) return;
    try {
      await driversApi.delete(id);
      showToast('Водитель удалён', 'success');
      load();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Ошибка удаления';
      setError(message);
      showToast(message, 'error');
    }
  };

  const handleSave = () => {
    setShowModal(false);
    setEditDriver(null);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h2>Водители</h2>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => { setEditDriver(null); setShowModal(true); }}>
            <Plus size={16} /> Добавить водителя
          </button>
        )}
      </div>

      <div className="page-content">
        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card"><div className="stat-icon blue"><Users size={24} /></div><div><div className="stat-value">{analytics.total}</div><div className="stat-label">Водителей в выборке</div></div></div>
          <div className="stat-card"><div className="stat-icon green"><Users size={24} /></div><div><div className="stat-value">{analytics.active}</div><div className="stat-label">Активных</div></div></div>
          <div className="stat-card"><div className="stat-icon yellow"><Users size={24} /></div><div><div className="stat-value">{analytics.dayOff}</div><div className="stat-label">Выходной</div></div></div>
          <div className="stat-card"><div className="stat-icon cyan"><Users size={24} /></div><div><div className="stat-value">{analytics.vacation}</div><div className="stat-label">В отпуске</div></div></div>
        </div>

        <div className="stats-grid" style={{ marginTop: -8, marginBottom: 16 }}>
          <div className="stat-card"><div className="stat-icon blue"><Users size={24} /></div><div><div className="stat-value">{analytics.totalTransfers}</div><div className="stat-label">Рейсов в выборке</div></div></div>
          <div className="stat-card"><div className="stat-icon yellow"><Users size={24} /></div><div><div className="stat-value">{analytics.withNotes}</div><div className="stat-label">С примечаниями</div></div></div>
        </div>

        <div className="card">
          <div className="list-toolbar">
            <div className="search-input-wrapper">
              <Search />
              <input
                placeholder="Поиск по имени или телефону..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | Driver['status'])}>
              <option value="ALL">Все статусы</option>
              <option value="ACTIVE">Активен</option>
              <option value="DAY_OFF">Выходной</option>
              <option value="VACATION">Отпуск</option>
            </select>

            <select value={hasNoteFilter} onChange={(e) => setHasNoteFilter(e.target.value as 'ALL' | 'WITH_NOTE' | 'WITHOUT_NOTE')}>
              <option value="ALL">Все по примечанию</option>
              <option value="WITH_NOTE">Только с примечанием</option>
              <option value="WITHOUT_NOTE">Без примечания</option>
            </select>

            <input
              type="number"
              min={0}
              value={minTransfersFilter}
              onChange={(e) => setMinTransfersFilter(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Мин. рейсов"
            />

            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as DriverSortKey)}>
              <option value="fullName">Сортировка: ФИО</option>
              <option value="phone">Сортировка: Телефон</option>
              <option value="status">Сортировка: Статус</option>
              <option value="transfers">Сортировка: Рейсы</option>
            </select>

            <select value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}>
              <option value="asc">По возрастанию</option>
              <option value="desc">По убыванию</option>
            </select>

            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option value={5}>5 на странице</option>
              <option value={10}>10 на странице</option>
              <option value={20}>20 на странице</option>
            </select>
          </div>

          {loading ? (
            <div className="table-skeleton">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="skeleton-row" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="empty-state">
              <Users size={40} />
              <p>По выбранным фильтрам ничего не найдено</p>
            </div>
          ) : (
            <>
              <div className="table-container desktop-only">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>ФИО</th>
                      <th>Телефон</th>
                      <th>Статус</th>
                      <th>Рейсов</th>
                      <th>Примечание</th>
                      {canEdit && <th>Действия</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((d) => (
                      <tr key={d.id}>
                        <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{d.id}</td>
                        <td>
                          <div className="entity-info">
                            <div className="entity-avatar driver">
                              {d.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <div>
                              <div className="entity-name">{d.fullName}</div>
                            </div>
                          </div>
                        </td>
                        <td>{d.phone}</td>
                        <td>
                          <span className={`badge ${getDriverStatusClass(d.status)}`}>
                            {getDriverStatusLabel(d.status)}
                          </span>
                        </td>
                        <td>{d._count?.transfers ?? 0}</td>
                        <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>{d.note || '—'}</td>
                        {canEdit && (
                          <td>
                            <div className="actions">
                              <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => { setEditDriver(d); setShowModal(true); }}
                                title="Редактировать"
                              >
                                <Pencil size={15} />
                              </button>
                              {canDelete && (
                                <button
                                  className="btn btn-ghost btn-icon"
                                  style={{ color: 'var(--danger)' }}
                                  onClick={() => handleDelete(d.id)}
                                  title="Удалить"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="compact-cards mobile-only">
                {paged.map((d) => (
                  <div key={`m-${d.id}`} className="compact-card">
                    <div className="entity-name">{d.fullName}</div>
                    <div className="compact-card-row"><span>Телефон</span><span>{d.phone}</span></div>
                    <div className="compact-card-row"><span>Статус</span><span className={`badge ${getDriverStatusClass(d.status)}`}>{getDriverStatusLabel(d.status)}</span></div>
                    <div className="compact-card-row"><span>Рейсов</span><span>{d._count?.transfers ?? 0}</span></div>
                    <div className="compact-card-row"><span>Примечание</span><span>{d.note || '—'}</span></div>
                    {canEdit && (
                      <div className="actions" style={{ marginTop: 10 }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => { setEditDriver(d); setShowModal(true); }} title="Редактировать"><Pencil size={15} /></button>
                        {canDelete && <button className="btn btn-ghost btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(d.id)} title="Удалить"><Trash2 size={15} /></button>}
                      </div>
                    )}
                  </div>
                ))}
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
      </div>

      {showModal && (
        <DriverModal
          driver={editDriver}
          onClose={() => { setShowModal(false); setEditDriver(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
