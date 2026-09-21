"use client";

import { useEffect } from "react";

export function useSseResource(url: string, refetch: () => void | Promise<void>): void {
  useEffect(() => {
    const source = new EventSource(url);
    const refresh = () => { void refetch(); };
    source.onopen = refresh;
    source.addEventListener("order.changed", refresh);
    source.onerror = refresh;
    const fallback = window.setInterval(() => { if (source.readyState !== EventSource.OPEN) refresh(); }, 15_000);
    refresh();
    return () => { window.clearInterval(fallback); source.close(); };
  }, [url, refetch]);
}
