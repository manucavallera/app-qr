import { NextRequest, NextResponse } from "next/server";
import { CUSTOMER_SESSION_COOKIE } from "@/modules/tables/customer-session-service";
import { authenticateCustomerSession } from "@/modules/tables/customer-session-auth";
import { orderRepository } from "@/modules/orders/order-repository";
import { encodeSse } from "@/modules/realtime/events";
import { subscribeOrder } from "@/modules/realtime/subscriber";

type RouteContext = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: RouteContext): Promise<Response> {
  const principal = await authenticateCustomerSession(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  const { id } = await params;
  if (!principal || !await orderRepository.findCustomerOrder(id, principal.id)) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  const encoder = new TextEncoder();
  let cleanup: () => void = () => undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));
      cleanup = await subscribeOrder(id, (event) => controller.enqueue(encoder.encode(encodeSse(event))));
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": heartbeat\n\n")), 20_000);
      request.signal.addEventListener("abort", () => { clearInterval(heartbeat); cleanup(); controller.close(); }, { once: true });
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
