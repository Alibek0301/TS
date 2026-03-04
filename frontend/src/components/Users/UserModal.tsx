import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { Driver, ManagedUser } from '../../types';
import { usersApi } from '../../api';
import { useToast } from '../../context/ToastContext';

interface Props {
  user: ManagedUser | null;
  drivers: Driver[];
  users: ManagedUser[];
  onClose: () => void;
  onSave: () => void;
}

export default function UserModal({ user, drivers, users, onClose, onSave }: Props) {
  const isEdit = !!user;
  const { showToast } = useToast();

  const [form, setForm] = useState({
    email: user?.email || '',
    password: '',
    name: user?.name || '',
    role: user?.role || 'DISPATCHER',
    driverId: user?.driverId ? String(user.driverId) : '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const busyDriverIds = useMemo(
    () => users
      .filter((u) => u.role === 'DRIVER' && u.driverId && u.id !== user?.id)
      .map((u) => u.driverId as number),
    [users, user?.id]
  );

  const validate = () => {
    const email = form.email.trim().toLowerCase();
    const name = form.name.trim();

    if (!email || !name) {
      return 'Email и имя обязательны';
    }

    if (!isEdit && form.password.length < 6) {
      return 'Для нового пользователя пароль должен быть минимум 6 символов';
    }

    if (isEdit && form.password && form.password.length < 6) {
      return 'Новый пароль должен быть минимум 6 символов';
    }

    if (form.role === 'DRIVER' && !form.driverId) {
      return 'Для роли DRIVER нужно выбрать водителя';
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

    try {
      setLoading(true);

      const payload = {
        email: form.email.trim().toLowerCase(),
        name: form.name.trim(),
        role: form.role as 'ADMIN' | 'DISPATCHER' | 'DRIVER',
        ...(form.password ? { password: form.password } : {}),
        ...(form.role === 'DRIVER' && form.driverId ? { driverId: Number(form.driverId) } : {}),
      };

      if (isEdit) {
        await usersApi.update(user!.id, payload);
        showToast('Пользователь обновлён', 'success');
      } else {
        await usersApi.create(payload as {
          email: string;
          password: string;
          name: string;
          role: 'ADMIN' | 'DISPATCHER' | 'DRIVER';
          driverId?: number;
        });
        showToast('Пользователь создан', 'success');
      }

      onSave();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Ошибка сохранения пользователя';
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
          <div className="modal-title">{isEdit ? 'Редактировать пользователя' : 'Создать пользователя'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">⚠️ {error}</div>}

            <div className="form-group">
              <label className="required">Имя</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Имя пользователя"
                required
              />
            </div>

            <div className="form-group">
              <label className="required">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label>{isEdit ? 'Новый пароль (опционально)' : 'Пароль'}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={isEdit ? 'Оставьте пустым, чтобы не менять' : 'Минимум 6 символов'}
              />
            </div>

            <div className="form-group">
              <label className="required">Роль</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as 'ADMIN' | 'DISPATCHER' | 'DRIVER', driverId: '' })}
              >
                <option value="DISPATCHER">Диспетчер</option>
                <option value="DRIVER">Водитель</option>
                <option value="ADMIN">Администратор</option>
              </select>
            </div>

            {form.role === 'DRIVER' && (
              <div className="form-group">
                <label className="required">Привязка к водителю</label>
                <select
                  value={form.driverId}
                  onChange={(e) => setForm({ ...form, driverId: e.target.value })}
                  required
                >
                  <option value="">Выберите водителя</option>
                  {drivers.map((driver) => {
                    const disabled = busyDriverIds.includes(driver.id);
                    return (
                      <option key={driver.id} value={driver.id} disabled={disabled}>
                        {driver.fullName} {disabled ? '(уже привязан)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
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
