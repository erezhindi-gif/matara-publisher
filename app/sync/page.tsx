"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getBusinessFilter } from "@/lib/businessFilter";

const LOCAL_SERVER = "http://localhost:3333";

type Profile = { id: string; name: string; businessId: string; edgeProfile: string; userId: string | null };

export default function SyncPage() {
  const [status, setStatus] = useState<"idle" | "checking" | "syncing" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [businessFilter, setBusinessFilterState] = useState("all");

  useEffect(() => {
    setBusinessFilterState(getBusinessFilter());
    const handler = () => setBusinessFilterState(getBusinessFilter());
    window.addEventListener("businessFilterChange", handler);
    return () => window.removeEventListener("businessFilterChange", handler);
  }, []);

  useEffect(() => {
    fetch("/api/profiles").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) {
        setProfiles(data);
        // auto-select profile based on sidebar filter
        if (businessFilter !== "all") {
          const match = data.find((p: Profile) => p.userId === businessFilter);
          if (match) { setSelectedProfileId(match.id); return; }
        }
        if (data[0]) setSelectedProfileId(data[0].id);
      }
    });
  }, [businessFilter]);

  async function checkServer() {
    setStatus("checking");
    try {
      const res = await fetch(`${LOCAL_SERVER}/ping`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      if (data.ok) { setServerOnline(true); setStatus("idle"); }
    } catch {
      setServerOnline(false);
      setStatus("idle");
    }
  }

  async function startSync() {
    const profile = profiles.find((p) => p.id === selectedProfileId);
    if (!profile) return;
    setStatus("syncing");
    setMessage("פותח פייסבוק וסורק קבוצות...");
    try {
      const res = await fetch(`${LOCAL_SERVER}/sync-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: profile.businessId,
          edgeProfile: profile.edgeProfile || "Default",
        }),
        signal: AbortSignal.timeout(120000),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("done");
        setMessage(`הועלו ${data.count} קבוצות בהצלחה!`);
      } else {
        setStatus("error");
        setMessage(data.error || "שגיאה בסנכרון");
      }
    } catch {
      setStatus("error");
      setMessage("לא ניתן להתחבר לשרת המקומי. האם הוא פועל?");
    }
  }

  const visibleProfiles = businessFilter === "all"
    ? profiles
    : profiles.filter((p) => p.userId === businessFilter);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-gray-700 hover:text-gray-900">← ראשי</Link>
          <h1 className="text-2xl font-bold">סנכרון קבוצות פייסבוק</h1>
        </div>

        <div className="bg-blue-950/20 border border-blue-800/40 rounded-2xl p-5 mb-6">
          <h2 className="font-semibold text-blue-300 mb-3">לפני הסנכרון</h2>
          <p className="text-sm text-gray-700 mb-2">ודא שהשרת המקומי פועל על המחשב שלך:</p>
          <code className="block bg-white text-green-400 px-4 py-3 rounded-xl text-sm mb-3">
            node local-server.js
          </code>
          <p className="text-xs text-gray-500">הפעל פעם אחת ביום - השאר את החלון פתוח</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium mb-1">סטטוס השרת המקומי</div>
              <div className={`text-sm ${serverOnline === true ? "text-green-400" : serverOnline === false ? "text-red-400" : "text-gray-500"}`}>
                {serverOnline === true ? "פועל" : serverOnline === false ? "לא פועל - הפעל node local-server.js" : "לא נבדק"}
              </div>
            </div>
            <button
              onClick={checkServer}
              disabled={status === "checking"}
              className="bg-gray-200 hover:bg-gray-300 rounded-xl px-4 py-2 text-sm transition-colors disabled:opacity-50"
            >
              {status === "checking" ? "בודק..." : "בדוק חיבור"}
            </button>
          </div>
        </div>

        {/* בחירת פרופיל - רק אם אדמין עם "כל הפרופילים" */}
        {businessFilter === "all" && visibleProfiles.length > 1 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
            <label className="block text-sm text-gray-700 mb-2">סנכרן קבוצות עבור:</label>
            <select
              className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900"
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
            >
              {visibleProfiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        ) : selectedProfile ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
            <div className="text-sm text-gray-500 mb-1">סנכרן קבוצות עבור:</div>
            <div className="font-semibold">{selectedProfile.name}</div>
            <div className="text-xs text-gray-400 mt-1">Edge: {selectedProfile.edgeProfile || "Default"}</div>
          </div>
        ) : null}

        <button
          onClick={startSync}
          disabled={status === "syncing" || serverOnline === false || !selectedProfileId}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-400 rounded-2xl p-4 font-semibold text-lg transition-all shadow-lg shadow-blue-500/20"
        >
          {status === "syncing" ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⟳</span>
              מסנכרן...
            </span>
          ) : "סנכרן קבוצות עכשיו"}
        </button>

        {message && (
          <div className={`mt-4 rounded-2xl p-4 text-center ${status === "done" ? "bg-green-950/30 border border-green-800/40 text-green-300" : "bg-red-950/30 border border-red-800/40 text-red-300"}`}>
            {message}
          </div>
        )}

        {status === "done" && (
          <Link href="/templates" className="block mt-4 text-center text-blue-400 hover:underline text-sm">
            צפה בקבוצות שסונכרנו ←
          </Link>
        )}
      </div>
    </main>
  );
}
