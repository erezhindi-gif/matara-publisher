import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SessionProvider from "@/components/SessionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
    <html lang="he" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-row bg-gray-50" dir="rtl">
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
