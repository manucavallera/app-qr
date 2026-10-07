import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/modules/auth/require-staff";

const staffRoles = ["ADMIN", "OPERATOR"] as const;

/** Who is signed in, so every staff screen can show the same menu. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, staffRoles);
  if (principal instanceof NextResponse) return principal;
  return NextResponse.json({ role: principal.role });
}
