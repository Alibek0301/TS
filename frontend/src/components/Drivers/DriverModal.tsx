import React, { useState } from 'react';
import type { Driver } from '../../types';
import { driversApi } from '../../api';
import { X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface Props {
  driver: Driver | null;
  onClose: () => void;
  onSave: () => void;
}

export default function DriverModal({ driver, onClose, onSave }: Props) {
  const isEdit = !!driver;
  const { showToast } = useToast();
  const [form, setForm] = useState({
    fullName: driver?.fullName || '',
    phone: driver?.phone || '',
    status: driver?.status || 'ACTIVE',
    note: driver?.note || '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const fullName = form.fullName.trim();
    const phone = form.phone.trim();

    if (fullName.length < 5) {
      return 'Введите полное ФИО (минимум 5 символов)';
    }

    const phoneRegex = /^[+\d][\d\s()\-]{6,20}$/;
    if (!phoneRegex.test(phone)) {
      return 'Введите корректный номер телефона';
    }

    if (form.note.trim().length > 250) {
      return 'Примечание должно быть не длиннее 250 символов';
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
        ...form,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        note: form.note.trim(),
      };

      if (isEdit) {
        await driversApi.update(driver!.id, payload);
      } else {
        await driversApi.create(payload);
      }
      showToast(isEdit ? 'Водитель обновлён' : 'Водитель добавлен', 'success');
      onSave();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Ошибка сохранения';
      setError(message);
      showToast(message, 'error');
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
