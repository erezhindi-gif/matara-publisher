import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobTitle, location, whatsappLink, emailLink, businessName } = await req.json();

  const systemPrompt = `אתה מומחה לכתיבת פוסטים שיווקיים בפייסבוק עבור עסקים.
כתוב פוסטים קצרים, מקצועיים ומשכנעים בעברית.
סגנון: ישיר, ברור, מרשים.`;

  const userPrompt = `צור פוסט עבור "${businessName || "העסק"}":
תיאור: ${jobTitle}
${location ? `מיקום: ${location}` : ""}
${whatsappLink ? `קישור וואטסאפ: ${whatsappLink}` : ""}
${emailLink ? `אימייל: ${emailLink}` : ""}

צור 2 גרסאות - גרסה א וגרסה ב. החזר JSON בפורמט:
{"versionA": "...", "versionB": "..."}`;

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }

  const versions = JSON.parse(jsonMatch[0]);
  return NextResponse.json(versions);
}
