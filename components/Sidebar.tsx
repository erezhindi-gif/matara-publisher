"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { getBusinessFilter, setBusinessFilter } from "@/lib/businessFilter";

type ProfileItem = { id: string; name: string; userId: string | null };

const NAV = [
  { href: "/campaigns",  icon: "⊞", label: "ניהול קמפיינים" },
  { href: "/profiles",   icon: "👤", label: "פרופילי פייסבוק" },
  { href: "/templates",  icon: "◧", label: "תבניות לקבוצות" },
  { href: "/schedule",   icon: "◷", label: "לוח תזמונים" },
  { href: "/analytics",  icon: "📊", label: "אנליטיקס" },
  { href: "/sync",       icon: "↻", label: "סנכרון קבוצות" },
  { href: "/settings",   icon: "⚙", label: "הגדרות" },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  if (path === "/login") return null;
  const [filter, setFilter] = useState("all");
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);

  useEffect(() => {
    setFilter(getBusinessFilter());
    const handler = () => setFilter(getBusinessFilter());
    window.addEventListener("businessFilterChange", handler);
    return () => window.removeEventListener("businessFilterChange", handler);
  }, []);

  useEffect(() => {
    if ((session?.user as { role?: string })?.role === "admin") {
      fetch("/api/profiles").then((r) => r.json()).then((data) => {
        if (Array.isArray(data)) {
          setProfiles(data);
          // אפס פילטר לא תקין
          const validValues = ["all", ...data.map((p: ProfileItem) => p.userId || p.id)];
          if (!validValues.includes(getBusinessFilter())) {
            setBusinessFilter("all");
            setFilter("all");
          }
        }
      });
    }
  }, [session]);

  function handleFilterChange(val: string) {
    setBusinessFilter(val);
    setFilter(val);
    router.refresh();
  }

  return (
    <aside className="w-64 min-h-screen bg-[#1c1934] text-white flex flex-col flex-shrink-0" dir="rtl">
      {/* Logo - סמל משולש/play בגרדיאנט המותג, כמו סימן "פרסום/שידור" */}
      <div className="px-6 py-7 flex items-center gap-2">
        <span className="text-2xl font-extrabold tracking-tight">Matara</span>
        <span className="w-6 h-6 rounded-lg brand-gradient flex items-center justify-center text-white text-xs">▶</span>
        <span className="text-2xl font-extrabold tracking-tight text-white/70">post</span>
      </div>

      {/* Profile selector - אדמין בלבד */}
      {(session?.user as { role?: string })?.role === "admin" && profiles.length > 0 && (
        <div className="px-3 py-3 mx-3 mb-1 rounded-2xl bg-white/5">
          <div className="text-xs text-white/40 mb-2 px-1 pt-1">פרופיל פעיל</div>
          <div className="space-y-1 pb-1">
            <button
              onClick={() => handleFilterChange("all")}
              className={`w-full text-right px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                filter === "all" ? "bg-[var(--brand-solid)] text-white" : "text-white/50 hover:text-white hover:bg-white/10"
              }`}
            >
              כל הפרופילים
            </button>
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => handleFilterChange(p.userId || p.id)}
                className={`w-full text-right px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  filter === (p.userId || p.id) ? "bg-[var(--brand-solid)] text-white" : "text-white/50 hover:text-white hover:bg-white/10"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1.5 px-4">
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                active ? "bg-blue-600 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>{item.label}</span>
              <span className="text-base w-5 text-center">{item.icon}</span>
            </Link>
          );
        })}
      </nav>

      {/* New campaign button */}
      <div className="px-4 pb-4">
        <Link
          href="/campaigns/new"
          className="flex items-center justify-center gap-2 w-full brand-gradient hover:opacity-90 text-white rounded-full px-4 py-3 text-sm font-semibold transition-opacity shadow-lg shadow-cyan-500/20"
        >
          <span>קמפיין חדש</span>
          <span>+</span>
        </Link>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold flex-shrink-0">
          {(session?.user?.name || "?").slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{session?.user?.name || "..."}</div>
          <div className="text-xs text-white/40 truncate">{session?.user?.email}</div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs text-white/40 hover:text-white transition-colors flex-shrink-0"
        >
          יציאה
        </button>
      </div>
    </aside>
  );
}
