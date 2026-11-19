import { NextRequest, NextResponse } from "next/server";
import { requireApiKey, getUserGroups } from "@/lib/externalAuth";

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req);
  if ("error" in auth) return auth.error;

  const groups = await getUserGroups(auth.user.id);
  return NextResponse.json(
    groups.map((g) => ({ id: g.id, fbGroupId: g.fbGroupId, name: g.name, memberCount: g.memberCount, syncedAt: g.lastSeenAt })),
  );
}
