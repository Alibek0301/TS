import React, { useState } from 'react';
import type { Car } from '../../types';
import { carsApi } from '../../api';
import { X } from 'lucide-react';

interface Props {
  car: Car | null;
  onClose: () => void;
  onSave: () => void;
}

export default function CarModal({ car, onClose, onSave }: Props) {
  const isEdit = !!car;
  const [form, setForm] = useState({
    brand: car?.brand || '',
    model: car?.model || '',
    plateNumber: car?.plateNumber || '',
    status: car?.status || 'FREE',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isEdit) {
        await carsApi.update(car!.id, form);
      } else {
        await carsApi.create(form);
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
          <div className="modal-title">{isEdit ? 'Редактировать автомобиль' : 'Добавить автомобиль'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">⚠️ {error}</div>}

            <div className="form-row">
              <div className="form-group">
                <label className="required">Марка</label>
                <input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="Mercedes-Benz"
                  required
                />
              </div>
              <div className="form-group">
                <label className="required">Модель</label>
                <input
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="S-Class"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="required">Госномер</label>
                <input
                  value={form.plateNumber}
                  onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                  placeholder="A001AA01"
                  required
                />
              </div>
              <div className="form-group">
                <label>Статус</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Car['status'] })}>
                  <option value="FREE">Свободна</option>
                  <option value="MAINTENANCE">На ТО</option>
                  <option value="BUSY">Занята</option>
                </select>
              </div>
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
