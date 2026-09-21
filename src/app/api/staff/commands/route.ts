import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { CommandService } from "@/modules/orders/command-service";
import { commandRepository } from "@/modules/orders/command-repository";
import { toOrderView } from "@/modules/orders/order-view";

const commands = new CommandService(commandRepository);
const roles = ["ADMIN", "OPERATOR"] as const;
export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, roles);
  if (principal instanceof NextResponse) return principal;
  try { const station = request.nextUrl.searchParams.get("station") ?? "GENERAL"; return NextResponse.json((await commands.list(station)).map(toOrderView), { headers: { "Cache-Control": "no-store" } }); } catch (error) { return apiErrorResponse(error); }
}
