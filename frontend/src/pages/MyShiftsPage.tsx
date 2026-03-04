import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock, Filter, MapPin, Search, XCircle } from 'lucide-react';
import { transfersApi } from '../api';
import type { Transfer } from '../types';
import { useToast } from '../context/ToastContext';
import { formatTime, getTransferStatusClass, getTransferStatusLabel } from '../utils/helpers';

type QuickFilter = 'TODAY' | 'WEEK' | 'COMPLETED' | 'ALL';

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekRange(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diffToMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    startDate: toLocalDateString(start),
    endDate: toLocalDateString(end),
  };
}

export default function MyShiftsPage() {
  const { showToast } = useToast();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('TODAY');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async () => {
    setLoading(true);
    try {
      const params: {
        date?: string;
        startDate?: string;
        endDate?: string;
        status?: string;
      } = {};

      if (quickFilter === 'TODAY') {
        params.date = toLocalDateString(new Date());
      } else if (quickFilter === 'WEEK') {
        const { startDate, endDate } = getWeekRange(new Date());
        params.startDate = startDate;
        params.endDate = endDate;
      } else if (quickFilter === 'COMPLETED') {
        params.status = 'COMPLETED';
      }

      const res = await transfersApi.getAll(params);
      setTransfers(res.data);
      setError('');
    } catch (err: any) {
      const message = err.response?.data?.error || 'Не удалось загрузить смены';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [quickFilter]);

  const handleStatus = async (id: number, status: 'COMPLETED' | 'CANCELLED') => {
    try {
      await transfersApi.updateMyStatus(id, status);
      showToast(status === 'COMPLETED' ? 'Смена отмечена как выполненная' : 'Смена отменена', 'success');
      load();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Не удалось обновить статус';
      setError(message);
      showToast(message, 'error');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transfers;

    return transfers.filter((item) => (
      item.origin.toLowerCase().includes(q) ||
      item.destination.toLowerCase().includes(q) ||
      `${item.car?.brand || ''} ${item.car?.model || ''}`.toLowerCase().includes(q) ||
      (item.car?.plateNumber || '').toLowerCase().includes(q)
    ));
  }, [transfers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, quickFilter]);

  const exportCsv = () => {
    if (!filtered.length) {
      showToast('Нет данных для экспорта', 'error');
      return;
    }

    const escape = (value: string | number | null | undefined) => {
      const str = String(value ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = [
      ['ID', 'Дата', 'Начало', 'Окончание', 'Откуда', 'Куда', 'Автомобиль', 'Номер', 'Статус'],
      ...filtered.map((item) => [
        item.id,
        new Date(item.date).toLocaleDateString('ru-RU'),
        formatTime(item.startTime),
        formatTime(item.endTime),
        item.origin,
        item.destination,
        `${item.car?.brand || ''} ${item.car?.model || ''}`,
        item.car?.plateNumber || '',
        item.status,
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => escape(cell)).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `my-shifts-${toLocalDateString(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header">
        <h2>Мои смены</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={exportCsv}>Экспорт CSV</button>
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Водительский режим</span>
        </div>
      </div>

      <div className="page-content">
        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Filter size={15} color="var(--gray-500)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)' }}>Быстрые фильтры</span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${quickFilter === 'TODAY' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setQuickFilter('TODAY')}>Сегодня</button>
            <button className={`btn btn-sm ${quickFilter === 'WEEK' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setQuickFilter('WEEK')}>Эта неделя</button>
            <button className={`btn btn-sm ${quickFilter === 'COMPLETED' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setQuickFilter('COMPLETED')}>Выполненные</button>
            <button className={`btn btn-sm ${quickFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setQuickFilter('ALL')}>Все</button>
          </div>

          <div className="search-input-wrapper" style={{ maxWidth: 420 }}>
            <Search />
            <input
              placeholder="Поиск по маршруту или авто..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="card">
            <div className="table-skeleton">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="skeleton-row" />
              ))}
            </div>
          </div>
        ) : (
          <div className="card">
            {paged.length === 0 ? (
              <div className="empty-state">
                <Calendar size={40} />
                <p>Смены не найдены</p>
              </div>
            ) : (
              <>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Дата / Время</th>
                        <th>Маршрут</th>
                        <th>Автомобиль</th>
                        <th>Статус</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((item) => (
                        <tr key={item.id}>
                          <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{item.id}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{new Date(item.date).toLocaleDateString('ru-RU')}</div>
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
                          <td>
                            <div>{item.car?.brand} {item.car?.model}</div>
                            <span className="chip">{item.car?.plateNumber}</span>
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
                                  <button
                                    className="btn btn-ghost btn-icon"
                                    style={{ color: 'var(--success)' }}
                                    onClick={() => handleStatus(item.id, 'COMPLETED')}
                                    title="Отметить выполненным"
                                  >
                                    <CheckCircle2 size={15} />
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-icon"
                                    style={{ color: 'var(--danger)' }}
                                    onClick={() => handleStatus(item.id, 'CANCELLED')}
                                    title="Отменить"
                                  >
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

                <div className="table-meta">
                  <span>Показано {paged.length} из {filtered.length}</span>
                  <div className="pagination">
                    <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                    <button className="btn btn-secondary" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Назад</button>
                    <span>Страница {currentPage} / {totalPages}</span>
                    <button className="btn btn-secondary" disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Вперёд</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
