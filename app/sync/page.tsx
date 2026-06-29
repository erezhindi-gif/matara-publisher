"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getBusinessFilter } from "@/lib/businessFilter";

type Profile = { id: string; name: string; businessId: string; userId: string | null };

export default function SyncPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [businessFilter, setBusinessFilterState] = useState("all");
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [groupCount, setGroupCount] = useState<number | null>(null);
  const [groupsFound, setGroupsFound] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setBusinessFilterState(getBusinessFilter());
    const handler = () => setBusinessFilterState(getBusinessFilter());
    window.addEventListener("businessFilterChange", handler);
    return () => window.removeEventListener("businessFilterChange", handler);
  }, []);

  useEffect(() => {
    fetch("/api/profiles").then((r) => r.json()).then((data) => {
      if (!Array.isArray(data)) return;
      setProfiles(data);
      if (businessFilter !== "all") {
        const match = data.find((p: Profile) => p.userId === businessFilter);
        if (match) { setSelectedProfileId(match.id); return; }
      }
      if (data[0]) setSelectedProfileId(data[0].id);
    });
  }, [businessFilter]);

  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/extension/sync/${jobId}`);
      const { job } = await res.json();
      setJobStatus(job.status);
      setGroupCount(job.groupCount);
      setGroupsFound(job.groupsFound || 0);
      if (job.error) setError(job.error);
      if (["done", "failed", "cancelled"].includes(job.status)) {
        clearInterval(pollRef.current!);
      }
    }, 2000);
    return () => clearInterval(pollRef.current!);
  }, [jobId]);

  async function startSync() {
    const profile = profiles.find((p) => p.id === selectedProfileId);
    if (!profile) return;
    setError(null);
    setGroupCount(null);
    setGroupsFound(0);
    setJobStatus("waiting");

    const res = await fetch("/api/extension/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: profile.businessId }),
    });
    const { job } = await res.json();
    setJobId(job.id);
  }

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
  const visibleProfiles = businessFilter === "all" ? profiles : profiles.filter((p) => p.userId === businessFilter);
  const isRunning = jobStatus === "waiting" || jobStatus === "running" || jobStatus === "pending";

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-gray-700 hover:text-gray-900">← ראשי</Link>
          <h1 className="text-2xl font-bold">סנכרון קבוצות פייסבוק</h1>
        </div>

        {/* הוראות */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6">
          <h2 className="font-semibold text-blue-800 mb-2">איך זה עובד?</h2>
          <p className="text-sm text-blue-700">
            לחץ "סנכרן" - תוסף Matara Publisher בדפדפן שלך יפתח פייסבוק ברקע, יסרוק את הקבוצות שלך ויעלה אותן למערכת.
          </p>
          <p className="text-sm text-blue-600 mt-2 font-medium">⚡ חייב להיות מותקן תוסף Matara Publisher בדפדפן</p>
        </div>

        {/* בחירת פרופיל */}
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
          </div>
        ) : null}

        {/* כפתור סנכרון */}
        <button
          onClick={startSync}
          disabled={isRunning || !selectedProfileId}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-400 disabled:to-gray-400 rounded-2xl p-4 font-semibold text-lg text-white transition-all shadow-lg shadow-blue-500/20"
        >
          {isRunning ? "מסנכרן..." : "סנכרן קבוצות עכשיו"}
        </button>

        {/* סטטוס */}
        {jobStatus && (
          <div className={`mt-6 rounded-2xl p-5 text-center border ${
            jobStatus === "done" ? "bg-green-50 border-green-200" :
            jobStatus === "failed" ? "bg-red-50 border-red-200" :
            "bg-blue-50 border-blue-200"
          }`}>
            {jobStatus === "waiting" && (
              <div>
                <div className="text-2xl mb-2">⏳</div>
                <div className="font-semibold text-blue-800">ממתין לתוסף...</div>
                <div className="text-sm text-blue-600 mt-1">התוסף יתחיל לסרוק תוך 30 שניות</div>
              </div>
            )}
            {(jobStatus === "pending" || jobStatus === "running") && (
              <div>
                <div className="text-2xl mb-2 animate-spin inline-block">⟳</div>
                <div className="font-semibold text-blue-800">סורק קבוצות...</div>
                {groupsFound > 0 && (
                  <div className="text-3xl font-bold text-blue-700 mt-2">{groupsFound}</div>
                )}
                <div className="text-sm text-blue-600 mt-1">
                  {groupsFound > 0 ? `קבוצות נמצאו עד כה` : "פייסבוק נפתח ברקע"}
                </div>
              </div>
            )}
            {jobStatus === "done" && (
              <div>
                <div className="text-4xl mb-2">✅</div>
                <div className="font-semibold text-green-800">סנכרון הושלם!</div>
                {groupCount && <div className="text-green-700 mt-1">{groupCount} קבוצות נוספו למערכת</div>}
                <Link href="/templates" className="block mt-3 text-blue-600 hover:underline text-sm">
                  צפה בקבוצות ←
                </Link>
              </div>
            )}
            {jobStatus === "failed" && (
              <div>
                <div className="text-4xl mb-2">❌</div>
                <div className="font-semibold text-red-800">הסנכרון נכשל</div>
                {error && <div className="text-red-600 text-sm mt-1">{error}</div>}
                <div className="text-sm text-red-500 mt-2">ודא שהתוסף מותקן ופייסבוק פתוח</div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
