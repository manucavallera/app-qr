import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { UserAdminService } from "@/modules/auth/user-admin-service";
const roles = ["ADMIN"] as const;
export async function GET(request: NextRequest) { const principal = await requireStaff(request, roles); if (principal instanceof NextResponse) return principal; return NextResponse.json(await prisma.staffUser.findMany({ select: { id: true, email: true, displayName: true, role: true, active: true }, orderBy: { createdAt: "asc" } })); }
export async function POST(request: NextRequest) { const principal = await requireStaff(request, roles); if (principal instanceof NextResponse) return principal; try { return NextResponse.json(await new UserAdminService(prisma).create(await request.json(), principal.userId), { status: 201 }); } catch (error) { return apiErrorResponse(error); } }
export async function DELETE(request: NextRequest) { const principal = await requireStaff(request, roles); if (principal instanceof NextResponse) return principal; try { const id = new URL(request.url).searchParams.get("id"); if (!id) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 }); await new UserAdminService(prisma).deactivate(id, principal.userId); return NextResponse.json({ ok: true }); } catch (error) { return apiErrorResponse(error); } }
