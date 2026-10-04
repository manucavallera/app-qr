import { ArrowLeft } from "@phosphor-icons/react/ssr";
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
    <main className="cm-page">
      <section className="cm-page-card">
        {backHref && (
          <Link className="cm-back" href={backHref}>
            <ArrowLeft size={18} weight="bold" aria-hidden="true" /> Volver a la carta
          </Link>
        )}
        <header className="cm-page-title">
          <p>{eyebrow}</p>
          <h1>{title}</h1>
        </header>
        {children}
      </section>
    </main>
  );
}
