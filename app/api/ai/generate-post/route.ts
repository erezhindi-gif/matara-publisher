import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  const { jobTitle, location, whatsappLink, emailLink, businessType } =
    await req.json();

  const isRecruitment = businessType === "recruitment";

  const systemPrompt = isRecruitment
    ? `אתה מומחה לכתיבת פרסומי גיוס עובדים בפייסבוק.
כתוב פוסטים קצרים, תכליתיים ומקצועיים בעברית.
סגנון: ישיר, ברור, ללא עודף מילים.
מבנה: כותרת עם תפקיד ומיקום, תיאור קצר, דרישות, קישור.`
    : `אתה מומחה לשיווק עסקי ברשתות חברתיות.
כתוב פוסטים יוקרתיים ורשמיים עבור "נויה מטבחים BY EREZ HINDI".
סגנון: יוקרתי, מקצועי, קצר ומרשים.`;

  const userPrompt = isRecruitment
    ? `צור פוסט גיוס עבור:
תפקיד: ${jobTitle}
מיקום: ${location}
${whatsappLink ? `קישור וואטסאפ: ${whatsappLink}` : ""}
${emailLink ? `אימייל: ${emailLink}` : ""}

צור 2 גרסאות - גרסה א וגרסה ב. החזר JSON בפורמט:
{"versionA": "...", "versionB": "..."}`
    : `צור פוסט שיווקי עבור נויה מטבחים:
תיאור העבודה/מוצר: ${jobTitle}
${location ? `אזור: ${location}` : ""}
${whatsappLink ? `קישור וואטסאפ: ${whatsappLink}` : ""}

צור 2 גרסאות - גרסה א וגרסה ב. החזר JSON בפורמט:
{"versionA": "...", "versionB": "..."}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
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
