"use client";

import { useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/staff-shell";
import { auditActionLabel, auditEntityLabel, humanizeStaffCode } from "@/components/staff/status-copy";

type AuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  metadata: unknown;
  actorStaff: { displayName: string; email: string } | null;
};

type AuditFilter = "all" | "logins";

const filterQuery: Record<AuditFilter, string> = { all: "", logins: "?entityType=StaffLogin" };

function loginDetail(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const { email, ipAddress, userAgent } = metadata as { email?: string; ipAddress?: string; userAgent?: string | null };
  return [email, ipAddress ? `IP ${ipAddress}` : null, userAgent ? deviceLabel(userAgent) : null].filter(Boolean).join(" · ");
}

function deviceLabel(userAgent: string): string {
  if (/iphone|ipad/i.test(userAgent)) return "iPhone/iPad";
  if (/android/i.test(userAgent)) return "Android";
  if (/windows/i.test(userAgent)) return "Windows";
  if (/mac os/i.test(userAgent)) return "Mac";
  return "Otro dispositivo";
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AuditFilter>("all");

  const loadEvents = useCallback(async (nextFilter: AuditFilter) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/staff/audit${filterQuery[nextFilter]}`, { cache: "no-store" });
      if (!response.ok) throw new Error("audit_load_failed");
      setEvents(await response.json() as AuditEvent[]);
    } catch {
      setError("No se pudo cargar la auditoría.");
    } finally {
      setLoading(false);
    }
  }, []);

  function changeFilter(nextFilter: AuditFilter) {
    setFilter(nextFilter);
    void loadEvents(nextFilter);
  }

  useEffect(() => {
    void fetch("/api/staff/audit", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("audit_load_failed");
      setEvents(await response.json() as AuditEvent[]);
    }).catch(() => setError("No se pudo cargar la auditoría.")).finally(() => setLoading(false));
  }, []);

  return <StaffShell title="Auditoría" section="audit" role="ADMIN">
    <section className="staff-panel">
      <div className="panel-heading"><div><p className="eyebrow">Trazabilidad</p><h2>Actividad del equipo</h2><p className="muted">Acciones relevantes sobre pedidos, cobros y configuración, y los ingresos al panel.</p></div><button className="button-secondary" type="button" onClick={() => void loadEvents(filter)}>Actualizar</button></div>
      <div className="orders-filters" role="group" aria-label="Filtrar actividad">
        <button type="button" aria-pressed={filter === "all"} onClick={() => changeFilter("all")}>Todo</button>
        <button type="button" aria-pressed={filter === "logins"} onClick={() => changeFilter("logins")}>Ingresos</button>
      </div>
      {loading ? <p className="loading-state" role="status">Cargando actividad…</p> : error ? <div className="state-block"><p className="error-state" role="alert">{error}</p><button className="button-secondary" type="button" onClick={() => void loadEvents(filter)}>Reintentar</button></div> : events.length === 0 ? <p className="empty-state">Todavía no hay actividad registrada.</p> : <div className="payment-list audit-list">{events.map((event) => <article className="payment-card" key={event.id}><div><strong>{auditActionLabel[event.action] ?? humanizeStaffCode(event.action)}</strong><span>{auditEntityLabel[event.entityType] ?? humanizeStaffCode(event.entityType)}</span>{event.actorStaff ? <span>Por {event.actorStaff.displayName}</span> : null}<small>{event.entityType === "StaffLogin" ? loginDetail(event.metadata) : `Referencia: ${event.entityId}`}</small></div><small>{new Date(event.createdAt).toLocaleString("es-AR")}</small></article>)}</div>}
    </section>
  </StaffShell>;
}
