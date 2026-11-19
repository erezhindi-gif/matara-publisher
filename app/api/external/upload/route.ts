import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/externalAuth";

const MAX_BYTES = 10 * 1024 * 1024;

// כמו /api/upload של הדשבורד, אבל עם מפתח API ותמונה אחת בלבד
export async function POST(req: NextRequest) {
  const auth = await requireApiKey(req);
  if ("error" in auth) return auth.error;

  const formData = await req.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length !== 1) return NextResponse.json({ error: "Send exactly one image in field 'files'" }, { status: 400 });

  const file = files[0];
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: `קובץ לא נתמך: ${file.name}` }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: `קובץ גדול מ-10MB: ${file.name}` }, { status: 400 });

  const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
  const filename = `campaigns/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const blob = await put(filename, file, { access: "public" });
  return NextResponse.json({ urls: [blob.url] });
}
