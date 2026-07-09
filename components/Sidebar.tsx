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
    <aside className="w-60 min-h-screen bg-[#181225] text-white flex flex-col flex-shrink-0" dir="ltr">
      {/* Logo */}
      <div className="px-5 py-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl brand-gradient flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-purple-900/40">
          M
        </div>
        <div>
          <div className="text-lg font-bold text-white tracking-wide leading-none">Matara</div>
          <div className="text-xs text-white/40 mt-1">Publisher</div>
        </div>
      </div>

      {/* Profile selector - אדמין בלבד */}
      {(session?.user as { role?: string })?.role === "admin" && profiles.length > 0 && (
        <div className="px-3 py-3 mx-3 mb-1 rounded-2xl bg-white/5">
          <div className="text-xs text-white/40 mb-2 px-1 pt-1">פרופיל פעיל</div>
          <div className="space-y-1 pb-1">
            <button
              onClick={() => handleFilterChange("all")}
              className={`w-full text-right px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                filter === "all" ? "brand-gradient text-white shadow-md shadow-purple-900/30" : "text-white/50 hover:text-white hover:bg-white/10"
              }`}
            >
              כל הפרופילים
            </button>
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => handleFilterChange(p.userId || p.id)}
                className={`w-full text-right px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  filter === (p.userId || p.id) ? "brand-gradient text-white shadow-md shadow-purple-900/30" : "text-white/50 hover:text-white hover:bg-white/10"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-1 px-3">
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active ? "brand-gradient text-white shadow-md shadow-purple-900/30" : "text-white/50 hover:text-white hover:bg-white/10"
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* New campaign button */}
      <div className="px-3 pb-3">
        <Link
          href="/campaigns/new"
          className="flex items-center justify-center gap-2 w-full brand-gradient hover:opacity-90 text-white rounded-full px-4 py-3 text-sm font-semibold transition-opacity shadow-lg shadow-purple-900/40"
        >
          <span>+</span>
          <span>קמפיין חדש</span>
        </Link>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="text-sm font-medium text-white">{session?.user?.name || "..."}</div>
        <div className="text-xs text-white/40 mt-0.5">{session?.user?.email}</div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-2 text-xs text-white/40 hover:text-white transition-colors"
        >
          יציאה
        </button>
      </div>
    </aside>
  );
}
