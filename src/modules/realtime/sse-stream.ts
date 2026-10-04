import { encodeSse } from "./events";
import { subscribeOrder } from "./subscriber";

const HEARTBEAT_MS = 20_000;

/**
 * Server-sent events for one order, or for every order with "*".
 * The stream closes itself on any failure; the browser's EventSource
 * reconnects and the client refetches, so no single event is required.
 */
export function orderEventStream(request: Request, orderId: string): Response {
  const encoder = new TextEncoder();
  let dispose: () => void = () => undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let unsubscribe: () => void = () => undefined;
      const send = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(chunk)); } catch { dispose(); }
      };
      const heartbeat = setInterval(() => send(": heartbeat\n\n"), HEARTBEAT_MS);
      dispose = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch { /* already closed by the client */ }
      };
      request.signal.addEventListener("abort", dispose, { once: true });
      send(": connected\n\n");
      try {
        unsubscribe = await subscribeOrder(orderId, (event) => send(encodeSse(event)));
        if (closed) unsubscribe();
      } catch {
        dispose();
      }
    },
    cancel() { dispose(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
