import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { BRAND_NAME } from "@/lib/brand";
import "./globals.css";

// Every page reads live prices and stock from the database.
export const dynamic = "force-dynamic";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: BRAND_NAME, template: `%s | ${BRAND_NAME}` },
  description: "Order medicines and health products online — store pickup or local delivery.",
};

// The site chrome lives in the route-group layouts: (shop) for the storefront, (checkout) for cart and
// checkout, and login/ for sign-in.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
