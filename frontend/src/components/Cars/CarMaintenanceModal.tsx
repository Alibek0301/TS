import React, { useEffect, useState } from 'react';
import { X, Wrench } from 'lucide-react';
import { carsApi } from '../../api';
import type { Car, CarMaintenance, CarMaintenanceType } from '../../types';
import { formatDateTime } from '../../utils/helpers';
import { useToast } from '../../context/ToastContext';

interface Props {
  car: Car;
  onClose: () => void;
  onUpdated: () => void;
}

const maintenanceTypeOptions: Array<{ value: CarMaintenanceType; label: string }> = [
  { value: 'OIL_CHANGE', label: 'Замена масла' },
  { value: 'FLUID_CHANGE', label: 'Замена жидкостей' },
  { value: 'INSPECTION', label: 'Плановый осмотр' },
  { value: 'REPAIR', label: 'Ремонт' },
  { value: 'OTHER', label: 'Прочее' },
];

function getMaintenanceTypeLabel(type: CarMaintenanceType): string {
  const map: Record<CarMaintenanceType, string> = {
    OIL_CHANGE: 'Замена масла',
    FLUID_CHANGE: 'Жидкости',
    INSPECTION: 'Осмотр',
    REPAIR: 'Ремонт',
    OTHER: 'Прочее',
  };
  return map[type] || type;
}

export default function CarMaintenanceModal({ car, onClose, onUpdated }: Props) {
  const { showToast } = useToast();
  const [records, setRecords] = useState<CarMaintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    type: 'INSPECTION' as CarMaintenanceType,
    mileage: car.mileage?.toString() || '0',
    performedAt: new Date().toISOString().slice(0, 16),
    notes: '',
    cost: '',
    oilChanged: false,
    coolantChanged: false,
    brakeFluidChanged: false,
    transmissionFluidChanged: false,
    nextServiceMileage: car.nextServiceMileage ? String(car.nextServiceMileage) : '',
    setFreeAfterService: false,
  });

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await carsApi.getMaintenance(car.id);
      setRecords(res.data);
      setError('');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Не удалось загрузить историю ТО';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [car.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const mileageNum = Number(form.mileage);
    if (!Number.isInteger(mileageNum) || mileageNum < 0) {
      setError('Пробег должен быть целым числом >= 0');
      return;
    }

    const costNum = form.cost.trim() ? Number(form.cost) : undefined;
    if (costNum !== undefined && (!Number.isFinite(costNum) || costNum < 0)) {
      setError('Стоимость должна быть числом >= 0');
      return;
    }

    const nextServiceMileageNum = form.nextServiceMileage.trim() ? Number(form.nextServiceMileage) : undefined;
    if (nextServiceMileageNum !== undefined && (!Number.isInteger(nextServiceMileageNum) || nextServiceMileageNum <= 0)) {
      setError('Пробег следующего ТО должен быть целым числом > 0');
      return;
    }

    setSaving(true);
    try {
      await carsApi.addMaintenance(car.id, {
        type: form.type,
        mileage: mileageNum,
        performedAt: new Date(form.performedAt).toISOString(),
        notes: form.notes.trim() || undefined,
        cost: costNum,
        oilChanged: form.oilChanged,
        coolantChanged: form.coolantChanged,
        brakeFluidChanged: form.brakeFluidChanged,
        transmissionFluidChanged: form.transmissionFluidChanged,
        nextServiceMileage: nextServiceMileageNum,
        setFreeAfterService: form.setFreeAfterService,
      });
      showToast('Запись ТО добавлена', 'success');
      setForm({
        ...form,
        notes: '',
        cost: '',
        oilChanged: false,
        coolantChanged: false,
        brakeFluidChanged: false,
        transmissionFluidChanged: false,
        setFreeAfterService: false,
      });
      await loadHistory();
      onUpdated();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Ошибка сохранения записи ТО';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">ТО и состояние: {car.brand} {car.model} ({car.plateNumber})</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div className="card-title" style={{ marginBottom: 0 }}>Текущее состояние</div>
              </div>
              <div className="form-row">
                <div>
                  <div className="entity-sub">Пробег</div>
                  <div className="entity-name">{car.mileage.toLocaleString('ru-RU')} км</div>
                </div>
                <div>
                  <div className="entity-sub">Следующее ТО</div>
                  <div className="entity-name">
                    {car.nextServiceMileage ? `${car.nextServiceMileage.toLocaleString('ru-RU')} км` : 'Не задано'}
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div className="card-title" style={{ marginBottom: 0 }}>Добавить запись обслуживания</div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="required">Тип</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CarMaintenanceType })}>
                    {maintenanceTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
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
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="required">Дата и время</label>
                  <input
                    type="datetime-local"
                    value={form.performedAt}
                    onChange={(e) => setForm({ ...form, performedAt: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Стоимость</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.cost}
                    onChange={(e) => setForm({ ...form, cost: e.target.value })}
                    placeholder="25000"
                  />
                </div>
              </div>

              <div className="form-row">
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
                <div className="form-group">
                  <label>Заметки</label>
                  <input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Что было выполнено"
                  />
                </div>
              </div>

              <div className="form-row">
                <label><input type="checkbox" checked={form.oilChanged} onChange={(e) => setForm({ ...form, oilChanged: e.target.checked })} /> Замена масла</label>
                <label><input type="checkbox" checked={form.coolantChanged} onChange={(e) => setForm({ ...form, coolantChanged: e.target.checked })} /> Замена охлаждающей жидкости</label>
              </div>
              <div className="form-row">
                <label><input type="checkbox" checked={form.brakeFluidChanged} onChange={(e) => setForm({ ...form, brakeFluidChanged: e.target.checked })} /> Замена тормозной жидкости</label>
                <label><input type="checkbox" checked={form.transmissionFluidChanged} onChange={(e) => setForm({ ...form, transmissionFluidChanged: e.target.checked })} /> Замена трансмиссионной жидкости</label>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label><input type="checkbox" checked={form.setFreeAfterService} onChange={(e) => setForm({ ...form, setFreeAfterService: e.target.checked })} /> Снять с ремонта/ТО и перевести в статус "Свободна"</label>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title" style={{ marginBottom: 0 }}>История ТО</div>
              </div>

              {loading ? (
                <div className="loading"><div className="spinner" /></div>
              ) : records.length === 0 ? (
                <div className="empty-state">
                  <Wrench size={40} />
                  <p>Записей обслуживания пока нет</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Дата</th>
                        <th>Тип</th>
                        <th>Пробег</th>
                        <th>Работы</th>
                        <th>Комментарий</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={r.id}>
                          <td>{formatDateTime(r.performedAt)}</td>
                          <td><span className="badge badge-info">{getMaintenanceTypeLabel(r.type)}</span></td>
                          <td>{r.mileage.toLocaleString('ru-RU')} км</td>
                          <td>
                            {[r.oilChanged && 'масло', r.coolantChanged && 'охл.жидкость', r.brakeFluidChanged && 'тормозная', r.transmissionFluidChanged && 'трансмиссия']
                              .filter(Boolean)
                              .join(', ') || '-'}
                          </td>
                          <td>{r.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Закрыть</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Сохранение...' : 'Добавить запись'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
