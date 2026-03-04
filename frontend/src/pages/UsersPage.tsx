import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Users, Search } from 'lucide-react';
import { usersApi, driversApi } from '../api';
import type { Driver, ManagedUser } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getRoleLabel } from '../utils/helpers';
import UserModal from '../components/Users/UserModal';

export default function UsersPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'DISPATCHER' | 'DRIVER'>('ALL');
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, driversRes] = await Promise.all([
        usersApi.getAll(),
        driversApi.getAll(),
      ]);
      setUsers(usersRes.data);
      setDrivers(driversRes.data);
      setError('');
    } catch (err: any) {
      const message = err.response?.data?.error || 'Не удалось загрузить пользователей';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return users.filter((item) => {
      const byRole = roleFilter === 'ALL' || item.role === roleFilter;
      const q = search.trim().toLowerCase();
      const bySearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        (item.driver?.fullName || '').toLowerCase().includes(q);
      return byRole && bySearch;
    });
  }, [users, roleFilter, search]);

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить пользователя?')) return;

    try {
      await usersApi.delete(id);
      showToast('Пользователь удалён', 'success');
      load();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Ошибка удаления';
      setError(message);
      showToast(message, 'error');
    }
  };

  if (!isAdmin) {
    return (
      <div className="page-content">
        <div className="alert alert-error">⚠️ Недостаточно прав для доступа к разделу пользователей</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Пользователи</h2>
        <button className="btn btn-primary" onClick={() => { setEditUser(null); setShowModal(true); }}>
          <Plus size={16} /> Добавить пользователя
        </button>
      </div>

      <div className="page-content">
        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <div className="card">
          <div className="list-toolbar" style={{ gridTemplateColumns: 'minmax(260px, 1fr) minmax(160px, 180px)' }}>
            <div className="search-input-wrapper">
              <Search />
              <input
                placeholder="Поиск по имени, email или водителю..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'ALL' | 'ADMIN' | 'DISPATCHER' | 'DRIVER')}>
              <option value="ALL">Все роли</option>
              <option value="ADMIN">Администратор</option>
              <option value="DISPATCHER">Диспетчер</option>
              <option value="DRIVER">Водитель</option>
            </select>
          </div>

          {loading ? (
            <div className="table-skeleton">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="skeleton-row" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <Users size={40} />
              <p>Пользователи не найдены</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Имя</th>
                    <th>Email</th>
                    <th>Роль</th>
                    <th>Привязка водителя</th>
                    <th>Создан</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id}>
                      <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{item.id}</td>
                      <td>{item.name}</td>
                      <td>{item.email}</td>
                      <td>
                        <span className={`badge ${item.role === 'ADMIN' ? 'badge-danger' : item.role === 'DISPATCHER' ? 'badge-primary' : 'badge-success'}`}>
                          {getRoleLabel(item.role)}
                        </span>
                      </td>
                      <td>{item.driver?.fullName || '—'}</td>
                      <td>{new Date(item.createdAt).toLocaleDateString('ru-RU')}</td>
                      <td>
                        <div className="actions">
                          <button
                            className="btn btn-ghost btn-icon"
                            onClick={() => { setEditUser(item); setShowModal(true); }}
                            title="Редактировать"
                          >
                            <Pencil size={15} />
                          </button>
                          {item.id !== user?.id && (
                            <button
                              className="btn btn-ghost btn-icon"
                              style={{ color: 'var(--danger)' }}
                              onClick={() => handleDelete(item.id)}
                              title="Удалить"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <UserModal
          user={editUser}
          drivers={drivers}
          users={users}
          onClose={() => { setShowModal(false); setEditUser(null); }}
          onSave={() => { setShowModal(false); setEditUser(null); load(); }}
        />
      )}
    </div>
  );
}
