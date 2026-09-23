"use client";

import { type ReactNode } from "react";

export type StaffSection = "home" | "payments" | "commands" | "counter" | "orders" | "catalog" | "tables" | "settings" | "users" | "audit";
type StaffRole = "ADMIN" | "OPERATOR";

type StaffShellProps = {
  title: string;
  section: StaffSection;
  role?: StaffRole;
  children: ReactNode;
};

const links: Array<{ section: StaffSection; label: string; href: string }> = [
  { section: "home", label: "Inicio", href: "/staff" },
  { section: "payments", label: "Pagos", href: "/staff/payments" },
  { section: "commands", label: "Comandas", href: "/staff/commands" },
  { section: "counter", label: "Caja", href: "/staff/counter" },
  { section: "orders", label: "Pedidos", href: "/staff/orders" },
  { section: "catalog", label: "Carta", href: "/staff/catalog" },
  { section: "tables", label: "Mesas y QR", href: "/staff/tables" },
  { section: "settings", label: "Configuración", href: "/staff/settings" },
];

export function StaffShell({ title, section, role = "OPERATOR", children }: StaffShellProps) {
  return (
    <main className="staff-page">
      <header className="staff-header">
        <div>
          <p className="eyebrow">Equipo del bar</p>
          <h1>{title}</h1>
        </div>
        <form action="/api/staff/auth/logout" method="post"><button className="button-secondary" type="submit">Cerrar sesión</button></form>
      </header>
      <nav className="staff-nav staff-main-nav" aria-label="Navegación del equipo">
        {links.map((link) => (
          <a key={link.section} aria-current={section === link.section ? "page" : undefined} href={link.href}>{link.label}</a>
        ))}
        {role === "ADMIN" ? <><a aria-current={section === "users" ? "page" : undefined} href="/staff/users">Usuarios</a><a aria-current={section === "audit" ? "page" : undefined} href="/staff/audit">Auditoría</a></> : null}
      </nav>
      {children}
    </main>
  );
}
