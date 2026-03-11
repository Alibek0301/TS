import React, { useState } from 'react';
import type { Car } from '../../types';
import { carsApi } from '../../api';
import { X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface Props {
  car: Car | null;
  onClose: () => void;
  onSave: () => void;
}

export default function CarModal({ car, onClose, onSave }: Props) {
  const isEdit = !!car;
  const { showToast } = useToast();
  const [form, setForm] = useState({
    brand: car?.brand || '',
    model: car?.model || '',
    plateNumber: car?.plateNumber || '',
    status: car?.status || 'FREE',
    mileage: car?.mileage?.toString() || '0',
    nextServiceMileage: car?.nextServiceMileage ? String(car.nextServiceMileage) : '',
    isUnderRepair: car?.isUnderRepair || false,
    repairNotes: car?.repairNotes || '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const brand = form.brand.trim();
    const model = form.model.trim();
    const plateNumber = form.plateNumber.trim().toUpperCase();

    if (brand.length < 2) {
      return 'Марка должна содержать минимум 2 символа';
    }

    if (model.length < 1) {
      return 'Укажите модель автомобиля';
    }

    const plateRegex = /^[A-ZА-Я0-9\-\s]{5,12}$/i;
    if (!plateRegex.test(plateNumber)) {
      return 'Введите корректный госномер';
    }

    const mileageNum = Number(form.mileage);
    if (!Number.isInteger(mileageNum) || mileageNum < 0) {
      return 'Пробег должен быть целым числом >= 0';
    }

    if (form.nextServiceMileage.trim()) {
      const nextServiceMileageNum = Number(form.nextServiceMileage);
      if (!Number.isInteger(nextServiceMileageNum) || nextServiceMileageNum <= 0) {
        return 'Пробег следующего ТО должен быть целым числом > 0';
      }
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
        brand: form.brand.trim(),
        model: form.model.trim(),
        plateNumber: form.plateNumber.trim().toUpperCase(),
        mileage: Number(form.mileage),
        nextServiceMileage: form.nextServiceMileage.trim() ? Number(form.nextServiceMileage) : null,
        repairNotes: form.repairNotes.trim() || null,
      };

      if (isEdit) {
        await carsApi.update(car!.id, payload);
      } else {
        await carsApi.create(payload);
      }
      showToast(isEdit ? 'Автомобиль обновлён' : 'Автомобиль добавлен', 'success');
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

            <div className="form-row">
              <div className="form-group">
                <label className="required">Пробег (км)</label>
                <input
                  type="number"
                  min={0}
                  value={form.mileage}
                  onChange={(e) => setForm({ ...form, mileage: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Следующее ТО (км)</label>
                <input
                  type="number"
                  min={1}
                  value={form.nextServiceMileage}
                  onChange={(e) => setForm({ ...form, nextServiceMileage: e.target.value })}
                  placeholder="150000"
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={form.isUnderRepair}
                  onChange={(e) => setForm({ ...form, isUnderRepair: e.target.checked })}
                />
                {' '}Автомобиль на ремонте
              </label>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Примечание по ремонту</label>
              <textarea
                value={form.repairNotes}
                onChange={(e) => setForm({ ...form, repairNotes: e.target.value })}
                placeholder="Описание неисправности или текущих работ"
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
