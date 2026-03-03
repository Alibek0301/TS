import React, { useState } from 'react';
import { authApi } from '../api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role: string) => {
    if (role === 'admin') { setEmail('admin@transfer.com'); setPassword('admin123'); }
    if (role === 'dispatcher') { setEmail('dispatcher@transfer.com'); setPassword('dispatcher123'); }
    if (role === 'driver') { setEmail('driver@transfer.com'); setPassword('driver123'); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>🚗 TransferSchedule</h1>
          <p>Система управления трансферами</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="alert alert-error">
              ⚠️ {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@transfer.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="divider" />

        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
          <p style={{ marginBottom: 8, fontWeight: 600 }}>Демо-аккаунты:</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fillDemo('admin')}
              type="button"
            >
              Администратор
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fillDemo('dispatcher')}
              type="button"
            >
              Диспетчер
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fillDemo('driver')}
              type="button"
            >
              Водитель
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
