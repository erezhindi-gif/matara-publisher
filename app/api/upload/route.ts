import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files" }, { status: 400 });
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
