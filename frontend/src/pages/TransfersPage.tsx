import React, { useEffect, useState } from 'react';
import { transfersApi, driversApi, carsApi } from '../api';
import type { Transfer, Driver, Car } from '../types';
import {
  getTransferStatusClass,
  getTransferStatusLabel,
  formatDate,
  formatTime,
} from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, Calendar, Table2, Filter, MapPin, Clock } from 'lucide-react';
import TransferModal from '../components/Transfers/TransferModal';
import TransferCalendar from '../components/Transfers/TransferCalendar';

export default function TransfersPage() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [showModal, setShowModal] = useState(false);
  const [editTransfer, setEditTransfer] = useState<Transfer | null>(null);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    driverId: '',
    carId: '',
    date: '',
    status: '',
  });

  const canEdit = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';
  const canDelete = user?.role === 'ADMIN';

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.driverId) params.driverId = Number(filters.driverId);
      if (filters.carId) params.carId = Number(filters.carId);
      if (filters.date) params.date = filters.date;
      if (filters.status) params.status = filters.status;

      const [tRes, dRes, cRes] = await Promise.all([
        transfersApi.getAll(params),
        driversApi.getAll(),
        carsApi.getAll(),
      ]);
      setTransfers(tRes.data);
      setDrivers(dRes.data);
      setCars(cRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить трансфер?')) return;
    try {
      await transfersApi.delete(id);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  const handleSave = () => {
    setShowModal(false);
    setEditTransfer(null);
    load();
  };

  const clearFilters = () => setFilters({ driverId: '', carId: '', date: '', status: '' });

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
              onClick={() => { setEditTransfer(null); setShowModal(true); }}
            >
              <Plus size={16} /> Создать трансфер
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        {error && <div className="alert alert-error">⚠️ {error}</div>}

        {/* Filters */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Filter size={15} color="var(--gray-500)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)' }}>Фильтры</span>
            {(filters.driverId || filters.carId || filters.date || filters.status) && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ marginLeft: 'auto' }}>
                Сбросить
              </button>
            )}
          </div>
          <div className="filter-bar">
            <div className="form-group">
              <label>Дата</label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Водитель</label>
              <select
                value={filters.driverId}
                onChange={(e) => setFilters({ ...filters, driverId: e.target.value })}
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
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : viewMode === 'calendar' ? (
          <TransferCalendar
            transfers={transfers}
            onSelect={(t) => { setEditTransfer(t); setShowModal(true); }}
            onNew={(date) => {
              setEditTransfer(null);
              setShowModal(true);
            }}
          />
        ) : (
          <div className="card">
            {transfers.length === 0 ? (
              <div className="empty-state">
                <Calendar size={40} />
                <p>Трансферы не найдены</p>
              </div>
            ) : (
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
                      {canEdit && <th>Действия</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((t) => (
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
                        {canEdit && (
                          <td>
                            <div className="actions">
                              <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => { setEditTransfer(t); setShowModal(true); }}
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
        )}
      </div>

      {showModal && (
        <TransferModal
          transfer={editTransfer}
          drivers={drivers}
          cars={cars}
          onClose={() => { setShowModal(false); setEditTransfer(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
