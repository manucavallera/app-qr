"use client";

import { useEffect, useState } from "react";

type Board = { preparing: number[]; ready: number[] };

export default function ReadyBoardPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/public/ready-board", { cache: "no-store" });
        if (!response.ok) throw new Error("ready-board unavailable");
        const next = await response.json() as Board;
        if (active) { setBoard(next); setOffline(false); }
      } catch {
        // Keep the last numbers on screen; the next poll retries.
        if (active) setOffline(true);
      }
    };
    const initial = window.setTimeout(() => { void refresh(); }, 0);
    const timer = window.setInterval(() => { void refresh(); }, 5000);
    return () => { active = false; window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  return (
    <main className="ready-board">
      <header className="ready-board-header"><h1>Pedidos</h1>{offline && <span role="status">Reconectando…</span>}</header>
      <div className="ready-board-columns">
        <section className="ready-board-column" aria-labelledby="board-preparing">
          <h2 id="board-preparing">En preparación</h2>
          {board && board.preparing.length > 0
            ? <ul className="ready-board-numbers">{board.preparing.map((number) => <li key={number}>{number}</li>)}</ul>
            : <p className="ready-board-empty">{board ? "Sin pedidos en preparación." : "Cargando…"}</p>}
        </section>
        <section className="ready-board-column is-ready" aria-labelledby="board-ready" aria-live="polite">
          <h2 id="board-ready">Listos para retirar</h2>
          {board && board.ready.length > 0
            ? <ul className="ready-board-numbers">{board.ready.map((number) => <li key={number}>{number}</li>)}</ul>
            : <p className="ready-board-empty">{board ? "Todavía no hay pedidos listos." : "Cargando…"}</p>}
        </section>
      </div>
    </main>
  );
}
