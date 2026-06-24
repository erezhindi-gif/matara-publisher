"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/campaigns",  icon: "⊞", label: "ניהול קמפיינים" },
  { href: "/profiles",   icon: "👤", label: "פרופילי פייסבוק" },
  { href: "/templates",  icon: "◧", label: "תבניות לקבוצות" },
  { href: "/schedule",   icon: "◷", label: "לוח תזמונים" },
  { href: "/sync",       icon: "↻", label: "סנכרון קבוצות" },
  { href: "/settings",   icon: "⚙", label: "הגדרות" },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col flex-shrink-0" dir="ltr">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-gray-700">
        <div className="text-lg font-bold text-white tracking-wide">Matara</div>
        <div className="text-xs text-gray-400 mt-0.5">Publisher</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-3">
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* New campaign button */}
      <div className="px-3 pb-4">
        <Link
          href="/campaigns/new"
          className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          <span>+</span>
          <span>קמפיין חדש</span>
        </Link>
      </div>

      {/* User */}
      <div className="px-5 py-4 border-t border-gray-700">
        <div className="text-sm font-medium text-white">נועה הינדי</div>
        <div className="text-xs text-gray-500 mt-0.5">noa@matarahr.co.il</div>
      </div>
    </aside>
  );
}
