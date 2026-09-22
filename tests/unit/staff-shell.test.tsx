// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StaffShell } from "@/components/staff/staff-shell";
import { TaskCard } from "@/components/staff/task-card";

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
});
