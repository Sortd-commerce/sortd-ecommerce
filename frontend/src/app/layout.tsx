import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Narrow, IBM_Plex_Mono, Libre_Baskerville } from "next/font/google";
import { BasketProvider } from "@/components/BasketProvider";
import { CartProvider } from "@/components/CartProvider";
import { PricingProvider } from "@/components/PricingProvider";
import { Chrome } from "@/components/Chrome";
import { PageTransition } from "@/components/PageTransition";
import { SiteHeader } from "@/components/SiteHeader";
import { ToastProvider } from "@/components/Toast";
import { fetchPricingRules } from "@/lib/catalog";
import { getAccessToken } from "@/lib/auth";
import "./globals.css";

const body = Archivo({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const display = Archivo_Narrow({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const brand = Libre_Baskerville({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "Sortd. Only what passes.",
  description: "Only what passes. Everything else is removed.",
};

export const viewport: Viewport = {
  themeColor: "#143503",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [signedIn, pricing] = await Promise.all([
    getAccessToken().then(Boolean),
    fetchPricingRules(),
  ]);
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${mono.variable} ${brand.variable} antialiased`}>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <CartProvider>
          <PricingProvider initialRules={pricing.ok ? pricing.data ?? null : null}>
            <ToastProvider>
              <BasketProvider>
                <div className="site-bg" aria-hidden />
                <Chrome header={<SiteHeader signedIn={signedIn} />} signedIn={signedIn}>
                  <PageTransition>{children}</PageTransition>
                </Chrome>
              </BasketProvider>
            </ToastProvider>
          </PricingProvider>
        </CartProvider>
      </body>
    </html>
  );
}
