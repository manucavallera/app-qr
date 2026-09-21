import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="home-card" aria-labelledby="home-title">
        <p className="eyebrow">Sistema de pedidos</p>
        <h1 id="home-title">Pedidos QR</h1>
        <p className="home-description">
          Carta digital y autogestión para las mesas del bar.
        </p>
        <Link className="primary-link" href="/staff/login">
          Ingresar al equipo
        </Link>
      </section>
    </main>
  );
}
