import React, { useState } from 'react';
import type { Transfer, Driver, Car } from '../../types';
import { transfersApi } from '../../api';
import { X, AlertTriangle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface Props {
  transfer: Transfer | null;
  drivers: Driver[];
  cars: Car[];
  onClose: () => void;
  onSave: () => void;
  defaultDate?: string;
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toLocalTimeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export default function TransferModal({ transfer, drivers, cars, onClose, onSave, defaultDate }: Props) {
  const isEdit = !!transfer;
  const { showToast } = useToast();

  const getDefaultDate = () => {
    if (transfer) return toLocalDateString(new Date(transfer.date));
    if (defaultDate) return defaultDate;
    return toLocalDateString(new Date());
  };

  const getDefaultStartTime = () => {
    if (transfer) return toLocalTimeString(new Date(transfer.startTime));
    return '09:00';
  };

  const getDefaultEndTime = () => {
    if (transfer) return toLocalTimeString(new Date(transfer.endTime));
    return '11:00';
  };

  const [form, setForm] = useState({
    date: getDefaultDate(),
    startTime: getDefaultStartTime(),
    endTime: getDefaultEndTime(),
    origin: transfer?.origin || '',
    destination: transfer?.destination || '',
    clientName: transfer?.clientName || '',
    clientPhone: transfer?.clientPhone || '',
    driverId: transfer?.driverId?.toString() || '',
    carId: transfer?.carId?.toString() || '',
    status: transfer?.status || 'PLANNED',
    comment: transfer?.comment || '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-set end time when start changes (default +2 hours)
  const handleStartTimeChange = (val: string) => {
    const [h, m] = val.split(':').map(Number);
    const endH = (h + 2) % 24;
    const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setForm({ ...form, startTime: val, endTime });
  };

  const buildDateTime = (date: string, time: string): string => {
    return `${date}T${time}:00`;
  };

  const validate = () => {
    if (!form.date) return 'Укажите дату трансфера';
    if (!form.startTime || !form.endTime) return 'Укажите время начала и окончания';

    const start = new Date(buildDateTime(form.date, form.startTime)).getTime();
    const end = new Date(buildDateTime(form.date, form.endTime)).getTime();
    if (end <= start) {
      return 'Время окончания должно быть позже времени начала';
    }

    const origin = form.origin.trim();
    const destination = form.destination.trim();
    if (origin.length < 3 || destination.length < 3) {
      return 'Точки маршрута должны содержать минимум 3 символа';
    }

    if (origin.toLowerCase() === destination.toLowerCase()) {
      return 'Точка отправления и назначения не должны совпадать';
    }

    if (!form.driverId || !form.carId) {
      return 'Выберите водителя и автомобиль';
    }

    if (form.comment.trim().length > 300) {
      return 'Комментарий должен быть не длиннее 300 символов';
    }

    if (form.clientName.trim().length > 120) {
      return 'Имя клиента должно быть не длиннее 120 символов';
    }

    if (form.clientPhone.trim().length > 30) {
      return 'Телефон клиента должен быть не длиннее 30 символов';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        date: form.date,
        startTime: buildDateTime(form.date, form.startTime),
        endTime: buildDateTime(form.date, form.endTime),
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        clientName: form.clientName.trim() || undefined,
        clientPhone: form.clientPhone.trim() || undefined,
        driverId: Number(form.driverId),
        carId: Number(form.carId),
        status: form.status,
        comment: form.comment.trim() || undefined,
      };

      if (isEdit) {
        await transfersApi.update(transfer!.id, payload);
      } else {
        await transfersApi.create(payload);
      }
      showToast(isEdit ? 'Трансфер обновлён' : 'Трансфер создан', 'success');
      onSave();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Ошибка сохранения';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const isConflictError = error.includes('Конфликт') || error.includes('занят');

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">
            {isEdit ? 'Редактировать трансфер' : 'Создать трансфер'}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className={`alert ${isConflictError ? 'alert-warning' : 'alert-error'}`}>
                {isConflictError ? <AlertTriangle size={16} /> : '⚠️'}
                <span>{error}</span>
              </div>
            )}

            {/* Date & Time */}
            <div className="form-row">
              <div className="form-group">
                <label className="required">Дата</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 1' }} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="required">Время начала</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="required">Время окончания</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Route */}
            <div className="form-row">
              <div className="form-group">
                <label className="required">Точка отправления</label>
                <input
                  value={form.origin}
                  onChange={(e) => setForm({ ...form, origin: e.target.value })}
                  placeholder="Аэропорт Алматы"
                  required
                />
              </div>
              <div className="form-group">
                <label className="required">Точка назначения</label>
                <input
                  value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  placeholder="Отель Rixos"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Клиент</label>
                <input
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  placeholder="Имя клиента или компания"
                />
              </div>
              <div className="form-group">
                <label>Телефон клиента</label>
                <input
                  value={form.clientPhone}
                  onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                  placeholder="+7 (...) ..."
                />
              </div>
            </div>

            {/* Driver & Car */}
            <div className="form-row">
              <div className="form-group">
                <label className="required">Водитель</label>
                <select
                  value={form.driverId}
                  onChange={(e) => setForm({ ...form, driverId: e.target.value })}
                  required
                >
                  <option value="">Выберите водителя</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id} disabled={d.status !== 'ACTIVE'}>
                      {d.fullName} {d.status !== 'ACTIVE' ? `(${d.status === 'DAY_OFF' ? 'Выходной' : 'Отпуск'})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="required">Автомобиль</label>
                <select
                  value={form.carId}
                  onChange={(e) => setForm({ ...form, carId: e.target.value })}
                  required
                >
                  <option value="">Выберите автомобиль</option>
                  {cars.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.status === 'MAINTENANCE'}>
                      {c.brand} {c.model} ({c.plateNumber})
                      {c.status === 'MAINTENANCE' ? ' — На ТО' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status & Comment */}
            <div className="form-row">
              <div className="form-group">
                <label>Статус</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Transfer['status'] })}
                >
                  <option value="PLANNED">Запланирован</option>
                  <option value="COMPLETED">Выполнен</option>
                  <option value="CANCELLED">Отменён</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Комментарий</label>
              <textarea
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Дополнительная информация..."
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Сохранение...' : isEdit ? 'Сохранить изменения' : 'Создать трансфер'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
