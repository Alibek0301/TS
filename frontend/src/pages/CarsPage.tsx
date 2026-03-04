import React, { useEffect, useState } from 'react';
import { carsApi } from '../api';
import type { Car } from '../types';
import { getCarStatusClass, getCarStatusLabel } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Plus, Pencil, Trash2, CarFront, Search } from 'lucide-react';
import CarModal from '../components/Cars/CarModal';

type CarSortKey = 'brand' | 'model' | 'plateNumber' | 'status' | 'transfers';

export default function CarsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Car['status']>('ALL');
  const [sortKey, setSortKey] = useState<CarSortKey>('brand');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showModal, setShowModal] = useState(false);
  const [editCar, setEditCar] = useState<Car | null>(null);
  const [error, setError] = useState('');

  const canEdit = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';
  const canDelete = user?.role === 'ADMIN';

  const load = () => {
    setLoading(true);
    carsApi.getAll()
      .then((res) => {
        setCars(res.data);
        setError('');
      })
      .catch((err: any) => {
        const message = err.response?.data?.error || 'Не удалось загрузить автомобили';
        setError(message);
        showToast(message, 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = cars.filter((c) => {
    const bySearch =
      `${c.brand} ${c.model}`.toLowerCase().includes(search.toLowerCase()) ||
      c.plateNumber.toLowerCase().includes(search.toLowerCase());
    const byStatus = statusFilter === 'ALL' || c.status === statusFilter;
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
    if (!confirm('Удалить автомобиль?')) return;
    try {
      await carsApi.delete(id);
      showToast('Автомобиль удалён', 'success');
      load();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Ошибка удаления';
      setError(message);
      showToast(message, 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Автомобили</h2>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => { setEditCar(null); setShowModal(true); }}>
            <Plus size={16} /> Добавить автомобиль
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
                placeholder="Поиск по марке, модели или номеру..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | Car['status'])}>
              <option value="ALL">Все статусы</option>
              <option value="FREE">Свободна</option>
              <option value="MAINTENANCE">На ТО</option>
              <option value="BUSY">Занята</option>
            </select>

            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as CarSortKey)}>
              <option value="brand">Сортировка: Марка</option>
              <option value="model">Сортировка: Модель</option>
              <option value="plateNumber">Сортировка: Госномер</option>
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
              <CarFront size={40} />
              <p>По выбранным фильтрам ничего не найдено</p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Автомобиль</th>
                      <th>Госномер</th>
                      <th>Статус</th>
                      <th>Рейсов</th>
                      {canEdit && <th>Действия</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((c) => (
                      <tr key={c.id}>
                        <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{c.id}</td>
                        <td>
                          <div className="entity-info">
                            <div className="entity-avatar car">🚗</div>
                            <div>
                              <div className="entity-name">{c.brand} {c.model}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className="chip">{c.plateNumber}</span></td>
                        <td>
                          <span className={`badge ${getCarStatusClass(c.status)}`}>
                            {getCarStatusLabel(c.status)}
                          </span>
                        </td>
                        <td>{c._count?.transfers ?? 0}</td>
                        {canEdit && (
                          <td>
                            <div className="actions">
                              <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => { setEditCar(c); setShowModal(true); }}
                                title="Редактировать"
                              >
                                <Pencil size={15} />
                              </button>
                              {canDelete && (
                                <button
                                  className="btn btn-ghost btn-icon"
                                  style={{ color: 'var(--danger)' }}
                                  onClick={() => handleDelete(c.id)}
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
        <CarModal
          car={editCar}
          onClose={() => { setShowModal(false); setEditCar(null); }}
          onSave={() => { setShowModal(false); setEditCar(null); load(); }}
        />
      )}
    </div>
  );
}
