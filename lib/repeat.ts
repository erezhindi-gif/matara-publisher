// חישוב המועד הבא לקמפיין חוזר בימים קבועים, לפי שעון ישראל.
// השעה נשמרת לפי השעה המקומית של scheduledAt, כולל מעבר שעון קיץ/חורף.
const TZ = "Asia/Jerusalem";

function israelParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, wd };
}

// UTC של תאריך + שעה מקומיים בישראל
function israelToUtc(y: number, m: number, d: number, hh: number, mm: number) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const p = israelParts(new Date(guess));
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm) - guess;
  return new Date(guess - offset);
}

export function parseRepeatDays(s: string | null | undefined): number[] {
  if (!s) return [];
  return Array.from(new Set(s.split(",").map((x) => parseInt(x, 10)).filter((n) => n >= 0 && n <= 6))).sort();
}

export function nextRepeat(base: Date, days: number[], after: Date): Date | null {
  if (days.length === 0) return null;
  const { hh, mm } = israelParts(base);
  const start = israelParts(after);
  for (let i = 0; i <= 8; i++) {
    const day = new Date(Date.UTC(start.y, start.m - 1, start.d + i, 12));
    const p = israelParts(day);
    if (!days.includes(p.wd)) continue;
    const candidate = israelToUtc(p.y, p.m, p.d, hh, mm);
    if (candidate > after) return candidate;
  }
  return null;
}
