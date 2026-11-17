import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files" }, { status: 400 });
  }

  // נבדק לפני העלאה כלשהי: אחסון ה-Blob ציבורי, ולא רוצים שיתמלא בקבצים שאינם תמונות
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: `קובץ לא נתמך: ${file.name}` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `קובץ גדול מ-10MB: ${file.name}` }, { status: 400 });
    }
  }

  const urls: string[] = [];

  for (const file of files) {
    const ext = file.name.split(".").pop();
    const filename = `campaigns/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const blob = await put(filename, file, { access: "public" });
    urls.push(blob.url);
  }

  return NextResponse.json({ urls });
}
