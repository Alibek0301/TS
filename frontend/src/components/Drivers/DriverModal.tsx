import React, { useState } from 'react';
import type { Driver } from '../../types';
import { driversApi } from '../../api';
import { X } from 'lucide-react';

interface Props {
  driver: Driver | null;
  onClose: () => void;
  onSave: () => void;
}

export default function DriverModal({ driver, onClose, onSave }: Props) {
  const isEdit = !!driver;
  const [form, setForm] = useState({
    fullName: driver?.fullName || '',
    phone: driver?.phone || '',
    status: driver?.status || 'ACTIVE',
    note: driver?.note || '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isEdit) {
        await driversApi.update(driver!.id, form);
      } else {
        await driversApi.create(form);
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Редактировать водителя' : 'Добавить водителя'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">⚠️ {error}</div>}

            <div className="form-group">
              <label className="required">ФИО</label>
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Иванов Иван Иванович"
                required
              />
            </div>

            <div className="form-group">
              <label className="required">Телефон</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+7 (701) 123-45-67"
                required
              />
            </div>

            <div className="form-group">
              <label>Статус</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Driver['status'] })}>
                <option value="ACTIVE">Активен</option>
                <option value="DAY_OFF">Выходной</option>
                <option value="VACATION">Отпуск</option>
              </select>
            </div>

            <div className="form-group">
              <label>Примечание</label>
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Дополнительная информация..."
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
