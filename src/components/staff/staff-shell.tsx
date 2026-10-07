"use client";

import { useEffect, useState, type ReactNode } from "react";

export type StaffSection = "home" | "payments" | "commands" | "counter" | "orders" | "catalog" | "tables" | "settings" | "users" | "audit" | "reports" | "dashboard" | "supplies" | "tabs";
type StaffRole = "ADMIN" | "OPERATOR";

type StaffShellProps = {
  title: string;
  section: StaffSection;
  role?: StaffRole;
  children: ReactNode;
};

type NavLink = { section: StaffSection; label: string; href: string; adminOnly?: boolean };

/** Grouped by who uses them and when: the shift's work first, the owner's numbers last. */
const groups: Array<{ label: string; adminOnly?: boolean; links: NavLink[] }> = [
  {
    label: "Operación",
    links: [
      { section: "commands", label: "Comandas", href: "/staff/commands" },
      { section: "orders", label: "Pedidos", href: "/staff/orders" },
      { section: "counter", label: "Caja", href: "/staff/counter" },
      { section: "tabs", label: "Cuentas", href: "/staff/tabs" },
      { section: "payments", label: "Pagos", href: "/staff/payments" },
    ],
  },
  {
    label: "Gestión",
    links: [
      { section: "catalog", label: "Carta", href: "/staff/catalog" },
      { section: "supplies", label: "Insumos", href: "/staff/supplies", adminOnly: true },
      { section: "tables", label: "Mesas y QR", href: "/staff/tables" },
      { section: "settings", label: "Configuración", href: "/staff/settings" },
    ],
  },
  {
    label: "Dueño",
    adminOnly: true,
    links: [
      { section: "dashboard", label: "Dashboard", href: "/staff/dashboard" },
      { section: "reports", label: "Reportes", href: "/staff/reports" },
      { section: "users", label: "Usuarios", href: "/staff/users" },
      { section: "audit", label: "Auditoría", href: "/staff/audit" },
    ],
  },
];

export function StaffShell({ title, section, role = "OPERATOR", children }: StaffShellProps) {
  // Only matters on small screens, where the menu is folded behind a button.
  const [menuOpen, setMenuOpen] = useState(false);
  // Most screens do not know the role; asking once keeps the menu the same on all of them.
  const [knownRole, setKnownRole] = useState<StaffRole | null>(null);
  useEffect(() => {
    if (role === "ADMIN" || typeof fetch !== "function") return;
    let cancelled = false;
    fetch("/api/staff/auth/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() as Promise<{ role?: StaffRole }> : null))
      .then((body) => { if (!cancelled && body?.role) setKnownRole(body.role); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [role]);
  const admin = role === "ADMIN" || knownRole === "ADMIN";

  return (
    <div className="staff-layout">
      <aside className="staff-sidebar" onKeyDown={(event) => { if (event.key === "Escape") setMenuOpen(false); }}>
        <div className="staff-sidebar-top">
          <a className="staff-brand" href="/staff">Equipo del bar</a>
          <button className="staff-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="staff-navigation" onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? "Cerrar" : "Menú"}
          </button>
        </div>
        <nav id="staff-navigation" className={`staff-side-nav${menuOpen ? " is-open" : ""}`} aria-label="Navegación del equipo">
          <a aria-current={section === "home" ? "page" : undefined} href="/staff">Inicio</a>
          {groups.filter((group) => admin || !group.adminOnly).map((group) => (
            <div className="staff-nav-group" key={group.label} role="group" aria-label={group.label}>
              <p aria-hidden="true">{group.label}</p>
              {group.links.filter((link) => admin || !link.adminOnly).map((link) => (
                <a key={link.section} aria-current={section === link.section ? "page" : undefined} href={link.href}>{link.label}</a>
              ))}
            </div>
          ))}
          <form action="/api/staff/auth/logout" method="post"><button className="button-secondary" type="submit">Cerrar sesión</button></form>
        </nav>
      </aside>
      <main className="staff-page">
        <header className="staff-header"><h1>{title}</h1></header>
        {children}
      </main>
    </div>
  );
}
