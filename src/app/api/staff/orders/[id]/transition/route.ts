import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { CommandService } from "@/modules/orders/command-service";
import { commandRepository } from "@/modules/orders/command-repository";
import { toOrderView } from "@/modules/orders/order-view";
type RouteContext = { params: Promise<{ id: string }> };
const commands = new CommandService(commandRepository);
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> { const principal = await requireStaff(request, ["ADMIN", "OPERATOR"]); if (principal instanceof NextResponse) return principal; try { const { id } = await params; return NextResponse.json(toOrderView(await commands.transitionOrder(id, await request.json(), principal.userId, principal.role))); } catch (error) { return apiErrorResponse(error); } }
