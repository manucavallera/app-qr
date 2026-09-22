"use client";
import { useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/staff-shell";
export default function UsersPage() { const [users, setUsers] = useState<{ id: string; email: string; displayName: string; role: string; active: boolean }[]>([]); useEffect(() => { void fetch("/api/staff/users").then((response) => response.ok ? response.json() : []).then(setUsers); }, []); return <StaffShell title="Usuarios" section="users" role="ADMIN"><section className="staff-panel"><div className="payment-list">{users.map((user) => <div className="payment-card" key={user.id}><div><strong>{user.displayName}</strong><span>{user.email}</span></div><span>{user.role} · {user.active ? "Activo" : "Inactivo"}</span></div>)}</div></section></StaffShell>; }
