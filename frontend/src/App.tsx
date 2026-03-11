import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TransfersPage from './pages/TransfersPage';
import DriversPage from './pages/DriversPage';
import CarsPage from './pages/CarsPage';
import UsersPage from './pages/UsersPage';
import MyShiftsPage from './pages/MyShiftsPage';
import OpsPage from './pages/OpsPage';
import CarMaintenanceLogPage from './pages/CarMaintenanceLogPage';
import EntityAnalyticsPage from './pages/EntityAnalyticsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="loading" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminOrDispatcherRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role === 'DRIVER') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function DriverRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'DRIVER') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="transfers" element={<TransfersPage />} />
        <Route
          path="drivers"
          element={
            <AdminOrDispatcherRoute>
              <DriversPage />
            </AdminOrDispatcherRoute>
          }
        />
        <Route
          path="cars"
          element={
            <AdminOrDispatcherRoute>
              <CarsPage />
            </AdminOrDispatcherRoute>
          }
        />
        <Route
          path="ops"
          element={
            <AdminOrDispatcherRoute>
              <OpsPage />
            </AdminOrDispatcherRoute>
          }
        />
        <Route
          path="cars-maintenance"
          element={
            <AdminOrDispatcherRoute>
              <CarMaintenanceLogPage />
            </AdminOrDispatcherRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <AdminOrDispatcherRoute>
              <EntityAnalyticsPage />
            </AdminOrDispatcherRoute>
          }
        />
        <Route
          path="users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="my-shifts"
          element={
            <DriverRoute>
              <MyShiftsPage />
            </DriverRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
