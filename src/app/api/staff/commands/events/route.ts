import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/modules/auth/require-staff";
import { orderEventStream } from "@/modules/realtime/sse-stream";

export async function GET(request: NextRequest): Promise<Response> {
  const principal = await requireStaff(request, ["ADMIN", "OPERATOR"]);
  if (principal instanceof NextResponse) return principal;
  return orderEventStream(request, "*");
}
