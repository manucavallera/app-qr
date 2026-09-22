"use client";
import { useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/staff-shell";
export default function AuditPage() { const [events, setEvents] = useState<{ id: string; action: string; entityType: string; createdAt: string }[]>([]); useEffect(() => { void fetch("/api/staff/audit").then((response) => response.ok ? response.json() : []).then(setEvents); }, []); return <StaffShell title="Auditoría" section="audit" role="ADMIN"><section className="staff-panel"><div className="payment-list">{events.map((event) => <div className="payment-card" key={event.id}><strong>{event.action}</strong><span>{event.entityType}</span><small>{new Date(event.createdAt).toLocaleString("es-AR")}</small></div>)}</div></section></StaffShell>; }
