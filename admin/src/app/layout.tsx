import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { AdminShell } from "@/components/AdminShell";
import { getStaffProfile } from "@/lib/staff";
import "./globals.css";

const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sortd Operations",
  description: "Staff console for Sortd orders, catalog, and delivery.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const me = await getStaffProfile();

  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body className={`${body.variable} antialiased`}>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {me ? (
          <AdminShell me={me}>{children}</AdminShell>
        ) : (
          <main id="main" className="min-h-dvh">
            {children}
          </main>
        )}
      </body>
    </html>
  );
}
