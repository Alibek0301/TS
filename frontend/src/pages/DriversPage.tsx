import React, { useEffect, useState } from 'react';
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

export default function DriversPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Driver['status']>('ALL');
  const [sortKey, setSortKey] = useState<DriverSortKey>('fullName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
    return bySearch && byStatus;
  });

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
  }, [search, statusFilter, sortKey, sortDir, pageSize]);

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
              <div className="table-container">
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
