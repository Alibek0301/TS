import React, { useEffect, useMemo, useState } from 'react';
import { Download, Filter, Wrench } from 'lucide-react';
import { carsApi } from '../api';
import type { Car, CarMaintenanceLogItem, CarMaintenanceType } from '../types';
import { formatDateTime } from '../utils/helpers';
import { useToast } from '../context/ToastContext';

type TypeFilter = 'ALL' | CarMaintenanceType;

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTypeLabel(type: CarMaintenanceType): string {
  const map: Record<CarMaintenanceType, string> = {
    OIL_CHANGE: 'Замена масла',
    FLUID_CHANGE: 'Замена жидкостей',
    INSPECTION: 'Осмотр',
    REPAIR: 'Ремонт',
    OTHER: 'Прочее',
  };
  return map[type] || type;
}

export default function CarMaintenanceLogPage() {
  const { showToast } = useToast();
  const [records, setRecords] = useState<CarMaintenanceLogItem[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [startDate, setStartDate] = useState(toLocalDateString(new Date(new Date().setDate(new Date().getDate() - 30))));
  const [endDate, setEndDate] = useState(toLocalDateString(new Date()));
  const [type, setType] = useState<TypeFilter>('ALL');
  const [carId, setCarId] = useState('ALL');

  const load = async () => {
    setLoading(true);
    try {
      const params: {
        startDate?: string;
        endDate?: string;
        type?: CarMaintenanceType;
        carId?: number;
        limit: number;
      } = { limit: 300 };

      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (type !== 'ALL') params.type = type;
      if (carId !== 'ALL') params.carId = Number(carId);

      const [recordsRes, carsRes] = await Promise.all([
        carsApi.getMaintenanceLog(params),
        carsApi.getAll(),
      ]);

      setRecords(recordsRes.data);
      setCars(carsRes.data);
      setError('');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Не удалось загрузить журнал ТО';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [startDate, endDate, type, carId]);

  const stats = useMemo(() => {
    const total = records.length;
    const repairs = records.filter((r) => r.type === 'REPAIR').length;
    const oilChanges = records.filter((r) => r.oilChanged || r.type === 'OIL_CHANGE').length;
    const totalCost = records.reduce((sum, item) => sum + (item.cost || 0), 0);
    return { total, repairs, oilChanges, totalCost };
  }, [records]);

  const exportCsv = () => {
    if (!records.length) {
      showToast('Нет данных для экспорта', 'error');
      return;
    }

    const escape = (value: string | number | null | undefined) => {
      const str = String(value ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = [
      ['Дата', 'Автомобиль', 'Госномер', 'Тип', 'Пробег', 'Работы', 'Стоимость', 'Комментарий'],
      ...records.map((item) => [
        new Date(item.performedAt).toLocaleString('ru-RU'),
        `${item.car?.brand || ''} ${item.car?.model || ''}`,
        item.car?.plateNumber || '',
        getTypeLabel(item.type),
        item.mileage,
        [
          item.oilChanged ? 'Масло' : '',
          item.coolantChanged ? 'Охлаждающая' : '',
          item.brakeFluidChanged ? 'Тормозная' : '',
          item.transmissionFluidChanged ? 'Трансмиссия' : '',
        ].filter(Boolean).join(', '),
        item.cost ?? '',
        item.notes || '',
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => escape(cell)).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `car-maintenance-${startDate}-${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header">
        <h2>Журнал ТО автомобилей</h2>
        <button className="btn btn-secondary" onClick={exportCsv}>
          <Download size={16} /> Экспорт CSV
        </button>
      </div>

      <div className="page-content">
        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-icon blue"><Wrench size={24} /></div>
            <div>
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Всего работ</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><Wrench size={24} /></div>
            <div>
              <div className="stat-value">{stats.repairs}</div>
              <div className="stat-label">Ремонтов</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow"><Wrench size={24} /></div>
            <div>
              <div className="stat-value">{stats.oilChanges}</div>
              <div className="stat-label">Замен масла</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Wrench size={24} /></div>
            <div>
              <div className="stat-value">{Math.round(stats.totalCost).toLocaleString('ru-RU')}</div>
              <div className="stat-label">Сумма затрат</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="list-toolbar" style={{ gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--gray-500)' }}>Начальная дата</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--gray-500)' }}>Конечная дата</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--gray-500)' }}>Тип обслуживания</label>
              <select value={type} onChange={(e) => setType(e.target.value as TypeFilter)}>
                <option value="ALL">Все</option>
                <option value="OIL_CHANGE">Замена масла</option>
                <option value="FLUID_CHANGE">Замена жидкостей</option>
                <option value="INSPECTION">Осмотр</option>
                <option value="REPAIR">Ремонт</option>
                <option value="OTHER">Прочее</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--gray-500)' }}>Автомобиль</label>
              <select value={carId} onChange={(e) => setCarId(e.target.value)}>
                <option value="ALL">Все</option>
                {cars.map((car) => (
                  <option key={car.id} value={car.id}>{car.brand} {car.model} ({car.plateNumber})</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="table-skeleton">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton-row" />)}
            </div>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <Filter size={40} />
              <p>По заданным фильтрам записи ТО не найдены</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Автомобиль</th>
                    <th>Тип</th>
                    <th>Пробег</th>
                    <th>Выполненные работы</th>
                    <th>Стоимость</th>
                    <th>Комментарий</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDateTime(item.performedAt)}</td>
                      <td>
                        <div>{item.car?.brand} {item.car?.model}</div>
                        <div className="chip" style={{ marginTop: 2 }}>{item.car?.plateNumber}</div>
                      </td>
                      <td><span className="badge badge-info">{getTypeLabel(item.type)}</span></td>
                      <td>{item.mileage.toLocaleString('ru-RU')} км</td>
                      <td>
                        {[
                          item.oilChanged ? 'Масло' : '',
                          item.coolantChanged ? 'Охлаждающая' : '',
                          item.brakeFluidChanged ? 'Тормозная' : '',
                          item.transmissionFluidChanged ? 'Трансмиссия' : '',
                        ].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td>{item.cost != null ? `${Math.round(item.cost).toLocaleString('ru-RU')} тг` : '—'}</td>
                      <td>{item.notes || '—'}</td>
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
