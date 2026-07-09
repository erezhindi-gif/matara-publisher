import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SessionProvider from "@/components/SessionProvider";

// Rubik - תומך עברית באופן מלא, מראה מעוגל ומודרני יותר מ-Geist/Arial
const rubik = Rubik({
  variable: "--font-brand",
  subsets: ["latin", "hebrew"],
});

export const metadata: Metadata = {
  title: "Matara Publisher",
  description: "מערכת פרסום קמפיינים",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" className={`${rubik.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-row bg-[var(--background)]" dir="rtl">
        <SessionProvider>
          <Sidebar />
          <main className="flex-1 min-h-screen overflow-y-auto" dir="rtl">
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  );
}
