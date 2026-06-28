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
        if (Array.isArray(data)) setProfiles(data);
      });
    }
  }, [session]);

  function handleFilterChange(val: string) {
    setBusinessFilter(val);
    setFilter(val);
    router.refresh();
  }

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col flex-shrink-0" dir="ltr">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-700">
        <div className="text-lg font-bold text-white tracking-wide">Matara</div>
        <div className="text-xs text-gray-400 mt-0.5">Publisher</div>
      </div>

      {/* Profile selector - אדמין בלבד */}
      {(session?.user as { role?: string })?.role === "admin" && profiles.length > 0 && (
        <div className="px-3 py-3 border-b border-gray-700">
          <div className="text-xs text-gray-500 mb-2 px-1">פרופיל פעיל</div>
          <div className="space-y-1">
            <button
              onClick={() => handleFilterChange("all")}
              className={`w-full text-right px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                filter === "all" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              כל הפרופילים
            </button>
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => handleFilterChange(p.userId || p.id)}
                className={`w-full text-right px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  filter === (p.userId || p.id) ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
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
                active ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
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
          className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          <span>+</span>
          <span>קמפיין חדש</span>
        </Link>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-700">
        <div className="text-sm font-medium text-white">{session?.user?.name || "..."}</div>
        <div className="text-xs text-gray-500 mt-0.5">{session?.user?.email}</div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-2 text-xs text-gray-500 hover:text-white transition-colors"
        >
          יציאה
        </button>
      </div>
    </aside>
  );
}
