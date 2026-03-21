import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Filter, Printer, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { waybillsApi } from '../api';
import type { Waybill } from '../types';
import { useToast } from '../context/ToastContext';
import { formatDateTime } from '../utils/helpers';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWaybillStatusLabel(status: Waybill['status']): string {
  if (status === 'DRAFT') return 'Черновик';
  if (status === 'ISSUED') return 'Выдан';
  return 'Закрыт';
}

function getWaybillStatusClass(status: Waybill['status']): string {
  if (status === 'DRAFT') return 'badge-warning';
  if (status === 'ISSUED') return 'badge-primary';
  return 'badge-success';
}

export default function WaybillsPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Waybill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState(toLocalDateString(new Date()));
  const [status, setStatus] = useState<'ALL' | 'DRAFT' | 'ISSUED' | 'CLOSED'>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Waybill | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await waybillsApi.getAll({
        date,
        status: status === 'ALL' ? undefined : status,
        search: search.trim() || undefined,
      });
      setRows(res.data);
      setError('');
    } catch (err: any) {
      const message = err.response?.data?.error || 'Не удалось загрузить путевые листы';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [date, status]);

  const stats = useMemo(() => ({
    total: rows.length,
    drafts: rows.filter((r) => r.status === 'DRAFT').length,
    issued: rows.filter((r) => r.status === 'ISSUED').length,
    closed: rows.filter((r) => r.status === 'CLOSED').length,
  }), [rows]);

  const autoGenerate = async () => {
    try {
      const res = await waybillsApi.autoGenerate(date);
      showToast(
        `Сформировано ${res.data.createdCount} листов${res.data.skippedCount ? `, пропущено ${res.data.skippedCount}` : ''}`,
        'success'
      );
      load();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Не удалось выполнить автогенерацию';
      showToast(message, 'error');
    }
  };

  const saveSelected = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      await waybillsApi.update(selected.id, {
        status: selected.status,
        driverLicenseNumber: selected.driverLicenseNumber,
        odometerStart: selected.odometerStart,
        odometerEnd: selected.odometerEnd,
        fuelType: selected.fuelType,
        fuelIssuedLiters: selected.fuelIssuedLiters,
        fuelRemainingLiters: selected.fuelRemainingLiters,
        mechanicName: selected.mechanicName,
        medicName: selected.medicName,
        preTripCheckPassed: selected.preTripCheckPassed,
        postTripCheckPassed: selected.postTripCheckPassed,
        preTripMedicalPassed: selected.preTripMedicalPassed,
        postTripMedicalPassed: selected.postTripMedicalPassed,
        notes: selected.notes,
      });
      showToast('Путевой лист сохранен', 'success');
      await load();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Не удалось сохранить путевой лист';
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const printWaybill = async (item: Waybill) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Путевой лист ${item.number}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{margin:0 0 10px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #ccc;padding:8px;vertical-align:top}small{color:#666}</style>
    </head><body>
    <h1>Путевой лист ${item.number}</h1>
    <small>Сформировано автоматически. Перед использованием проверьте соответствие действующим требованиям РК.</small>
    <table>
      <tr><th>Организация</th><td>${item.organizationName}</td><th>БИН</th><td>${item.organizationBin || '-'}</td></tr>
      <tr><th>Дата</th><td>${new Date(item.issueDate).toLocaleDateString('ru-RU')}</td><th>Период</th><td>${new Date(item.validFrom).toLocaleString('ru-RU')} - ${new Date(item.validTo).toLocaleString('ru-RU')}</td></tr>
      <tr><th>Водитель</th><td>${item.driverName}</td><th>Удостоверение</th><td>${item.driverLicenseNumber || '-'}</td></tr>
      <tr><th>ТС</th><td>${item.vehicleBrand} ${item.vehicleModel}</td><th>Госномер</th><td>${item.vehiclePlateNumber}</td></tr>
      <tr><th>Маршрут</th><td colspan="3">${item.route}</td></tr>
      <tr><th>Одометр (выезд)</th><td>${item.odometerStart ?? '-'}</td><th>Одометр (возврат)</th><td>${item.odometerEnd ?? '-'}</td></tr>
      <tr><th>Механик</th><td>${item.mechanicName || '-'}</td><th>Медработник</th><td>${item.medicName || '-'}</td></tr>
      <tr><th>Примечание</th><td colspan="3">${item.notes || '-'}</td></tr>
    </table>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) {
      showToast('Не удалось открыть окно печати', 'error');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();

    try {
      await waybillsApi.markPrinted(item.id);
      load();
    } catch {
      // no-op
    }
  };

  const exportPdf = async (item: Waybill) => {
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`Путевой лист ${item.number}`, 14, 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Автоматически сформировано. Проверьте соответствие актуальным требованиям РК.', 14, 20);

      const qrPayload = JSON.stringify({
        number: item.number,
        issueDate: item.issueDate,
        driver: item.driverName,
        plate: item.vehiclePlateNumber,
        route: item.route,
      });
      const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 256 });
      doc.addImage(qrDataUrl, 'PNG', 165, 10, 30, 30);

      const barcodeCanvas = document.createElement('canvas');
      JsBarcode(barcodeCanvas, item.number, {
        format: 'CODE128',
        width: 1.4,
        height: 26,
        displayValue: true,
        fontSize: 10,
      });
      const barcodeDataUrl = barcodeCanvas.toDataURL('image/png');
      doc.addImage(barcodeDataUrl, 'PNG', 14, 24, 110, 20);

      let y = 52;
      const line = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(value || '-', 62, y);
        y += 6;
      };

      line('Организация', item.organizationName);
      line('БИН', item.organizationBin || '-');
      line('Серия', `${item.seriesBranchCode}/${item.seriesTypeCode}/${item.seriesMonth}`);
      line('Дата выдачи', new Date(item.issueDate).toLocaleDateString('ru-RU'));
      line('Период', `${new Date(item.validFrom).toLocaleString('ru-RU')} - ${new Date(item.validTo).toLocaleString('ru-RU')}`);
      line('Водитель', item.driverName);
      line('Удостоверение', item.driverLicenseNumber || '-');
      line('Авто', `${item.vehicleBrand} ${item.vehicleModel} (${item.vehiclePlateNumber})`);
      line('Маршрут', item.route);
      line('Одометр выезд/возврат', `${item.odometerStart ?? '-'} / ${item.odometerEnd ?? '-'}`);
      line('Механик/Медработник', `${item.mechanicName || '-'} / ${item.medicName || '-'}`);
      line('Статус', getWaybillStatusLabel(item.status));

      if (item.notes) {
        doc.setFont('helvetica', 'bold');
        doc.text('Примечание:', 14, y + 2);
        doc.setFont('helvetica', 'normal');
        const wrapped = doc.splitTextToSize(item.notes, 180);
        doc.text(wrapped, 14, y + 8);
      }

      doc.save(`waybill-${item.number}.pdf`);
      await waybillsApi.markPrinted(item.id);
      showToast('PDF сформирован', 'success');
      load();
    } catch (err: any) {
      const message = err?.message || 'Не удалось сформировать PDF';
      showToast(message, 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Путевые листы</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={16} /> Обновить</button>
          <button className="btn btn-primary" onClick={autoGenerate}><FileText size={16} /> Автосформировать за дату</button>
        </div>
      </div>

      <div className="page-content">
        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <div className="alert alert-warning" style={{ marginBottom: 12 }}>
          <ShieldCheck size={16} />
          <span>Шаблон формируется автоматически по обязательным реквизитам. Для юридически значимого применения требуется проверка ответственным специалистом по текущим нормам РК.</span>
        </div>

        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Всего</div></div>
          <div className="stat-card"><div className="stat-value">{stats.drafts}</div><div className="stat-label">Черновики</div></div>
          <div className="stat-card"><div className="stat-value">{stats.issued}</div><div className="stat-label">Выдано</div></div>
          <div className="stat-card"><div className="stat-value">{stats.closed}</div><div className="stat-label">Закрыто</div></div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="list-toolbar" style={{ gridTemplateColumns: 'minmax(220px,1fr) minmax(160px,220px) minmax(160px,200px) auto' }}>
            <div className="search-input-wrapper">
              <Search size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Номер, маршрут, водитель..." />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--gray-500)' }}>Дата</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--gray-500)' }}>Статус</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="ALL">Все</option>
                <option value="DRAFT">Черновик</option>
                <option value="ISSUED">Выдан</option>
                <option value="CLOSED">Закрыт</option>
              </select>
            </div>
            <button className="btn btn-secondary" onClick={load}><Filter size={16} /> Применить</button>
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div className="table-skeleton">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton-row" />)}</div>
          ) : rows.length === 0 ? (
            <div className="empty-state"><FileText size={40} /><p>Путевые листы не найдены</p></div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Дата/период</th>
                    <th>Водитель</th>
                    <th>ТС</th>
                    <th>Маршрут</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.id}>
                      <td>{item.number}</td>
                      <td>
                        <div>{new Date(item.issueDate).toLocaleDateString('ru-RU')}</div>
                        <div style={{ color: 'var(--gray-500)', fontSize: 12 }}>{formatDateTime(item.validFrom)} - {formatDateTime(item.validTo)}</div>
                      </td>
                      <td>{item.driverName}</td>
                      <td>{item.vehicleBrand} {item.vehicleModel}<div className="chip">{item.vehiclePlateNumber}</div></td>
                      <td>{item.route}</td>
                      <td><span className={`badge ${getWaybillStatusClass(item.status)}`}>{getWaybillStatusLabel(item.status)}</span></td>
                      <td>
                        <div className="actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(item)}>Открыть</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => exportPdf(item)}>PDF</button>
                          <button className="btn btn-ghost btn-icon" onClick={() => printWaybill(item)} title="Печать"><Printer size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
            <div className="modal modal-lg">
              <div className="modal-header">
                <div className="modal-title">Путевой лист {selected.number}</div>
                <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label>Статус</label>
                    <select value={selected.status} onChange={(e) => setSelected({ ...selected, status: e.target.value as Waybill['status'] })}>
                      <option value="DRAFT">Черновик</option>
                      <option value="ISSUED">Выдан</option>
                      <option value="CLOSED">Закрыт</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Вод. удостоверение</label>
                    <input value={selected.driverLicenseNumber || ''} onChange={(e) => setSelected({ ...selected, driverLicenseNumber: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Одометр выезд</label>
                    <input type="number" value={selected.odometerStart ?? ''} onChange={(e) => setSelected({ ...selected, odometerStart: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <div className="form-group"><label>Одометр возврат</label>
                    <input type="number" value={selected.odometerEnd ?? ''} onChange={(e) => setSelected({ ...selected, odometerEnd: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Механик</label>
                    <input value={selected.mechanicName || ''} onChange={(e) => setSelected({ ...selected, mechanicName: e.target.value })} />
                  </div>
                  <div className="form-group"><label>Медработник</label>
                    <input value={selected.medicName || ''} onChange={(e) => setSelected({ ...selected, medicName: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label><input type="checkbox" checked={!!selected.preTripCheckPassed} onChange={(e) => setSelected({ ...selected, preTripCheckPassed: e.target.checked })} /> Предрейсовый техосмотр</label></div>
                  <div className="form-group"><label><input type="checkbox" checked={!!selected.preTripMedicalPassed} onChange={(e) => setSelected({ ...selected, preTripMedicalPassed: e.target.checked })} /> Предрейсовый медосмотр</label></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label><input type="checkbox" checked={!!selected.postTripCheckPassed} onChange={(e) => setSelected({ ...selected, postTripCheckPassed: e.target.checked })} /> Послерейсовый техосмотр</label></div>
                  <div className="form-group"><label><input type="checkbox" checked={!!selected.postTripMedicalPassed} onChange={(e) => setSelected({ ...selected, postTripMedicalPassed: e.target.checked })} /> Послерейсовый медосмотр</label></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Тип топлива</label>
                    <input value={selected.fuelType || ''} onChange={(e) => setSelected({ ...selected, fuelType: e.target.value })} />
                  </div>
                  <div className="form-group"><label>Выдано топлива (л)</label>
                    <input type="number" step="0.1" value={selected.fuelIssuedLiters ?? ''} onChange={(e) => setSelected({ ...selected, fuelIssuedLiters: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Остаток топлива (л)</label>
                    <input type="number" step="0.1" value={selected.fuelRemainingLiters ?? ''} onChange={(e) => setSelected({ ...selected, fuelRemainingLiters: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <div className="form-group" />
                </div>
                <div className="form-group"><label>Примечание</label>
                  <textarea value={selected.notes || ''} onChange={(e) => setSelected({ ...selected, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => exportPdf(selected)}>PDF</button>
                <button className="btn btn-secondary" onClick={() => setSelected(null)}>Закрыть</button>
                <button className="btn btn-primary" disabled={saving} onClick={saveSelected}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
