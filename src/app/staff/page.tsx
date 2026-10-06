"use client";

import { useCallback, useEffect, useState } from "react";
import { formatArs } from "@/lib/format";
import { StaffShell } from "@/components/staff/staff-shell";
import { TaskCard } from "@/components/staff/task-card";

type Summary = { pendingPayments: number; activeCommands: number; lowStock?: { id: string; name: string; stockQuantity: number }[]; refundsDue?: { id: string; method: string; amountCents: number; orderNumber: number }[]; openTabs?: { tables: number; totalCents: number; billRequested: number }; qrMode: "QR_OPEN" | "COUNTER_ONLY" | "PAUSED" | "CLOSED"; role?: "ADMIN" | "OPERATOR" };
const methodNames: Record<string, string> = { MERCADO_PAGO: "Mercado Pago", CASH: "efectivo", CARD_AT_COUNTER: "tarjeta", BANK_TRANSFER: "transferencia" };
const modeLabels: Record<Summary["qrMode"], string> = { QR_OPEN: "Pedidos QR abiertos", COUNTER_ONLY: "Solo pedidos en caja", PAUSED: "Pedidos QR pausados", CLOSED: "Local cerrado hoy" };

export default function StaffHomePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);
  const refresh = useCallback(() => fetch("/api/staff/summary", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<Summary> : null).then((value) => value), []);
  useEffect(() => {
    let active = true;
    const load = () => void refresh().then((value) => { if (active && value) setSummary(value); });
    load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [refresh]);

  async function markReturned(id: string, amountCents: number) {
    setReturnError(null);
    const response = await fetch(`/api/staff/payments/${encodeURIComponent(id)}/reconciliation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "REFUNDED", refundedCents: amountCents, note: "Devolución registrada desde Inicio" }),
    });
    if (!response.ok) { setReturnError("No pudimos registrar la devolución. Probá de nuevo."); return; }
    const value = await refresh();
    if (value) setSummary(value);
  }

  return (
    <StaffShell title="Inicio" section="home" role={summary?.role ?? "OPERATOR"}>
      <section className="staff-panel staff-dashboard" aria-labelledby="dashboard-title">
        <div className="panel-heading"><div><p className="eyebrow">Resumen del local</p><h2 id="dashboard-title">¿Qué necesitás hacer?</h2></div><span className={`mode-badge mode-${summary?.qrMode ?? "LOADING"}`}>{summary ? modeLabels[summary.qrMode] : "Cargando estado…"}</span></div>
        {summary?.refundsDue && summary.refundsDue.length > 0 && (
          <aside className="stock-alert refund-alert" role="alert">
            <strong>Dinero para devolver</strong>
            <p>Estos pedidos se cancelaron pero el pago ya estaba aprobado. Devolvé el dinero al cliente y marcalo acá.</p>
            <ul>{summary.refundsDue.map((payment) => (
              <li key={payment.id}>
                Pedido #{payment.orderNumber}: {formatArs(payment.amountCents)} ({methodNames[payment.method] ?? payment.method})
                {summary.role === "ADMIN" && <> <button className="button-secondary" type="button" onClick={() => void markReturned(payment.id, payment.amountCents)}>Ya lo devolví</button></>}
              </li>
            ))}</ul>
            {summary.role !== "ADMIN" && <small>Avisá a un administrador para registrarlo.</small>}
            {returnError && <small role="alert">{returnError}</small>}
          </aside>
        )}
        {summary?.openTabs && summary.openTabs.tables > 0 && (
          <aside className={`stock-alert${summary.qrMode !== "QR_OPEN" || summary.openTabs.billRequested > 0 ? " refund-alert" : ""}`} role={summary.qrMode !== "QR_OPEN" ? "alert" : "status"}>
            <strong>Cuentas sin cobrar</strong>
            <p>{summary.openTabs.tables} {summary.openTabs.tables === 1 ? "mesa debe" : "mesas deben"} {formatArs(summary.openTabs.totalCents)}{summary.openTabs.billRequested > 0 ? `; ${summary.openTabs.billRequested} ya pidió la cuenta` : ""}.{summary.qrMode !== "QR_OPEN" ? " El horario de pedidos por QR ya cerró: cobrá estas cuentas antes de cerrar la caja." : ""}</p>
            <a href="/staff/tabs">Ir a cobrar</a>
          </aside>
        )}
        {summary?.lowStock && summary.lowStock.length > 0 && (
          <aside className="stock-alert" role="status">
            <strong>Stock bajo</strong>
            <ul>{summary.lowStock.map((product) => <li key={product.id}>{product.name}: {product.stockQuantity === 0 ? "agotado" : `quedan ${product.stockQuantity}`}</li>)}</ul>
            <a href="/staff/catalog">Reponer en Carta</a>
          </aside>
        )}
        <div className="task-grid">
          <TaskCard title="Pagos pendientes" description="Confirmar cobros antes de preparar" count={summary?.pendingPayments ?? 0} href="/staff/payments" />
          <TaskCard title="Comandas" description="Preparar y entregar pedidos" count={summary?.activeCommands ?? 0} href="/staff/commands" />
          <TaskCard title="Nuevo pedido en caja" description="Cargar un pedido del mostrador" href="/staff/counter" />
          <TaskCard title="Pantalla de pedidos listos" description="Abrir en el televisor de la barra" href="/pantalla" />
          <TaskCard title="Carta"description="Productos, precios y disponibilidad" href="/staff/catalog" />
          <TaskCard title="Mesas y QR" description="Probar, imprimir o renovar códigos" href="/staff/tables" />
          <TaskCard title="Configuración" description="Horarios, modos y formas de pago" href="/staff/settings" />
          {summary?.role === "ADMIN" && <TaskCard title="Reportes" description="Cierre de caja y ventas por producto" href="/staff/reports" />}
        </div>
      </section>
    </StaffShell>
  );
}
