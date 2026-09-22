"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { StaffShell } from "@/components/staff/staff-shell";

type Table = {
  id: string;
  label: string;
  active: boolean;
  qrConfigured: boolean;
  createdAt: string;
};

async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "No se pudo completar la operación.";
}

export default function StaffTablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/staff/tables", { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response));
      setTables((await response.json()) as Table[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar las mesas.");
    } finally {
      setLoading(false);
    }
  }, []);

  // The async request synchronizes this screen with the server's table list.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch("/api/staff/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (!response.ok) {
      setMessage(await responseError(response));
      return;
    }
    setLabel("");
    setMessage("Mesa creada. Su QR ya está disponible.");
    await refresh();
  }

  async function regenerateQr(table: Table) {
    if (!window.confirm(`¿Renovar el QR de ${table.label}? El código anterior dejará de abrir la carta.`)) return;
    setMessage(null);
    const response = await fetch(`/api/staff/tables/${table.id}/qr`, { method: "POST" });
    if (!response.ok) {
      setMessage(await responseError(response));
      return;
    }
    setMessage(`QR de ${table.label} renovado. Imprimí el nuevo código.`);
    await refresh();
  }

  return (
    <StaffShell title="Mesas y códigos QR" section="tables" role="ADMIN">
      {message ? <p className="staff-message" role="status">{message}</p> : null}

      <section className="staff-panel" aria-labelledby="tables-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Códigos permanentes</p>
            <h2 id="tables-title">Mesas del bar</h2>
          </div>
          <form className="inline-form" onSubmit={createTable}>
            <label className="sr-only" htmlFor="new-table">Nombre de la mesa</label>
            <input
              id="new-table"
              maxLength={60}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ej. Patio 1"
              required
              value={label}
            />
            <button className="button-secondary" type="submit">Agregar mesa</button>
          </form>
        </div>

        {loading ? <p className="muted">Cargando mesas…</p> : null}
        <div className="table-grid">
          {tables.map((table) => (
            <article className="table-card" key={table.id}>
              <div className="table-card-heading">
                <div>
                  <h3>{table.label}</h3>
                  <p className="muted">{table.active ? "Activa" : "Inactiva"} · {table.qrConfigured ? "QR listo" : "Sin QR"}</p>
                </div>
                <span aria-hidden="true" className="qr-mark">QR</span>
              </div>
              <Image
                alt={`Código QR permanente de ${table.label}`}
                className="qr-preview"
                height={168}
                loading="lazy"
                src={`/api/staff/tables/${table.id}/qr`}
                unoptimized
                width={168}
              />
              <div className="button-row table-actions">
                <a className="button-secondary" download={`QR-${table.label}.svg`} href={`/api/staff/tables/${table.id}/qr`}>Descargar SVG</a>
                <button className="button-text danger-text" onClick={() => void regenerateQr(table)} type="button">Renovar QR</button>
              </div>
            </article>
          ))}
        </div>
        {!loading && tables.length === 0 ? <p className="muted">Todavía no hay mesas cargadas.</p> : null}
      </section>
    </StaffShell>
  );
}
