import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../utils/helpers';
import {
  LayoutDashboard,
  Car,
  Users,
  CalendarClock,
  LogOut,
  UserCog,
  Clock3,
  ListChecks,
  Wrench,
  BarChart3,
  Menu,
  X,
  FileText,
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const closeSidebar = () => setIsSidebarOpen(false);

  const onTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    setTouchStartX(e.changedTouches[0].clientX);
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    if (touchStartX === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX;

    if (isSidebarOpen && diff < -50) {
      setIsSidebarOpen(false);
    }

    if (!isSidebarOpen && touchStartX < 24 && diff > 70) {
      setIsSidebarOpen(true);
    }

    setTouchStartX(null);
  };

  return (
    <div className="app-layout">
      <div className={`sidebar-backdrop ${isSidebarOpen ? 'show' : ''}`} onClick={closeSidebar} />

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="sidebar-logo">
          <div>
            <h1>TransferSchedule</h1>
            <span>График трансферов</span>
          </div>
          <button className="mobile-close-btn" onClick={closeSidebar} title="Закрыть меню">
            <X size={18} />
          </button>
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
            {user?.role !== 'DRIVER' && (
              <NavLink to="/ops" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <ListChecks size={18} />
                Оперативная смена
              </NavLink>
            )}
            {user?.role === 'DRIVER' && (
              <NavLink to="/my-shifts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Clock3 size={18} />
                Мои смены
              </NavLink>
            )}
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
              <NavLink to="/cars-maintenance" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Wrench size={18} />
                Журнал ТО
              </NavLink>
              <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <BarChart3 size={18} />
                Аналитика
              </NavLink>
              <NavLink to="/waybills" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <FileText size={18} />
                Путевые листы
              </NavLink>
            </div>
          )}

          {user?.role === 'ADMIN' && (
            <div className="nav-group">
              <div className="nav-group-label">Администрирование</div>
              <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <UserCog size={18} />
                Пользователи
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
      <main className="main-content" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="mobile-topbar">
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)} title="Открыть меню">
            <Menu size={18} />
          </button>
          <div className="mobile-topbar-title">TransferSchedule</div>
          <button className="mobile-menu-btn" onClick={logout} title="Выйти">
            <LogOut size={18} />
          </button>
        </div>
        <Outlet />

        <nav className="mobile-bottom-nav">
          <NavLink to="/" end className={({ isActive }) => `mobile-bottom-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={17} />
            <span>Главная</span>
          </NavLink>
          <NavLink to="/transfers" className={({ isActive }) => `mobile-bottom-item ${isActive ? 'active' : ''}`}>
            <CalendarClock size={17} />
            <span>Заказы</span>
          </NavLink>
          {user?.role === 'DRIVER' ? (
            <NavLink to="/my-shifts" className={({ isActive }) => `mobile-bottom-item ${isActive ? 'active' : ''}`}>
              <Clock3 size={17} />
              <span>Смены</span>
            </NavLink>
          ) : (
            <NavLink to="/cars" className={({ isActive }) => `mobile-bottom-item ${isActive ? 'active' : ''}`}>
              <Car size={17} />
              <span>Авто</span>
            </NavLink>
          )}
          {user?.role !== 'DRIVER' && (
            <NavLink to="/analytics" className={({ isActive }) => `mobile-bottom-item ${isActive ? 'active' : ''}`}>
              <BarChart3 size={17} />
              <span>Аналитика</span>
            </NavLink>
          )}
        </nav>
      </main>
    </div>
  );
}
