"use client";

import { useEffect, useState, type FormEvent } from "react";
import { StaffShell } from "@/components/staff/staff-shell";

type ManualMode = "SCHEDULED" | "FORCE_QR_OPEN" | "FORCE_COUNTER_ONLY" | "FORCE_PAUSED";
type WindowConfig = { weekday: number; opensAtMinute: number; closesAtMinute: number; enabled: boolean };
type PaymentSettings = { mercadoPagoEnabled: boolean; cashEnabled: boolean; cardAtCounterEnabled: boolean; bankTransferEnabled: boolean; bankAlias: string | null; bankCbuCvu: string | null; bankAccountHolder: string | null; bankInstructions: string | null };
type SettingsData = { role?: "ADMIN" | "OPERATOR"; settings?: { manualMode: ManualMode; timezone: string }; windows?: WindowConfig[]; paymentSettings?: PaymentSettings; mercadoPagoConfigured?: boolean };

const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const defaultPaymentSettings: PaymentSettings = { mercadoPagoEnabled: false, cashEnabled: true, cardAtCounterEnabled: true, bankTransferEnabled: false, bankAlias: null, bankCbuCvu: null, bankAccountHolder: null, bankInstructions: null };
const defaultWindows = days.map((_, index) => ({ weekday: index + 1, opensAtMinute: 0, closesAtMinute: 0, enabled: false }));

function minutesToTime(minutes: number): string { return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; }
function timeToMinutes(value: string): number { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; }

