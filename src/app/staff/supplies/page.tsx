"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { StaffShell } from "@/components/staff/staff-shell";
import { formatSupplyQuantity, parseSupplyQuantity, supplyUnitLabel, type SupplyUnitValue } from "@/modules/supplies/supply-format";
import type { SupplyView } from "@/modules/supplies/supply-service";

type Action = "PURCHASE" | "WASTE" | "ADJUSTMENT";
const actionLabel: Record<Action, string> = { PURCHASE: "Compra", WASTE: "Merma", ADJUSTMENT: "Contar" };
const errorCopy: Record<string, string> = {
  SUPPLY_NAME_TAKEN: "Ya existe un insumo con ese nombre.",
  INSUFFICIENT_SUPPLY: "No hay tanto stock de ese insumo.",
  SUPPLY_CONFLICT: "El stock cambió mientras lo editabas. Probá de nuevo.",
  SUPPLY_NOT_FOUND: "Ese insumo ya no existe.",
};

/** Whether the unit has a "large" version the person can type in (kg, liters). */
const hasLargeUnit = (unit: SupplyUnitValue) => unit !== "UNIT";
const largeLabel = (unit: SupplyUnitValue) => (unit === "GRAM" ? "kg" : "L");
const smallLabel = (unit: SupplyUnitValue) => (unit === "GRAM" ? "g" : unit === "MILLILITER" ? "ml" : "u");

function QuantityField({ unit, value, large, onChange, onLarge, label }: { unit: SupplyUnitValue; value: string; large: boolean; onChange: (value: string) => void; onLarge: (large: boolean) => void; label: string }) {
  return (
    <label className="form-field"><span>{label}</span>
      <span className="supply-quantity">
        <input className="form-input" inputMode="decimal" required value={value} onChange={(event) => onChange(event.target.value)} />
        {hasLargeUnit(unit) ? (
          <select className="form-input" aria-label="Unidad" value={large ? "large" : "small"} onChange={(event) => onLarge(event.target.value === "large")}>
            <option value="small">{smallLabel(unit)}</option><option value="large">{largeLabel(unit)}</option>
          </select>
        ) : <span>{smallLabel(unit)}</span>}
      </span>
    </label>
  );
}

function SupplyRow({ supply, onChanged, onError }: { supply: SupplyView; onChanged: () => void; onError: (message: string) => void }) {
  const [action, setAction] = useState<Action | null>(null);
  const [amount, setAmount] = useState("");
  const [large, setLarge] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(url: string, method: string, body: unknown): Promise<boolean> {
    const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (response.ok) return true;
    const data = await response.json().catch(() => ({})) as { error?: string };
    onError(errorCopy[data.error ?? ""] ?? "No se pudo guardar. Revisá los datos e intentá de nuevo.");
    return false;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseSupplyQuantity(amount, large);
    if (parsed === null || !action) { onError("Ingresá una cantidad válida."); return; }
    setBusy(true);
    const ok = await send(`/api/staff/supplies/${supply.id}/movements`, "POST", action === "ADJUSTMENT" ? { reason: action, newQuantity: parsed } : { reason: action, quantity: parsed });
    setBusy(false);
    if (ok) { setAction(null); setAmount(""); onChanged(); }
  }

  async function toggleActive() {
    if (await send(`/api/staff/supplies/${supply.id}`, "PATCH", { active: !supply.active })) onChanged();
  }

  return (
    <tr className={supply.active ? undefined : "supply-inactive"}>
      <th scope="row">{supply.name}{supply.low ? <span className="supply-low"> · Stock bajo</span> : null}{supply.active ? null : <span> · Desactivado</span>}</th>
      <td data-label="Stock">{formatSupplyQuantity(supply.quantity, supply.unit)}</td>
      <td data-label="Mínimo">{formatSupplyQuantity(supply.minQuantity, supply.unit)}</td>
      <td><div className="supply-actions">
        {action ? (
          <form className="supply-form" onSubmit={(event) => { void submit(event); }}>
            <QuantityField unit={supply.unit} value={amount} large={large} onChange={setAmount} onLarge={setLarge} label={action === "ADJUSTMENT" ? "Cantidad real" : actionLabel[action]} />
            <button className="primary-link" type="submit" disabled={busy}>Guardar</button>
            <button className="button-text" type="button" onClick={() => setAction(null)}>Cancelar</button>
          </form>
        ) : (
          <>
            {(Object.keys(actionLabel) as Action[]).map((key) => <button key={key} className="button-text" type="button" onClick={() => { setAction(key); setAmount(""); setLarge(false); }}>{actionLabel[key]}</button>)}
            <button className="button-text" type="button" onClick={() => { void toggleActive(); }}>{supply.active ? "Desactivar" : "Activar"}</button>
          </>
        )}
      </div></td>
    </tr>
  );
}

