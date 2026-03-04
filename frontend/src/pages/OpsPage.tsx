import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Filter, ListChecks, MapPin, Search, XCircle } from 'lucide-react';
import { transfersApi } from '../api';
import type { Transfer, TransferHistory } from '../types';
import { useToast } from '../context/ToastContext';
import { formatTime, getTransferStatusClass, getTransferStatusLabel } from '../utils/helpers';

type StatusFilter = 'ALL' | 'PLANNED' | 'COMPLETED' | 'CANCELLED';

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function OpsPage() {
  const { showToast } = useToast();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [updating, setUpdating] = useState(false);
  const [history, setHistory] = useState<TransferHistory[]>([]);
  const [historyDate, setHistoryDate] = useState(toLocalDateString(new Date()));
  const [historyAction, setHistoryAction] = useState<'ALL' | 'CREATE' | 'UPDATE' | 'STATUS_UPDATE'>('ALL');
  const [historyUserId, setHistoryUserId] = useState('ALL');
  const [historyTransferId, setHistoryTransferId] = useState('');

  const load = async () => {
    setLoading(true);
    setHistoryLoading(true);
    try {
      const today = toLocalDateString(new Date());
      const historyParams: {
        date: string;
        limit: number;
        action?: string;
        userId?: number;
        transferId?: number;
      } = {
        date: historyDate,
        limit: 40,
      };

      if (historyAction !== 'ALL') historyParams.action = historyAction;
      if (historyUserId !== 'ALL') historyParams.userId = Number(historyUserId);
      if (historyTransferId.trim()) historyParams.transferId = Number(historyTransferId);

      const [res, historyRes] = await Promise.all([
        transfersApi.getAll({ date: today }),
        transfersApi.getRecentHistory(historyParams),
      ]);
      setTransfers(res.data);
      setHistory(historyRes.data);
      setError('');
    } catch (err: any) {
      const message = err.response?.data?.error || 'Не удалось загрузить оперативную смену';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [historyDate, historyAction, historyUserId, historyTransferId]);

  const historyUsers = useMemo(() => {
    const map = new Map<number, string>();
    history.forEach((item) => {
      if (item.user?.id) {
        map.set(item.user.id, item.user.name || `Пользователь #${item.user.id}`);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [history]);

  const exportHistoryCsv = () => {
    if (!history.length) {
      showToast('Нет данных для экспорта', 'error');
      return;
    }

    const escape = (value: string | number | null | undefined) => {
      const str = String(value ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = [
      ['Дата/время', 'Пользователь', 'Роль', 'Действие', 'Описание', 'ID рейса', 'Маршрут'],
      ...history.map((item) => [
        new Date(item.createdAt).toLocaleString('ru-RU'),
        item.user?.name || 'Система',
        item.user?.role || '',
        item.action,
        item.description,
        item.transfer?.id || '',
        `${item.transfer?.origin || ''} -> ${item.transfer?.destination || ''}`,
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => escape(cell)).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ops-audit-${historyDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transfers.filter((item) => {
      const byStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const bySearch = !q ||
        item.origin.toLowerCase().includes(q) ||
        item.destination.toLowerCase().includes(q) ||
        (item.driver?.fullName || '').toLowerCase().includes(q) ||
        `${item.car?.brand || ''} ${item.car?.model || ''}`.toLowerCase().includes(q) ||
        (item.car?.plateNumber || '').toLowerCase().includes(q);
      return byStatus && bySearch;
    });
  }, [transfers, search, statusFilter]);

  const stats = useMemo(() => {
    const planned = transfers.filter((item) => item.status === 'PLANNED').length;
    const completed = transfers.filter((item) => item.status === 'COMPLETED').length;
    const cancelled = transfers.filter((item) => item.status === 'CANCELLED').length;
    return { planned, completed, cancelled, total: transfers.length };
  }, [transfers]);

  const setStatus = async (transfer: Transfer, status: 'COMPLETED' | 'CANCELLED') => {
    try {
      setUpdating(true);
      await transfersApi.update(transfer.id, { status });
      showToast(status === 'COMPLETED' ? 'Рейс отмечен как выполненный' : 'Рейс отменён', 'success');
      await load();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Не удалось обновить статус рейса';
      setError(message);
      showToast(message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const completeAllPlanned = async () => {
    const candidates = filtered.filter((item) => item.status === 'PLANNED');
    if (!candidates.length) {
      showToast('Нет запланированных рейсов в текущем фильтре', 'error');
      return;
    }

    if (!confirm(`Отметить выполненными ${candidates.length} рейсов?`)) return;

    try {
      setUpdating(true);
      await Promise.all(candidates.map((item) => transfersApi.update(item.id, { status: 'COMPLETED' })));
      showToast(`Обновлено рейсов: ${candidates.length}`, 'success');
      await load();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Не удалось выполнить массовое обновление';
      setError(message);
      showToast(message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Оперативная смена</h2>
        <button className="btn btn-primary" onClick={completeAllPlanned} disabled={updating}>
          <CheckCircle2 size={16} /> Завершить все запланированные
        </button>
      </div>

      <div className="page-content">
        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-icon blue"><ListChecks size={24} /></div>
            <div>
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Рейсов сегодня</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow"><Clock size={24} /></div>
            <div>
              <div className="stat-value">{stats.planned}</div>
              <div className="stat-label">Запланировано</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><CheckCircle2 size={24} /></div>
            <div>
              <div className="stat-value">{stats.completed}</div>
              <div className="stat-label">Выполнено</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><XCircle size={24} /></div>
            <div>
              <div className="stat-value">{stats.cancelled}</div>
              <div className="stat-label">Отменено</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="list-toolbar" style={{ gridTemplateColumns: 'minmax(260px, 1fr) minmax(150px, 190px)' }}>
            <div className="search-input-wrapper">
              <Search />
              <input
                placeholder="Поиск по маршруту, водителю, авто..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--gray-500)' }}>Статус</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                <option value="ALL">Все</option>
                <option value="PLANNED">Запланирован</option>
                <option value="COMPLETED">Выполнен</option>
                <option value="CANCELLED">Отменён</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="table-skeleton">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton-row" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <Filter size={40} />
              <p>По текущим фильтрам рейсы не найдены</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Время</th>
                    <th>Маршрут</th>
                    <th>Водитель</th>
                    <th>Автомобиль</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id}>
                      <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{item.id}</td>
                      <td>
                        <div className="time-range">
                          <Clock size={12} />
                          {formatTime(item.startTime)} — {formatTime(item.endTime)}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                            <MapPin size={12} color="var(--success)" />
                            {item.origin}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--gray-500)' }}>
                            <MapPin size={12} color="var(--danger)" />
                            {item.destination}
                          </div>
                        </div>
                      </td>
                      <td>{item.driver?.fullName || '—'}</td>
                      <td>
                        {item.car?.brand} {item.car?.model}
                        <div className="chip" style={{ marginTop: 2 }}>{item.car?.plateNumber}</div>
                      </td>
                      <td>
                        <span className={`badge ${getTransferStatusClass(item.status)}`}>
                          {getTransferStatusLabel(item.status)}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
                          {item.status === 'PLANNED' ? (
                            <>
                              <button className="btn btn-ghost btn-icon" style={{ color: 'var(--success)' }} onClick={() => setStatus(item, 'COMPLETED')} title="Выполнен" disabled={updating}>
                                <CheckCircle2 size={15} />
                              </button>
                              <button className="btn btn-ghost btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setStatus(item, 'CANCELLED')} title="Отменён" disabled={updating}>
                                <XCircle size={15} />
                              </button>
                            </>
                          ) : (
                            <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>—</span>
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

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div className="card-title">Журнал действий за сегодня</div>
            <button className="btn btn-secondary btn-sm" onClick={exportHistoryCsv}>Экспорт CSV</button>
          </div>

          <div className="list-toolbar" style={{ gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--gray-500)' }}>Дата</label>
              <input type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--gray-500)' }}>Действие</label>
              <select value={historyAction} onChange={(e) => setHistoryAction(e.target.value as 'ALL' | 'CREATE' | 'UPDATE' | 'STATUS_UPDATE')}>
                <option value="ALL">Все</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="STATUS_UPDATE">STATUS_UPDATE</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--gray-500)' }}>Пользователь</label>
              <select value={historyUserId} onChange={(e) => setHistoryUserId(e.target.value)}>
                <option value="ALL">Все</option>
                {historyUsers.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--gray-500)' }}>ID рейса</label>
              <input value={historyTransferId} onChange={(e) => setHistoryTransferId(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Например: 12" />
            </div>
          </div>

          {historyLoading ? (
            <div className="table-skeleton">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-row" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <ListChecks size={36} />
              <p>Изменений за сегодня нет</p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="history-dot" />
                  <div className="history-content">
                    <div className="history-action">
                      <strong>{item.user?.name || 'Система'}</strong> — {item.description}
                    </div>
                    <div className="history-meta">
                      {new Date(item.createdAt).toLocaleString('ru-RU')} • рейс #{item.transfer?.id} • {item.transfer?.origin} → {item.transfer?.destination}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
