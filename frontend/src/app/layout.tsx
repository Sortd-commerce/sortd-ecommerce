import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { CartProvider } from "@/components/CartProvider";
import { PageTransition } from "@/components/PageTransition";
import { SiteHeader } from "@/components/SiteHeader";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const body = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const display = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sortd — only what passes",
  description: "Health-conscious products with lab-checked labels.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <CartProvider>
          <ToastProvider>
            <div className="site-bg" aria-hidden />
            <SiteHeader />
            <main id="main" className="shell pb-24 pt-2">
              <PageTransition>{children}</PageTransition>
            </main>
          </ToastProvider>
        </CartProvider>
      </body>
    </html>
  );
}
