"use client";

import { BookOpenText, CashRegister, ChartBar, ChartLineUp, ClipboardText, CookingPot, CreditCard, ForkKnife, GearSix, House, List, Package, QrCode, Receipt, SignOut, UsersThree, X, type Icon } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";

export type StaffSection = "home" | "payments" | "commands" | "counter" | "orders" | "catalog" | "tables" | "settings" | "users" | "audit" | "reports" | "dashboard" | "supplies" | "tabs";
type StaffRole = "ADMIN" | "OPERATOR";

type StaffShellProps = {
  title: string;
  section: StaffSection;
  role?: StaffRole;
  children: ReactNode;
};

type NavLink = { section: StaffSection; label: string; href: string; icon: Icon; adminOnly?: boolean };

/** Grouped by who uses them and when: the shift's work first, the owner's numbers last. */
const groups: Array<{ label: string; adminOnly?: boolean; links: NavLink[] }> = [
  {
    label: "Operación",
    links: [
      { section: "commands", label: "Comandas", href: "/staff/commands", icon: CookingPot },
      { section: "orders", label: "Pedidos", href: "/staff/orders", icon: Receipt },
      { section: "counter", label: "Caja", href: "/staff/counter", icon: CashRegister },
      { section: "tabs", label: "Cuentas", href: "/staff/tabs", icon: ForkKnife },
      { section: "payments", label: "Pagos", href: "/staff/payments", icon: CreditCard },
    ],
  },
  {
    label: "Gestión",
    links: [
      { section: "catalog", label: "Carta", href: "/staff/catalog", icon: BookOpenText },
      { section: "supplies", label: "Insumos", href: "/staff/supplies", icon: Package, adminOnly: true },
      { section: "tables", label: "Mesas y QR", href: "/staff/tables", icon: QrCode },
      { section: "settings", label: "Configuración", href: "/staff/settings", icon: GearSix },
    ],
  },
  {
    label: "Dueño",
    adminOnly: true,
    links: [
      { section: "dashboard", label: "Dashboard", href: "/staff/dashboard", icon: ChartLineUp },
      { section: "reports", label: "Reportes", href: "/staff/reports", icon: ChartBar },
      { section: "users", label: "Usuarios", href: "/staff/users", icon: UsersThree },
      { section: "audit", label: "Auditoría", href: "/staff/audit", icon: ClipboardText },
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
            {menuOpen ? <X size={18} weight="bold" aria-hidden="true" /> : <List size={18} weight="bold" aria-hidden="true" />}
            {menuOpen ? "Cerrar" : "Menú"}
          </button>
        </div>
        <nav id="staff-navigation" className={`staff-side-nav${menuOpen ? " is-open" : ""}`} aria-label="Navegación del equipo">
          <a aria-current={section === "home" ? "page" : undefined} href="/staff"><House size={20} weight={section === "home" ? "fill" : "regular"} aria-hidden="true" />Inicio</a>
          {groups.filter((group) => admin || !group.adminOnly).map((group) => (
            <div className="staff-nav-group" key={group.label} role="group" aria-label={group.label}>
              <p aria-hidden="true">{group.label}</p>
              {group.links.filter((link) => admin || !link.adminOnly).map((link) => (
                <a key={link.section} aria-current={section === link.section ? "page" : undefined} href={link.href}>
                  <link.icon size={20} weight={section === link.section ? "fill" : "regular"} aria-hidden="true" />{link.label}
                </a>
              ))}
            </div>
          ))}
          <form action="/api/staff/auth/logout" method="post"><button className="staff-logout" type="submit"><SignOut size={18} weight="bold" aria-hidden="true" />Cerrar sesión</button></form>
        </nav>
      </aside>
      <main className="staff-page">
        <header className="staff-header"><h1>{title}</h1></header>
        {children}
      </main>
    </div>
  );
}
