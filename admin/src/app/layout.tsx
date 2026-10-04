import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { AdminNav } from "@/components/AdminNav";
import "./globals.css";

const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sortd Admin",
  description: "Staff console for Sortd orders, catalog, and delivery.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body className={`${body.variable} antialiased`}>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <AdminNav />
        <main id="main" className="shell pb-16">
          {children}
        </main>
      </body>
    </html>
  );
}
