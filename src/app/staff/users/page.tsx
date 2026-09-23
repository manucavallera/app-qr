"use client";

import { useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/staff-shell";
import { staffRoleLabel } from "@/components/staff/status-copy";

type Role = "ADMIN" | "OPERATOR";
type User = { id: string; email: string; displayName: string; role: Role; active: boolean };
type Draft = User & { password: string };

function emptyDraft(): Omit<Draft, "id"> {
  return { email: "", displayName: "", role: "OPERATOR", active: true, password: "" };
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newUser, setNewUser] = useState(emptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/staff/users", { cache: "no-store" });
      if (!response.ok) throw new Error("users_load_failed");
      const result = await response.json() as User[];
      setUsers(result);
      setDrafts(Object.fromEntries(result.map((user) => [user.id, { ...user, password: "" }])));
    } catch {
      setError("No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch("/api/staff/users", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("users_load_failed");
      const result = await response.json() as User[];
      setUsers(result);
      setDrafts(Object.fromEntries(result.map((user) => [user.id, { ...user, password: "" }])));
    }).catch(() => setError("No se pudieron cargar los usuarios.")).finally(() => setLoading(false));
  }, []);

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const createInput = { email: newUser.email, displayName: newUser.displayName, password: newUser.password, role: newUser.role };
      const response = await fetch("/api/staff/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(createInput) });
      if (!response.ok) throw new Error("user_create_failed");
      setNewUser(emptyDraft());
      setMessage("Usuario creado.");
      await loadUsers();
    } catch {
      setError("No se pudo crear el usuario. Revisá correo, nombre y contraseña.");
    } finally {
      setSaving(false);
    }
  }

  async function saveUser(userId: string, override?: Draft) {
    const draft = override ?? drafts[userId];
    if (!draft) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const { id, password, ...changes } = draft;
    try {
      const response = await fetch("/api/staff/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...changes, ...(password ? { password } : {}) }) });
      if (!response.ok) throw new Error("user_update_failed");
      setMessage("Cambios guardados.");
      await loadUsers();
    } catch {
      setError("No se pudieron guardar los cambios. Verificá que quede al menos un administrador activo.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: User) {
    const draft = drafts[user.id];
    if (!draft) return;
    const nextDraft = { ...draft, active: !user.active };
    setDrafts((current) => ({ ...current, [user.id]: nextDraft }));
    await saveUser(user.id, nextDraft);
  }

  return <StaffShell title="Usuarios" section="users" role="ADMIN">
    <section className="staff-panel users-layout">
      <div className="panel-heading"><div><p className="eyebrow">Accesos del equipo</p><h2>Administrar usuarios</h2><p className="muted">Creá cuentas, cambiá roles y desactivá accesos sin borrar historial.</p></div><button className="button-secondary" type="button" onClick={() => void loadUsers()}>Actualizar</button></div>
      {message && <p className="staff-message" role="status">{message}</p>}
      {error && <div className="state-block"><p className="error-state" role="alert">{error}</p><button className="button-secondary" type="button" onClick={() => void loadUsers()}>Reintentar</button></div>}
      <form className="user-create-form" onSubmit={createUser}>
        <h3>Nuevo usuario</h3>
        <div className="form-grid-two"><label className="form-field"><span>Nombre</span><input className="form-input" required value={newUser.displayName} onChange={(event) => setNewUser((current) => ({ ...current, displayName: event.target.value }))} /></label><label className="form-field"><span>Correo</span><input className="form-input" required type="email" value={newUser.email} onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))} /></label><label className="form-field"><span>Contraseña inicial</span><input className="form-input" required minLength={8} type="password" value={newUser.password} onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))} /></label><label className="form-field"><span>Rol</span><select className="form-input" value={newUser.role} onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value as Role }))}><option value="OPERATOR">Operador</option><option value="ADMIN">Administrador</option></select></label></div>
        <button className="primary-link" disabled={saving} type="submit">Crear usuario</button>
      </form>
      {loading ? <p className="loading-state" role="status">Cargando usuarios…</p> : users.length === 0 ? <p className="empty-state">Todavía no hay usuarios para mostrar.</p> : <div className="users-list">{users.map((user) => { const draft = drafts[user.id] ?? { ...user, password: "" }; return <article className="user-card" key={user.id}>
        <div className="user-card-heading"><div><strong>{user.displayName}</strong><span>{staffRoleLabel[user.role]} · {user.active ? "Activo" : "Inactivo"}</span></div><span className={user.active ? "status-badge" : "status-badge is-inactive"}>{user.active ? "Activo" : "Inactivo"}</span></div>
        <div className="form-grid-two"><label className="form-field"><span>Nombre</span><input className="form-input" value={draft.displayName} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, displayName: event.target.value } }))} /></label><label className="form-field"><span>Correo</span><input className="form-input" type="email" value={draft.email} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, email: event.target.value } }))} /></label><label className="form-field"><span>Nueva contraseña (opcional)</span><input className="form-input" minLength={8} type="password" value={draft.password} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, password: event.target.value } }))} /></label><label className="form-field"><span>Rol</span><select className="form-input" value={draft.role} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...draft, role: event.target.value as Role } }))}><option value="OPERATOR">Operador</option><option value="ADMIN">Administrador</option></select></label></div>
        <div className="button-row"><button className="primary-link" disabled={saving} type="button" onClick={() => void saveUser(user.id)}>Guardar cambios</button><button className="button-text" disabled={saving} type="button" onClick={() => void toggleActive(user)}>{user.active ? "Desactivar acceso" : "Activar acceso"}</button></div>
      </article>; })}</div>}
    </section>
  </StaffShell>;
}
