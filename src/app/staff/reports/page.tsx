"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/staff-shell";
import { paymentMethodLabel } from "@/components/staff/status-copy";
import { formatArs } from "@/lib/format";
import type { PaymentMethodValue } from "@/modules/payments/payment-methods";
import { salesReportCsv } from "@/modules/reports/sales-csv";
import type { SalesReport } from "@/modules/reports/sales-report";

type Report = SalesReport;

function localDay(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function ReportsPage() {
  const router = useRouter();
  const [from, setFrom] = useState(() => localDay());
  const [to, setTo] = useState(() => localDay());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (rangeFrom: string, rangeTo: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/staff/reports?from=${rangeFrom}&to=${rangeTo}`, { cache: "no-store" });
      if (response.status === 401) { router.push("/staff/login"); return; }
      if (response.status === 403) throw new Error("Solo una persona administradora puede ver los reportes.");
      if (!response.ok) throw new Error("No se pudo cargar el reporte. Revisá las fechas e intentá de nuevo.");
      setReport(await response.json() as Report);
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el reporte.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(localDay(), localDay()); }, 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  function applyRange(rangeFrom: string, rangeTo: string) {
    setFrom(rangeFrom);
    setTo(rangeTo);
    void load(rangeFrom, rangeTo);
  }

  function downloadCsv() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([salesReportCsv(report, (method) => paymentMethodLabel(method as PaymentMethodValue))], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `cierre-${report.from}${report.to === report.from ? "" : `-a-${report.to}`}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const average = report && report.orders > 0 ? Math.round(report.totalCents / report.orders) : 0;

  return (
    <StaffShell title="Reportes" section="reports" role="ADMIN">
      <section className="staff-panel" aria-labelledby="reports-title">
        <div className="panel-heading"><div><p className="eyebrow">Cierre de caja y ventas</p><h2 id="reports-title">Ventas del período</h2></div><div className="report-actions"><button className="button-secondary report-print" type="button" disabled={!report} onClick={downloadCsv}>Descargar Excel (CSV)</button><button className="button-secondary report-print" type="button" onClick={() => window.print()}>Imprimir</button></div></div>
        <form className="report-range" onSubmit={(event) => { event.preventDefault(); void load(from, to); }}>
          <label className="form-field"><span>Desde</span><input className="form-input" type="date" required max={to} value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="form-field"><span>Hasta</span><input className="form-input" type="date" required min={from} value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <button className="primary-link" type="submit">Ver</button>
          <div className="report-shortcuts">
            <button className="button-text" type="button" onClick={() => applyRange(localDay(), localDay())}>Hoy</button>
            <button className="button-text" type="button" onClick={() => applyRange(localDay(-1), localDay(-1))}>Ayer</button>
            <button className="button-text" type="button" onClick={() => applyRange(localDay(-6), localDay())}>Últimos 7 días</button>
            <button className="button-text" type="button" onClick={() => applyRange(localDay(-29), localDay())}>Últimos 30 días</button>
          </div>
        </form>

        {loading ? <p className="loading-state" role="status">Cargando reporte…</p> : error ? <p className="error-state" role="alert">{error}</p> : report && (
          <>
            <dl className="report-totals">
              <div><dt>Total vendido</dt><dd>{formatArs(report.totalCents)}</dd></div>
              <div><dt>Pedidos cobrados</dt><dd>{report.orders}</dd></div>
              <div><dt>Ticket promedio</dt><dd>{formatArs(average)}</dd></div>
              <div><dt>Ganancia</dt><dd>{report.costCents === 0 && report.profitCents === 0 ? "Sin datos" : formatArs(report.profitCents)}</dd></div>
              <div><dt>Cancelados</dt><dd>{report.cancelledOrders}</dd></div>
              <div><dt>Esperando pago</dt><dd>{report.awaitingPaymentOrders}</dd></div>
            </dl>
            {report.uncostedCents > 0 ? <p className="muted report-note">La ganancia no incluye {formatArs(report.uncostedCents)} de ventas de productos sin costo cargado. Cargá el costo en Carta para sumarlos.</p> : null}

            <h3>Por medio de pago</h3>
            {report.byPaymentMethod.length === 0 ? <p className="empty-state">No hay cobros en este período.</p> : (
              <table className="report-table">
                <thead><tr><th scope="col">Medio</th><th scope="col">Cobros</th><th scope="col">Total</th></tr></thead>
                <tbody>{report.byPaymentMethod.map((row) => <tr key={row.method}><th scope="row">{paymentMethodLabel(row.method as PaymentMethodValue)}</th><td>{row.payments}</td><td>{formatArs(row.totalCents)}</td></tr>)}</tbody>
              </table>
            )}

            <h3>Por producto</h3>
            {report.byProduct.length === 0 ? <p className="empty-state">No hay ventas en este período.</p> : (
              <table className="report-table">
                <thead><tr><th scope="col">Producto</th><th scope="col">Unidades</th><th scope="col">Total</th><th scope="col">Ganancia</th></tr></thead>
                <tbody>{report.byProduct.map((row) => <tr key={row.productName}><th scope="row">{row.productName}</th><td>{row.quantity}</td><td>{formatArs(row.totalCents)}</td><td>{row.profitCents === null ? "—" : formatArs(row.profitCents)}</td></tr>)}</tbody>
              </table>
            )}
          </>
        )}
      </section>
    </StaffShell>
  );
}
