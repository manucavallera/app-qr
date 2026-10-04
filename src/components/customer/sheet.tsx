"use client";

import { useEffect, useRef, type ReactNode } from "react";

const focusable = 'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function Sheet({ labelledBy, children }: Readonly<{ labelledBy: string; children: ReactNode }>) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const sheet = ref.current;
    if (!sheet) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (sheet.querySelector<HTMLElement>(focusable) ?? sheet).focus();

    function trapTab(event: KeyboardEvent) {
      if (event.key !== "Tab" || !sheet) return;
      const items = Array.from(sheet.querySelectorAll<HTMLElement>(focusable));
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    sheet.addEventListener("keydown", trapTab);
    return () => {
      sheet.removeEventListener("keydown", trapTab);
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return <section ref={ref} className="cm-sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>{children}</section>;
}
