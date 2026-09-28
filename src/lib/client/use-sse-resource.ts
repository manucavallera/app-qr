"use client";

import { useEffect } from "react";

export function useSseResource(url: string, refetch: () => void | Promise<void>): void {
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!active) return;
      void refetch();
    };

    const source = new EventSource(url);
    source.onopen = refresh;
    source.addEventListener("order.changed", refresh);
    // Do NOT refetch on onerror: the browser reconnects EventSource automatically.
    // Calling refetch on every error creates bursts of requests and unhandledRejections
    // when the component unmounts while a fetch is still in-flight.

    // Fallback: poll every 15 s only when the stream is not connected.
    const fallback = window.setInterval(() => {
      if (source.readyState !== EventSource.OPEN) refresh();
    }, 15_000);

    refresh();

    return () => {
      active = false;
      window.clearInterval(fallback);
      source.close();
    };
  }, [url, refetch]);
}
