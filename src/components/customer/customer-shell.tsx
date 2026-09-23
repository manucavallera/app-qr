import Link from "next/link";
import type { ReactNode } from "react";

type CustomerShellProps = Readonly<{
  eyebrow: string;
  title: string;
  backHref?: string;
  children: ReactNode;
}>;

export function CustomerShell({ eyebrow, title, backHref, children }: CustomerShellProps) {
  return (
    <main className="customer-page">
      <section className="customer-card">
        {backHref && (
          <Link className="customer-back-link" href={backHref}>
            <span aria-hidden="true">←</span> Volver a la carta
          </Link>
        )}
        <header className="customer-title">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </header>
        {children}
      </section>
    </main>
  );
}
