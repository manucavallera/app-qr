// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StaffShell } from "@/components/staff/staff-shell";
import { TaskCard } from "@/components/staff/task-card";

afterEach(cleanup);

describe("staff shell", () => {
  it("shows Spanish navigation, task links, and logout", () => {
    render(
      <StaffShell title="Inicio" section="home" role="ADMIN">
        <TaskCard title="Pagos pendientes" description="Cobros para revisar" count={2} href="/staff/payments" />
      </StaffShell>,
    );

    expect(screen.getByRole("link", { name: /pagos pendientes/i })).toHaveAttribute("href", "/staff/payments");
    expect(screen.getByRole("link", { name: "Comandas" })).toHaveAttribute("href", "/staff/commands");
    expect(screen.getByRole("link", { name: "Usuarios" })).toHaveAttribute("href", "/staff/users");
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("groups the menu and hides the owner's sections from operators", () => {
    const { unmount } = render(<StaffShell title="Inicio" section="home" role="ADMIN"><p>contenido</p></StaffShell>);
    expect(screen.getByRole("group", { name: "Operación" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Dueño" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Insumos" })).toBeInTheDocument();
    unmount();

    render(<StaffShell title="Inicio" section="home" role="OPERATOR"><p>contenido</p></StaffShell>);
    expect(screen.queryByRole("group", { name: "Dueño" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Insumos" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Carta" })).toBeInTheDocument();
  });

  it("marks the current section and toggles the folded menu", () => {
    render(<StaffShell title="Pedidos" section="orders" role="ADMIN"><p>contenido</p></StaffShell>);
    expect(screen.getByRole("link", { name: "Pedidos" })).toHaveAttribute("aria-current", "page");
    const toggle = screen.getByRole("button", { name: "Menú" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveAttribute("aria-expanded", "true");
  });
});
