"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function StaffLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/staff/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });

      if (response.ok) {
        router.push("/staff/catalog");
        return;
      }

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(
        body?.error === "TOO_MANY_ATTEMPTS"
          ? "Hubo demasiados intentos. Esperá unos minutos y probá de nuevo."
          : "No pudimos iniciar sesión. Revisá tu correo y contraseña.",
      );
    } catch {
      setError("No pudimos conectar con el sistema. Intentá de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <p className="eyebrow">Equipo del bar</p>
        <h1 id="login-title">Ingresar</h1>
        <p className="login-description">Accedé a los pedidos y a la gestión del local.</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Correo electrónico</span>
            <input
              autoComplete="username"
              autoCapitalize="none"
              className="form-input"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="form-field">
            <span>Contraseña</span>
            <input
              autoComplete="current-password"
              className="form-input"
              name="password"
              required
              type="password"
            />
          </label>
          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="primary-link login-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Ingresando…" : "Ingresar al equipo"}
          </button>
        </form>
      </section>
    </main>
  );
}
