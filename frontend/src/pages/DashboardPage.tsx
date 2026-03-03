import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api';
import type { DashboardData } from '../types';
import { formatTime } from '../utils/helpers';
import { getTransferStatusClass, getTransferStatusLabel } from '../utils/helpers';
import {
  CalendarCheck,
  Car,
  Users,
  Clock,
  MapPin,
} from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.get()
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div>
      <div className="page-header"><h2>Дашборд</h2></div>
      <div className="page-content"><div className="loading"><div className="spinner" /></div></div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h2>Дашборд</h2>
        <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
          {new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue"><CalendarCheck size={24} /></div>
            <div>
              <div className="stat-value">{data?.todayTransfersCount ?? 0}</div>
              <div className="stat-label">Трансферов сегодня</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Car size={24} /></div>
            <div>
              <div className="stat-value">{data?.freeCarsCount ?? 0}</div>
              <div className="stat-label">Свободных авто</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><Car size={24} /></div>
            <div>
              <div className="stat-value">{data?.busyCarsCount ?? 0}</div>
              <div className="stat-label">Занятых авто</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon cyan"><Users size={24} /></div>
            <div>
              <div className="stat-value">{data?.activeDriversCount ?? 0}</div>
              <div className="stat-label">Водителей на смене</div>
            </div>
          </div>
        </div>

        {/* Upcoming transfers */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Ближайшие трансферы</div>
            <Link to="/transfers" className="btn btn-secondary btn-sm">Все трансферы</Link>
          </div>

          {!data?.upcomingTransfers?.length ? (
            <div className="empty-state">
              <Clock size={40} />
              <p>Нет предстоящих трансферов</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Дата / Время</th>
                    <th>Маршрут</th>
                    <th>Водитель</th>
                    <th>Автомобиль</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcomingTransfers.map((t) => (
                    <tr key={t.id}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MapPin size={14} color="var(--gray-400)" />
                          <span>{t.origin} → {t.destination}</span>
                        </div>
                      </td>
                      <td>{t.driver?.fullName}</td>
                      <td>
                        {t.car?.brand} {t.car?.model}
                        <div className="chip" style={{ marginTop: 2 }}>{t.car?.plateNumber}</div>
                      </td>
                      <td>
                        <span className={`badge ${getTransferStatusClass(t.status)}`}>
                          {getTransferStatusLabel(t.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
