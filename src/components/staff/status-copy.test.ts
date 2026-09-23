import { describe, expect, it } from "vitest";
import { auditActionLabel, auditEntityLabel, humanizeStaffCode, orderOriginLabel, orderStatusLabel, staffRoleLabel } from "./status-copy";

describe("staff presentation copy", () => {
  it("translates operational codes into labels for the team", () => {
    expect(orderStatusLabel.CONFIRMED).toBe("Confirmado");
    expect(orderOriginLabel.COUNTER).toBe("Caja");
    expect(staffRoleLabel.OPERATOR).toBe("Operador");
    expect(auditActionLabel.SETTINGS_UPDATED).toBe("Configuración actualizada");
    expect(auditEntityLabel.StaffUser).toBe("Usuario del equipo");
    expect(humanizeStaffCode("UNKNOWN_EVENT")).toBe("Unknown Event");
  });
});
