import React, { useEffect, useState } from 'react';
import { analyticsApi, carsApi, driversApi } from '../api';
import type { Car, ClientAnalytics, ClientOption, Driver, DriverAnalytics, CarAnalytics } from '../types';
import { BarChart3, Car as CarIcon, Clock, Users } from 'lucide-react';
import { formatDateTime } from '../utils/helpers';
import { useToast } from '../context/ToastContext';

type Tab = 'driver' | 'car' | 'client';

export default function EntityAnalyticsPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('driver');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedCarId, setSelectedCarId] = useState('');
  const [selectedClientName, setSelectedClientName] = useState('');

  const [driverData, setDriverData] = useState<DriverAnalytics | null>(null);
  const [carData, setCarData] = useState<CarAnalytics | null>(null);
  const [clientData, setClientData] = useState<ClientAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRefs = async () => {
    setLoading(true);
    try {
      const [driversRes, carsRes, clientsRes] = await Promise.all([
        driversApi.getAll(),
        carsApi.getAll(),
        analyticsApi.getClients(),
      ]);
      setDrivers(driversRes.data);
      setCars(carsRes.data);
      setClients(clientsRes.data);

      if (driversRes.data.length && !selectedDriverId) setSelectedDriverId(String(driversRes.data[0].id));
      if (carsRes.data.length && !selectedCarId) setSelectedCarId(String(carsRes.data[0].id));
      if (clientsRes.data.length && !selectedClientName) setSelectedClientName(clientsRes.data[0].name);

      setError('');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Не удалось загрузить справочники аналитики';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRefs();
  }, []);

  useEffect(() => {
    if (tab !== 'driver' || !selectedDriverId) return;
    analyticsApi.getDriver(Number(selectedDriverId))
      .then((res) => setDriverData(res.data))
      .catch((err: any) => {
        const msg = err.response?.data?.error || 'Не удалось загрузить аналитику водителя';
        setError(msg);
      });
  }, [tab, selectedDriverId]);

  useEffect(() => {
    if (tab !== 'car' || !selectedCarId) return;
    analyticsApi.getCar(Number(selectedCarId))
      .then((res) => setCarData(res.data))
      .catch((err: any) => {
        const msg = err.response?.data?.error || 'Не удалось загрузить аналитику автомобиля';
        setError(msg);
      });
  }, [tab, selectedCarId]);

  useEffect(() => {
    if (tab !== 'client' || !selectedClientName) return;
    analyticsApi.getClient(selectedClientName)
      .then((res) => setClientData(res.data))
      .catch((err: any) => {
        const msg = err.response?.data?.error || 'Не удалось загрузить аналитику клиента';
        setError(msg);
      });
  }, [tab, selectedClientName]);

  const metrics = tab === 'driver' ? driverData?.metrics : tab === 'car' ? carData?.metrics : clientData?.metrics;

  return (
    <div>
      <div className="page-header">
        <h2>Персональная аналитика</h2>
      </div>

      <div className="page-content">
        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="tabs" style={{ marginBottom: 12 }}>
            <button className={`tab-btn ${tab === 'driver' ? 'active' : ''}`} onClick={() => setTab('driver')}>По водителю</button>
            <button className={`tab-btn ${tab === 'car' ? 'active' : ''}`} onClick={() => setTab('car')}>По автомобилю</button>
            <button className={`tab-btn ${tab === 'client' ? 'active' : ''}`} onClick={() => setTab('client')}>По клиенту</button>
          </div>

          {tab === 'driver' && (
            <select value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)}>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
            </select>
          )}

          {tab === 'car' && (
            <select value={selectedCarId} onChange={(e) => setSelectedCarId(e.target.value)}>
              {cars.map((c) => <option key={c.id} value={c.id}>{c.brand} {c.model} ({c.plateNumber})</option>)}
            </select>
          )}

          {tab === 'client' && (
            <select value={selectedClientName} onChange={(e) => setSelectedClientName(e.target.value)}>
              {clients.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.orders})</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : metrics ? (
          <>
            <div className="stats-grid" style={{ marginBottom: 16 }}>
              <div className="stat-card"><div className="stat-icon blue"><BarChart3 size={24} /></div><div><div className="stat-value">{metrics.totalOrders}</div><div className="stat-label">Заказов</div></div></div>
              <div className="stat-card"><div className="stat-icon green"><BarChart3 size={24} /></div><div><div className="stat-value">{metrics.completed}</div><div className="stat-label">Выполнено</div></div></div>
              <div className="stat-card"><div className="stat-icon red"><BarChart3 size={24} /></div><div><div className="stat-value">{metrics.cancelled}</div><div className="stat-label">Отменено</div></div></div>
              <div className="stat-card"><div className="stat-icon yellow"><Clock size={24} /></div><div><div className="stat-value">{metrics.avgDurationMinutes}м</div><div className="stat-label">Средняя длительность</div></div></div>
            </div>

            <div className="stats-grid" style={{ marginTop: -8, marginBottom: 16 }}>
              {'uniqueClients' in metrics && <div className="stat-card"><div className="stat-icon cyan"><Users size={24} /></div><div><div className="stat-value">{metrics.uniqueClients}</div><div className="stat-label">Клиентов</div></div></div>}
              {'uniqueCars' in metrics && <div className="stat-card"><div className="stat-icon blue"><CarIcon size={24} /></div><div><div className="stat-value">{(metrics as any).uniqueCars}</div><div className="stat-label">Автомобилей</div></div></div>}
              {'uniqueDrivers' in metrics && <div className="stat-card"><div className="stat-icon blue"><Users size={24} /></div><div><div className="stat-value">{(metrics as any).uniqueDrivers}</div><div className="stat-label">Водителей</div></div></div>}
              {'uniqueRoutes' in metrics && <div className="stat-card"><div className="stat-icon yellow"><BarChart3 size={24} /></div><div><div className="stat-value">{metrics.uniqueRoutes}</div><div className="stat-label">Маршрутов</div></div></div>}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><div className="card-title">Последние заказы</div></div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Клиент</th>
                      <th>Маршрут</th>
                      <th>Дата</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tab === 'driver' ? driverData?.recentOrders : tab === 'car' ? carData?.recentOrders : clientData?.recentOrders)?.map((item) => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.clientName || '—'}</td>
                        <td>{item.origin} → {item.destination}</td>
                        <td>{formatDateTime(item.startTime)}</td>
                        <td>{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="page-grid">
              <div className="card">
                <div className="card-header"><div className="card-title">Топ маршруты</div></div>
                <div className="history-list">
                  {(tab === 'driver' ? driverData?.topRoutes : tab === 'car' ? carData?.topRoutes : clientData?.topRoutes)?.map((item) => (
                    <div key={item.route} className="history-item"><div className="history-dot" /><div className="history-content"><div className="history-action">{item.route}</div><div className="history-meta">Заказов: {item.total}</div></div></div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><div className="card-title">Топ сущности</div></div>
                <div className="history-list">
                  {tab === 'driver' && driverData?.topClients.map((item) => (
                    <div key={item.name} className="history-item"><div className="history-dot" /><div className="history-content"><div className="history-action">{item.name}</div><div className="history-meta">Заказов: {item.total}</div></div></div>
                  ))}
                  {tab === 'car' && carData?.topDrivers.map((item) => (
                    <div key={item.name} className="history-item"><div className="history-dot" /><div className="history-content"><div className="history-action">{item.name}</div><div className="history-meta">Заказов: {item.total}</div></div></div>
                  ))}
                  {tab === 'client' && clientData?.topDrivers.map((item) => (
                    <div key={item.name} className="history-item"><div className="history-dot" /><div className="history-content"><div className="history-action">{item.name}</div><div className="history-meta">Заказов: {item.total}</div></div></div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
