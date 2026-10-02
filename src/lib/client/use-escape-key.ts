"use client";

import { useEffect } from "react";

export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onEscape(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape]);
}
