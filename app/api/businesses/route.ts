import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const businesses = await prisma.business.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(businesses);
}
