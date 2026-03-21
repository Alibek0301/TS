import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api';
import type { DashboardData } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatTime } from '../utils/helpers';
import { getTransferStatusClass, getTransferStatusLabel } from '../utils/helpers';
import {
  AlertTriangle,
  CalendarCheck,
  Car,
  Users,
  Clock,
  MapPin,
  FileText,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const isDriver = user?.role === 'DRIVER';

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
        <h2>{isDriver ? 'Мой дашборд' : 'Дашборд'}</h2>
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
              <div className="stat-label">{isDriver ? 'Моих трансферов сегодня' : 'Трансферов сегодня'}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Car size={24} /></div>
            <div>
              <div className="stat-value">{isDriver ? data?.driverStats?.plannedToday ?? 0 : data?.freeCarsCount ?? 0}</div>
              <div className="stat-label">{isDriver ? 'Запланировано на сегодня' : 'Свободных авто'}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><Car size={24} /></div>
            <div>
              <div className="stat-value">{isDriver ? data?.driverStats?.completedToday ?? 0 : data?.busyCarsCount ?? 0}</div>
              <div className="stat-label">{isDriver ? 'Выполнено сегодня' : 'Занятых авто'}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon cyan"><Users size={24} /></div>
            <div>
              <div className="stat-value">{isDriver ? data?.driverStats?.cancelledToday ?? 0 : data?.activeDriversCount ?? 0}</div>
              <div className="stat-label">{isDriver ? 'Отменено сегодня' : 'Водителей на смене'}</div>
            </div>
          </div>
        </div>

        <div className="stats-grid" style={{ marginTop: -8 }}>
          <div className="stat-card">
            <div className="stat-icon blue"><CalendarCheck size={24} /></div>
            <div>
              <div className="stat-value">{data?.kpi?.completionRate ?? 0}%</div>
              <div className="stat-label">Доля выполненных</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><CalendarCheck size={24} /></div>
            <div>
              <div className="stat-value">{data?.kpi?.cancellationRate ?? 0}%</div>
              <div className="stat-label">Доля отмен</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon cyan"><Clock size={24} /></div>
            <div>
              <div className="stat-value">{data?.kpi?.avgDurationMinutes ?? 0}м</div>
              <div className="stat-label">Средняя длительность</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow"><Clock size={24} /></div>
            <div>
              <div className="stat-value">{data?.kpi?.overduePlannedCount ?? 0}</div>
              <div className="stat-label">Просроченные плановые</div>
            </div>
          </div>
        </div>

        {!isDriver && (
          <div className="stats-grid" style={{ marginTop: -8 }}>
            <div className="stat-card">
              <div className="stat-icon blue"><FileText size={24} /></div>
              <div>
                <div className="stat-value">{data?.waybillKpi?.totalToday ?? 0}</div>
                <div className="stat-label">Путевых листов сегодня</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon yellow"><FileText size={24} /></div>
              <div>
                <div className="stat-value">{data?.waybillKpi?.draftsToday ?? 0}</div>
                <div className="stat-label">Черновики ПЛ</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green"><FileText size={24} /></div>
              <div>
                <div className="stat-value">{data?.waybillKpi?.issuedToday ?? 0}</div>
                <div className="stat-label">Выдано ПЛ</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon red"><FileText size={24} /></div>
              <div>
                <div className="stat-value">{data?.waybillKpi?.missingRequiredToday ?? 0}</div>
                <div className="stat-label">ПЛ с риском реквизитов</div>
              </div>
            </div>
          </div>
        )}

        {!isDriver && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="var(--danger)" />
                Критические риски на сегодня
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to="/transfers" className="btn btn-secondary btn-sm">К трансферам</Link>
                <Link to="/waybills" className="btn btn-secondary btn-sm">К путевым листам</Link>
              </div>
            </div>

            <div className="page-grid" style={{ marginTop: 8 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  Просроченные плановые трансферы: {data?.criticalAlerts?.overdueTransfers?.length ?? 0}
                </div>
                {!data?.criticalAlerts?.overdueTransfers?.length ? (
                  <div className="empty-state" style={{ minHeight: 110 }}><Clock size={28} /><p>Нет просроченных</p></div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Маршрут</th>
                          <th>Водитель</th>
                          <th>План до</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.criticalAlerts.overdueTransfers.map((item) => (
                          <tr key={item.id}>
                            <td>{item.id}</td>
                            <td>{item.origin} → {item.destination}</td>
                            <td>{item.driver?.fullName || '-'}</td>
                            <td>{formatTime(item.endTime)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  Проблемные путевые листы: {data?.criticalAlerts?.problematicWaybills?.length ?? 0}
                </div>
                {!data?.criticalAlerts?.problematicWaybills?.length ? (
                  <div className="empty-state" style={{ minHeight: 110 }}><FileText size={28} /><p>Нет критичных ПЛ</p></div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Номер</th>
                          <th>Водитель</th>
                          <th>Госномер</th>
                          <th>Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.criticalAlerts.problematicWaybills.map((item) => (
                          <tr key={item.id}>
                            <td>{item.number}</td>
                            <td>{item.driverName}</td>
                            <td>{item.vehiclePlateNumber}</td>
                            <td>
                              <span className={`badge ${item.status === 'DRAFT' ? 'badge-warning' : item.status === 'ISSUED' ? 'badge-primary' : 'badge-success'}`}>
                                {item.status === 'DRAFT' ? 'Черновик' : item.status === 'ISSUED' ? 'Выдан' : 'Закрыт'}
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
        )}

        {/* Upcoming transfers */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">{isDriver ? 'Мои ближайшие трансферы' : 'Ближайшие трансферы'}</div>
            <Link to="/transfers" className="btn btn-secondary btn-sm">{isDriver ? 'Мои трансферы' : 'Все трансферы'}</Link>
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

        {!isDriver && (
          <div className="page-grid" style={{ marginTop: 16 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Топ водители (сегодня)</div>
              </div>
              {!data?.topDrivers?.length ? (
                <div className="empty-state"><Users size={32} /><p>Нет данных</p></div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Водитель</th>
                        <th>Всего</th>
                        <th>Вып.</th>
                        <th>Отм.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topDrivers.map((item) => (
                        <tr key={item.id}>
                          <td>{item.fullName}</td>
                          <td>{item.total}</td>
                          <td>{item.completed}</td>
                          <td>{item.cancelled}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Топ маршруты (сегодня)</div>
              </div>
              {!data?.topRoutes?.length ? (
                <div className="empty-state"><MapPin size={32} /><p>Нет данных</p></div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Маршрут</th>
                        <th>Всего</th>
                        <th>Вып.</th>
                        <th>Отм.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topRoutes.map((item) => (
                        <tr key={item.route}>
                          <td>{item.route}</td>
                          <td>{item.total}</td>
                          <td>{item.completed}</td>
                          <td>{item.cancelled}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {!isDriver && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div className="card-title">Нагрузка по часам</div>
            </div>
            {!data?.hourlyLoad?.length ? (
              <div className="empty-state"><Clock size={32} /><p>Нет данных</p></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Час</th>
                      <th>Всего</th>
                      <th>Выполнено</th>
                      <th>Отменено</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hourlyLoad.map((item) => (
                      <tr key={item.hour}>
                        <td>{item.hour}</td>
                        <td>{item.total}</td>
                        <td>{item.completed}</td>
                        <td>{item.cancelled}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!isDriver && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div className="card-title">Последние путевые листы</div>
              <Link to="/waybills" className="btn btn-secondary btn-sm">Открыть раздел</Link>
            </div>
            {!data?.recentWaybills?.length ? (
              <div className="empty-state"><FileText size={32} /><p>Нет данных</p></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Номер</th>
                      <th>Водитель</th>
                      <th>Госномер</th>
                      <th>Маршрут</th>
                      <th>Статус</th>
                      <th>Обновлен</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentWaybills.map((item) => (
                      <tr key={item.id}>
                        <td>{item.number}</td>
                        <td>{item.driverName}</td>
                        <td><span className="chip">{item.vehiclePlateNumber}</span></td>
                        <td>{item.route}</td>
                        <td>
                          <span className={`badge ${item.status === 'DRAFT' ? 'badge-warning' : item.status === 'ISSUED' ? 'badge-primary' : 'badge-success'}`}>
                            {item.status === 'DRAFT' ? 'Черновик' : item.status === 'ISSUED' ? 'Выдан' : 'Закрыт'}
                          </span>
                        </td>
                        <td>{new Date(item.updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
