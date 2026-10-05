"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/staff-shell";
import { orderStatusLabel } from "@/components/staff/status-copy";
import { formatArs } from "@/lib/format";
import { formatSupplyQuantity } from "@/modules/supplies/supply-format";
import type { Dashboard } from "@/modules/reports/dashboard";

const REFRESH_MS = 30_000;

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/staff/dashboard", { cache: "no-store" });
      if (response.status === 401) { router.push("/staff/login"); return; }
      if (response.status === 403) throw new Error("Solo una persona administradora puede ver el dashboard.");
      if (!response.ok) throw new Error("No se pudo cargar el dashboard.");
      setData(await response.json() as Dashboard);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el dashboard.");
    }
  }, [router]);

  useEffect(() => {
    const first = window.setTimeout(() => { void load(); }, 0);
    const timer = window.setInterval(() => { void load(); }, REFRESH_MS);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [load]);

  const periods = data ? [
    { label: "Hoy", value: data.today },
    { label: "Últimos 7 días", value: data.last7Days },
    { label: "Últimos 30 días", value: data.last30Days },
  ] : [];
  const busiest = data ? Math.max(1, ...data.byHour.map((row) => row.totalCents)) : 1;

  return (
    <StaffShell title="Dashboard" section="dashboard" role="ADMIN">
      <section className="staff-panel" aria-labelledby="dashboard-sales-title">
        <div className="panel-heading"><div><p className="eyebrow">Se actualiza solo</p><h2 id="dashboard-sales-title">Ventas</h2></div></div>
        {error ? <p className="error-state" role="alert">{error}</p> : !data ? <p className="loading-state" role="status">Cargando dashboard…</p> : (
          <>
            <dl className="report-totals">
              {periods.map(({ label, value }) => (
                <div key={label}><dt>{label}</dt><dd>{formatArs(value.totalCents)}</dd><dd className="dashboard-sub">{value.orders} pedidos · promedio {formatArs(value.averageCents)}</dd><dd className="dashboard-sub">{value.profitCents === null ? "Ganancia: cargá costos en Carta" : `Ganancia ${formatArs(value.profitCents)}`}</dd></div>
              ))}
            </dl>

            <h3 className="section-title">Pedidos en curso</h3>
            <dl className="report-totals">
              {data.inProgress.map((row) => <div key={row.status}><dt>{orderStatusLabel[row.status]}</dt><dd>{row.orders}</dd></div>)}
            </dl>

            <h3 className="section-title">Más vendidos (7 días)</h3>
            {data.topProducts.length === 0 ? <p className="empty-state">Todavía no hay ventas en estos días.</p> : (
              <table className="report-table">
                <thead><tr><th scope="col">Producto</th><th scope="col">Unidades</th><th scope="col">Total</th></tr></thead>
                <tbody>{data.topProducts.map((row) => <tr key={row.productName}><th scope="row">{row.productName}</th><td>{row.quantity}</td><td>{formatArs(row.totalCents)}</td></tr>)}</tbody>
              </table>
            )}

            <h3 className="section-title">Ventas por hora (30 días)</h3>
            {data.byHour.length === 0 ? <p className="empty-state">Sin ventas para mostrar.</p> : (
              <ul className="dashboard-hours">
                {data.byHour.map((row) => (
                  <li key={row.hour}>
                    <span>{String(row.hour).padStart(2, "0")}:00</span>
                    <span className="dashboard-bar"><span style={{ width: `${Math.round((row.totalCents / busiest) * 100)}%` }} /></span>
                    <span>{formatArs(row.totalCents)}</span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="section-title">Insumos con poco stock</h3>
            {data.lowStockSupplies.length === 0 ? <p className="empty-state">No hay insumos por debajo del mínimo.</p> : (
              <table className="report-table">
                <thead><tr><th scope="col">Insumo</th><th scope="col">Quedan</th><th scope="col">Mínimo</th></tr></thead>
                <tbody>{data.lowStockSupplies.map((row) => <tr key={row.id}><th scope="row">{row.name}</th><td>{formatSupplyQuantity(row.quantity, row.unit)}</td><td>{formatSupplyQuantity(row.minQuantity, row.unit)}</td></tr>)}</tbody>
              </table>
            )}

            <h3 className="section-title">Productos con stock bajo</h3>
            {data.lowStockProducts.length === 0 ? <p className="empty-state">No hay productos con poco stock.</p> : (
              <table className="report-table">
                <thead><tr><th scope="col">Producto</th><th scope="col">Quedan</th></tr></thead>
                <tbody>{data.lowStockProducts.map((row) => <tr key={row.id}><th scope="row">{row.name}</th><td>{row.stockQuantity}</td></tr>)}</tbody>
              </table>
            )}
          </>
        )}
      </section>
    </StaffShell>
  );
}
