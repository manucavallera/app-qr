"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/staff-shell";
import { TaskCard } from "@/components/staff/task-card";

type Summary = { pendingPayments: number; activeCommands: number; lowStock?: { id: string; name: string; stockQuantity: number }[]; qrMode: "QR_OPEN" | "COUNTER_ONLY" | "PAUSED"; role?: "ADMIN" | "OPERATOR" };
const modeLabels: Record<Summary["qrMode"], string> = { QR_OPEN: "Pedidos QR abiertos", COUNTER_ONLY: "Solo pedidos en caja", PAUSED: "Pedidos QR pausados" };

export default function StaffHomePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => void fetch("/api/staff/summary", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<Summary> : null).then((value) => { if (active && value) setSummary(value); });
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return (
    <StaffShell title="Inicio" section="home" role={summary?.role ?? "OPERATOR"}>
      <section className="staff-panel staff-dashboard" aria-labelledby="dashboard-title">
        <div className="panel-heading"><div><p className="eyebrow">Resumen del local</p><h2 id="dashboard-title">¿Qué necesitás hacer?</h2></div><span className={`mode-badge mode-${summary?.qrMode ?? "LOADING"}`}>{summary ? modeLabels[summary.qrMode] : "Cargando estado…"}</span></div>
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
