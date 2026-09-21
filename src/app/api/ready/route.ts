import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export async function GET(): Promise<NextResponse> { try { await prisma.$queryRaw`SELECT 1`; return NextResponse.json({ status: "ready", service: "app-qr" }); } catch { return NextResponse.json({ status: "unready", service: "app-qr" }, { status: 503 }); } }
