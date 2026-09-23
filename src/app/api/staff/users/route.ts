import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { UserAdminService } from "@/modules/auth/user-admin-service";
import { z } from "zod";
const roles = ["ADMIN"] as const;
const createSchema = z.object({
  email: z.string().trim().email().max(254),
  displayName: z.string().trim().min(1).max(80),
  password: z.string().min(8).max(1024),
  role: z.enum(["ADMIN", "OPERATOR"]),
}).strict();
const updateSchema = z.object({
  id: z.string().uuid(),
  email: z.string().trim().email().max(254).optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
  password: z.string().min(8).max(1024).optional(),
  role: z.enum(["ADMIN", "OPERATOR"]).optional(),
  active: z.boolean().optional(),
}).strict().refine((input) => Object.keys(input).length > 1, "No hay cambios para guardar.");
export async function GET(request: NextRequest) { const principal = await requireStaff(request, roles); if (principal instanceof NextResponse) return principal; return NextResponse.json(await prisma.staffUser.findMany({ select: { id: true, email: true, displayName: true, role: true, active: true }, orderBy: { createdAt: "asc" } })); }
export async function POST(request: NextRequest) { const principal = await requireStaff(request, roles); if (principal instanceof NextResponse) return principal; try { return NextResponse.json(await new UserAdminService(prisma).create(createSchema.parse(await request.json()), principal.userId), { status: 201 }); } catch (error) { return apiErrorResponse(error); } }
export async function PATCH(request: NextRequest) { const principal = await requireStaff(request, roles); if (principal instanceof NextResponse) return principal; try { return NextResponse.json(await new UserAdminService(prisma).update(updateSchema.parse(await request.json()), principal.userId)); } catch (error) { return apiErrorResponse(error); } }
export async function DELETE(request: NextRequest) { const principal = await requireStaff(request, roles); if (principal instanceof NextResponse) return principal; try { const id = new URL(request.url).searchParams.get("id"); if (!id) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 }); await new UserAdminService(prisma).deactivate(id, principal.userId); return NextResponse.json({ ok: true }); } catch (error) { return apiErrorResponse(error); } }
