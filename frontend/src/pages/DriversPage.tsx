import React, { useEffect, useState } from 'react';
import { driversApi } from '../api';
import type { Driver } from '../types';
import { getDriverStatusClass, getDriverStatusLabel } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Pencil, Trash2, Users, Search,
} from 'lucide-react';
import DriverModal from '../components/Drivers/DriverModal';

export default function DriversPage() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [error, setError] = useState('');

  const canEdit = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';
  const canDelete = user?.role === 'ADMIN';

  const load = () => {
    driversApi.getAll()
      .then((res) => setDrivers(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = drivers.filter((d) =>
    d.fullName.toLowerCase().includes(search.toLowerCase()) ||
    d.phone.includes(search)
  );

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить водителя?')) return;
    try {
      await driversApi.delete(id);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка удаления');
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
          <div style={{ marginBottom: 16 }}>
            <div className="search-input-wrapper">
              <Search />
              <input
                placeholder="Поиск по имени или телефону..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <Users size={40} />
              <p>Водители не найдены</p>
            </div>
          ) : (
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
                  {filtered.map((d) => (
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
