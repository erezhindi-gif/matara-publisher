import { prisma } from "@/lib/prisma";
import { validateApiToken } from "@/lib/apiToken";
import { NextRequest, NextResponse } from "next/server";

// זוגות חשודים: אותו שם קבוצה בדיוק, כאשר אחד מהם fbGroupId מספרי טהור
// (ID פנימי יציב של פייסבוק) והשני לא (סלאג וניטי). ראה project-map.md -
// זה הדפוס שאומת ידנית ב-2026-07-10 כנובע מ-walkForGroups() שקולט את אותה
// קבוצה משני מבנים שונים בתגובת ה-GraphQL של פייסבוק.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  const businessId = req.nextUrl.searchParams.get("businessId");

  const auth = await validateApiToken(token, deviceId);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const templates = await prisma.groupTemplate.findMany({
    where: { userId: user.id, ...(businessId ? { businessId } : {}) },
  });
  if (templates.length === 0) return NextResponse.json({ suspects: [] });

  const suspects: { templateId: string; name: string; numericFbGroupId: string; slugFbGroupId: string }[] = [];

  for (const t of templates) {
    const rows = await prisma.$queryRawUnsafe<{ name: string; ids: string[] }[]>(
      `
      SELECT name, array_agg("fbGroupId") as ids
      FROM "Group"
      WHERE "templateId" = $1
      GROUP BY name
      HAVING COUNT(*) > 1
        AND bool_or("fbGroupId" ~ '^[0-9]+$')
        AND bool_or("fbGroupId" !~ '^[0-9]+$')
      `,
      t.id
    );

    for (const row of rows) {
      const numericIds = row.ids.filter((id) => /^[0-9]+$/.test(id));
      const slugIds = row.ids.filter((id) => !/^[0-9]+$/.test(id));
      // מיזוג לכל slug מול ה-ID המספרי הראשון (אם יש כמה slugs לאותו שם, כל אחד זוג נפרד)
      const numericId = numericIds[0];
      for (const slugId of slugIds) {
        suspects.push({ templateId: t.id, name: row.name, numericFbGroupId: numericId, slugFbGroupId: slugId });
      }
    }
  }

  return NextResponse.json({ suspects });
}