export default function SettingsPage() {
  const [role, setRole] = useState<"ADMIN" | "OPERATOR">("ADMIN");
  const [timezone, setTimezone] = useState("America/Argentina/Buenos_Aires");
  const [manualMode, setManualMode] = useState<ManualMode>("SCHEDULED");
  const [windows, setWindows] = useState<WindowConfig[]>(defaultWindows);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(defaultPaymentSettings);
  const [mercadoPagoConfigured, setMercadoPagoConfigured] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/staff/settings", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<SettingsData> : null).then((data) => {
      if (!data) return;
      setRole(data.role ?? "ADMIN");
      setTimezone(data.settings?.timezone ?? "America/Argentina/Buenos_Aires");
      setManualMode(data.settings?.manualMode ?? "SCHEDULED");
      setWindows(defaultWindows.map((fallback) => data.windows?.find((window) => window.weekday === fallback.weekday) ?? fallback));
      setPaymentSettings(data.paymentSettings ?? defaultPaymentSettings);
      setMercadoPagoConfigured(Boolean(data.mercadoPagoConfigured));
    });
  }, []);

  function updateWindow(weekday: number, patch: Partial<WindowConfig>) { setWindows((current) => current.map((window) => window.weekday === weekday ? { ...window, ...patch } : window)); }
  function updatePayment<Key extends keyof PaymentSettings>(key: Key, value: PaymentSettings[Key]) { setPaymentSettings((current) => ({ ...current, [key]: value })); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/staff/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ timezone, manualMode, windows, paymentSettings }) });
    setMessage(response.ok ? "Configuración guardada." : "No se pudo guardar. Revisá los datos e intentá de nuevo.");
    setSaving(false);
  }

  const admin = role === "ADMIN";
  return <StaffShell title="Configuración" section="settings" role={role}><form className="settings-layout" onSubmit={save}><section className="staff-panel"><div className="panel-heading"><div><p className="eyebrow">Operación</p><h2>Modo de pedidos QR</h2></div><span className="mode-badge">{manualMode === "SCHEDULED" ? "Según horario" : manualMode === "FORCE_QR_OPEN" ? "QR abierto" : manualMode === "FORCE_COUNTER_ONLY" ? "Solo caja" : "Pausado"}</span></div><p className="muted">Elegí cómo puede pedir el cliente. La carta sigue visible aunque los pedidos estén cerrados.</p><div className="mode-actions"><button className={manualMode === "SCHEDULED" ? "mode-option selected" : "mode-option"} disabled={!admin} onClick={() => setManualMode("SCHEDULED")} type="button">Según horario</button><button className={manualMode === "FORCE_QR_OPEN" ? "mode-option selected" : "mode-option"} disabled={!admin} onClick={() => setManualMode("FORCE_QR_OPEN")} type="button">Abrir pedidos QR ahora</button><button className={manualMode === "FORCE_COUNTER_ONLY" ? "mode-option selected" : "mode-option"} disabled={!admin} onClick={() => setManualMode("FORCE_COUNTER_ONLY")} type="button">Solo pedidos en caja</button><button className={manualMode === "FORCE_PAUSED" ? "mode-option selected" : "mode-option"} onClick={() => setManualMode("FORCE_PAUSED")} type="button">Pausar pedidos QR</button></div>{!admin && <p className="muted">Tu usuario puede pausar o reanudar temporalmente el servicio, pero no cambiar la configuración estructural.</p>}</section><section className="staff-panel"><div className="panel-heading"><div><p className="eyebrow">Horarios</p><h2>Ventana de atención</h2></div></div><label className="form-field"><span>Zona horaria</span><input className="form-input" disabled={!admin} value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label><div className="schedule-list">{windows.map((window, index) => <div className="schedule-row" key={window.weekday}><label className="check-field"><input checked={window.enabled} disabled={!admin} onChange={(event) => updateWindow(window.weekday, { enabled: event.target.checked })} type="checkbox" /><span>{days[index]}</span></label><input aria-label={`Apertura ${days[index]}`} className="form-input" disabled={!admin || !window.enabled} onChange={(event) => updateWindow(window.weekday, { opensAtMinute: timeToMinutes(event.target.value) })} type="time" value={minutesToTime(window.opensAtMinute)} /><span>hasta</span><input aria-label={`Cierre ${days[index]}`} className="form-input" disabled={!admin || !window.enabled} onChange={(event) => updateWindow(window.weekday, { closesAtMinute: timeToMinutes(event.target.value) })} type="time" value={minutesToTime(window.closesAtMinute === 1440 ? 0 : window.closesAtMinute)} /></div>)}</div></section><section className="staff-panel"><div className="panel-heading"><div><p className="eyebrow">Cobros</p><h2>Medios de pago</h2></div></div><p className="muted">Mercado Pago requiere las credenciales del comercio en el servidor. Los demás medios se confirman en Caja.</p><div className="payment-switches"><label className="check-field"><input checked={paymentSettings.mercadoPagoEnabled} disabled={!admin || !mercadoPagoConfigured} onChange={(event) => updatePayment("mercadoPagoEnabled", event.target.checked)} type="checkbox" /><span>Mercado Pago {!mercadoPagoConfigured ? "(sin configurar)" : ""}</span></label><label className="check-field"><input checked={paymentSettings.cashEnabled} disabled={!admin} onChange={(event) => updatePayment("cashEnabled", event.target.checked)} type="checkbox" /><span>Efectivo en caja</span></label><label className="check-field"><input checked={paymentSettings.cardAtCounterEnabled} disabled={!admin} onChange={(event) => updatePayment("cardAtCounterEnabled", event.target.checked)} type="checkbox" /><span>Tarjeta en caja</span></label><label className="check-field"><input checked={paymentSettings.bankTransferEnabled} disabled={!admin} onChange={(event) => updatePayment("bankTransferEnabled", event.target.checked)} type="checkbox" /><span>Transferencia bancaria</span></label></div>{paymentSettings.bankTransferEnabled && <div className="transfer-fields"><label className="form-field"><span>Alias</span><input className="form-input" disabled={!admin} value={paymentSettings.bankAlias ?? ""} onChange={(event) => updatePayment("bankAlias", event.target.value || null)} /></label><label className="form-field"><span>CBU/CVU</span><input className="form-input" disabled={!admin} value={paymentSettings.bankCbuCvu ?? ""} onChange={(event) => updatePayment("bankCbuCvu", event.target.value || null)} /></label><label className="form-field"><span>Titular</span><input className="form-input" disabled={!admin} value={paymentSettings.bankAccountHolder ?? ""} onChange={(event) => updatePayment("bankAccountHolder", event.target.value || null)} /></label><label className="form-field"><span>Instrucciones</span><textarea className="form-input" disabled={!admin} value={paymentSettings.bankInstructions ?? ""} onChange={(event) => updatePayment("bankInstructions", event.target.value || null)} /></label></div>}</section>{message && <p className="staff-message" role="status">{message}</p>}<button className="primary-link settings-save" disabled={saving || !admin} type="submit">{saving ? "Guardando…" : "Guardar configuración"}</button></form></StaffShell>;
}
