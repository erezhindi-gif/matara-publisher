import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const businesses = await prisma.business.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(businesses);
}
