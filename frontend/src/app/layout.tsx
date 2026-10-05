import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { BasketProvider } from "@/components/BasketProvider";
import { CartProvider } from "@/components/CartProvider";
import { PricingProvider } from "@/components/PricingProvider";
import { Chrome } from "@/components/Chrome";
import { PageTransition } from "@/components/PageTransition";
import { SiteHeader } from "@/components/SiteHeader";
import { ToastProvider } from "@/components/Toast";
import { getAccessToken } from "@/lib/auth";
import "./globals.css";

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Sortd. Only what passes.",
  description: "Only what passes. Everything else is removed.",
};

export const viewport: Viewport = {
  themeColor: "#1B4D36",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const signedIn = Boolean(await getAccessToken());
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <CartProvider>
          <PricingProvider>
            <ToastProvider>
              <BasketProvider>
                <div className="site-bg" aria-hidden />
                <Chrome header={<SiteHeader />} signedIn={signedIn}>
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
