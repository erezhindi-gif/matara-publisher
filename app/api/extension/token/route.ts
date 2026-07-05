import { prisma } from "@/lib/prisma";
import { newTokenExpiry } from "@/lib/apiToken";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!user.apiToken) {
    const token = crypto.randomBytes(32).toString("hex");
    // apiTokenDeviceId נשאר null בכוונה - נתפס אוטומטית ע"י המכשיר הראשון שישתמש בו
    user = await prisma.user.update({ where: { id: userId }, data: { apiToken: token, apiTokenExpiresAt: newTokenExpiry() } });
  }

  return NextResponse.json({ token: user.apiToken });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const token = crypto.randomBytes(32).toString("hex");
  // חידוש טוקן מאפס את שיוך המכשיר - הטוקן החדש ייתפס מחדש ע"י המכשיר הבא שישתמש בו
  await prisma.user.update({ where: { id: userId }, data: { apiToken: token, apiTokenDeviceId: null, apiTokenExpiresAt: newTokenExpiry() } });
  return NextResponse.json({ token });
}
