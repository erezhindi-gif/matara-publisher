import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";

const TOKEN_LIFETIME_DAYS = 90;

export function newTokenExpiry(): Date {
  return new Date(Date.now() + TOKEN_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
}

type ValidateResult = { user: User } | { error: NextResponse };

/**
 * מאמת apiToken מול deviceId - קורא לזה כל route שהתוסף פונה אליו
 * (jobs, jobs/[id], sync, sync/[id]). Trust On First Use: המכשיר הראשון
 * שמשתמש בטוקן "תופס" אותו; אחריו כל מכשיר אחר עם אותו טוקן נדחה.
 */
export async function validateApiToken(token: string | null, deviceId: string | null): Promise<ValidateResult> {
  if (!token) return { error: NextResponse.json({ error: "Missing token" }, { status: 401 }) };

  const user = await prisma.user.findUnique({ where: { apiToken: token } });
  if (!user) return { error: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };

  if (user.apiTokenExpiresAt && user.apiTokenExpiresAt < new Date()) {
    return { error: NextResponse.json({ error: "Token expired" }, { status: 401 }) };
  }

  if (!deviceId) return { error: NextResponse.json({ error: "Missing deviceId" }, { status: 401 }) };

  if (!user.apiTokenDeviceId) {
    // תפיסה ראשונה - קושר את הטוקן למכשיר הזה מעכשיו
    const updated = await prisma.user.update({ where: { id: user.id }, data: { apiTokenDeviceId: deviceId } });
    return { user: updated };
  }

  if (user.apiTokenDeviceId !== deviceId) {
    return { error: NextResponse.json({ error: "Token bound to a different device" }, { status: 401 }) };
  }

  return { user };
}