export default function SuppliesPage() {
  const router = useRouter();
  const [supplies, setSupplies] = useState<SupplyView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<SupplyUnitValue>("UNIT");
  const [large, setLarge] = useState(false);
  const [initial, setInitial] = useState("0");
  const [min, setMin] = useState("0");

  const load = useCallback(async () => {
    const response = await fetch("/api/staff/supplies", { cache: "no-store" });
    if (response.status === 401) { router.push("/staff/login"); return; }
    if (response.status === 403) { setError("Solo una persona administradora puede ver los insumos."); return; }
    if (!response.ok) { setError("No se pudieron cargar los insumos."); return; }
    setSupplies(await response.json() as SupplyView[]);
  }, [router]);

  useEffect(() => {
    const first = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(first);
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    const quantity = parseSupplyQuantity(initial, large);
    const minQuantity = parseSupplyQuantity(min, large);
    if (quantity === null || minQuantity === null) { setError("Ingresá cantidades válidas."); return; }
    const response = await fetch("/api/staff/supplies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, unit, quantity, minQuantity }) });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      setError(errorCopy[data.error ?? ""] ?? "No se pudo crear el insumo.");
      return;
    }
    setError(null); setName(""); setInitial("0"); setMin("0");
    await load();
  }

  return (
    <StaffShell title="Insumos" section="supplies" role="ADMIN">
      <section className="staff-panel" aria-labelledby="supplies-title">
        <div className="panel-heading"><div><p className="eyebrow">Ingredientes y materiales</p><h2 id="supplies-title">Stock de insumos</h2></div></div>
        {error ? <p className="error-state" role="alert">{error}</p> : null}

        {!supplies ? (error ? null : <p className="loading-state" role="status">Cargando insumos…</p>) : supplies.length === 0 ? <p className="empty-state">Todavía no cargaste insumos. Agregá el primero abajo.</p> : (
          <table className="report-table supply-table">
            <thead><tr><th scope="col">Insumo</th><th scope="col">Stock</th><th scope="col">Mínimo</th><th scope="col">Acciones</th></tr></thead>
            <tbody>{supplies.map((supply) => <SupplyRow key={supply.id} supply={supply} onChanged={() => { setError(null); void load(); }} onError={setError} />)}</tbody>
          </table>
        )}

        <h3 className="section-title">Agregar insumo</h3>
        <form className="supply-form supply-create" onSubmit={(event) => { void create(event); }}>
          <label className="form-field"><span>Nombre</span><input className="form-input" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="form-field"><span>Se mide en</span>
            <select className="form-input" value={unit} onChange={(event) => { setUnit(event.target.value as SupplyUnitValue); setLarge(false); }}>
              {(Object.keys(supplyUnitLabel) as SupplyUnitValue[]).map((key) => <option key={key} value={key}>{supplyUnitLabel[key]}</option>)}
            </select>
          </label>
          <QuantityField unit={unit} value={initial} large={large} onChange={setInitial} onLarge={setLarge} label="Stock inicial" />
          <QuantityField unit={unit} value={min} large={large} onChange={setMin} onLarge={setLarge} label="Avisar con menos de" />
          <button className="primary-link" type="submit">Agregar</button>
        </form>
      </section>
    </StaffShell>
  );
}
