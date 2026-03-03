import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../utils/helpers';
import {
  LayoutDashboard,
  Car,
  Users,
  CalendarClock,
  LogOut,
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div>
            <h1>TransferSchedule</h1>
            <span>График трансферов</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group">
            <div className="nav-group-label">Главное</div>
            <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={18} />
              Дашборд
            </NavLink>
            <NavLink to="/transfers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <CalendarClock size={18} />
              Трансферы
            </NavLink>
          </div>

          {user?.role !== 'DRIVER' && (
            <div className="nav-group">
              <div className="nav-group-label">Справочники</div>
              <NavLink to="/drivers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Users size={18} />
                Водители
              </NavLink>
              <NavLink to="/cars" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Car size={18} />
                Автомобили
              </NavLink>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{getRoleLabel(user?.role || '')}</div>
            </div>
            <button className="logout-btn" onClick={logout} title="Выйти">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
