"use client";

import { useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/staff-shell";
import { auditActionLabel, auditEntityLabel, humanizeStaffCode } from "@/components/staff/status-copy";

type AuditEvent = { id: string; action: string; entityType: string; entityId: string; createdAt: string };

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/staff/audit", { cache: "no-store" });
      if (!response.ok) throw new Error("audit_load_failed");
      setEvents(await response.json() as AuditEvent[]);
    } catch {
      setError("No se pudo cargar la auditoría.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch("/api/staff/audit", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("audit_load_failed");
      setEvents(await response.json() as AuditEvent[]);
    }).catch(() => setError("No se pudo cargar la auditoría.")).finally(() => setLoading(false));
  }, []);

  return <StaffShell title="Auditoría" section="audit" role="ADMIN">
    <section className="staff-panel">
      <div className="panel-heading"><div><p className="eyebrow">Trazabilidad</p><h2>Actividad del equipo</h2><p className="muted">Acciones relevantes sobre pedidos, cobros y configuración.</p></div><button className="button-secondary" type="button" onClick={() => void loadEvents()}>Actualizar</button></div>
      {loading ? <p className="loading-state" role="status">Cargando actividad…</p> : error ? <div className="state-block"><p className="error-state" role="alert">{error}</p><button className="button-secondary" type="button" onClick={() => void loadEvents()}>Reintentar</button></div> : events.length === 0 ? <p className="empty-state">Todavía no hay actividad registrada.</p> : <div className="payment-list audit-list">{events.map((event) => <article className="payment-card" key={event.id}><div><strong>{auditActionLabel[event.action] ?? humanizeStaffCode(event.action)}</strong><span>{auditEntityLabel[event.entityType] ?? humanizeStaffCode(event.entityType)}</span><small>Referencia: {event.entityId}</small></div><small>{new Date(event.createdAt).toLocaleString("es-AR")}</small></article>)}</div>}
    </section>
  </StaffShell>;
}
