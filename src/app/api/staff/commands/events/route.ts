import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/modules/auth/require-staff";
import { encodeSse } from "@/modules/realtime/events";
import { subscribeOrder } from "@/modules/realtime/subscriber";

export async function GET(request: NextRequest): Promise<Response> {
  const principal = await requireStaff(request, ["ADMIN", "OPERATOR"]);
  if (principal instanceof NextResponse) return principal;
  const encoder = new TextEncoder();
  let cleanups: Array<() => void> = [];
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));
      cleanups.push(await subscribeOrder("*", (event) => controller.enqueue(encoder.encode(encodeSse(event)))));
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": heartbeat\n\n")), 20_000);
      request.signal.addEventListener("abort", () => { clearInterval(heartbeat); cleanups.forEach((cleanup) => cleanup()); controller.close(); }, { once: true });
    },
    cancel() { cleanups.forEach((cleanup) => cleanup()); cleanups = []; },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
