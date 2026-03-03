import React, { useEffect, useState } from 'react';
import { carsApi } from '../api';
import type { Car } from '../types';
import { getCarStatusClass, getCarStatusLabel } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, CarFront, Search } from 'lucide-react';
import CarModal from '../components/Cars/CarModal';

export default function CarsPage() {
  const { user } = useAuth();
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCar, setEditCar] = useState<Car | null>(null);
  const [error, setError] = useState('');

  const canEdit = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';
  const canDelete = user?.role === 'ADMIN';

  const load = () => {
    carsApi.getAll()
      .then((res) => setCars(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = cars.filter((c) =>
    `${c.brand} ${c.model}`.toLowerCase().includes(search.toLowerCase()) ||
    c.plateNumber.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить автомобиль?')) return;
    try {
      await carsApi.delete(id);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка удаления');
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
          <div style={{ marginBottom: 16 }}>
            <div className="search-input-wrapper">
              <Search />
              <input
                placeholder="Поиск по марке, модели или номеру..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <CarFront size={40} />
              <p>Автомобили не найдены</p>
            </div>
          ) : (
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
                  {filtered.map((c) => (
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
