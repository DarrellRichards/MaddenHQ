import type { Metadata } from "next";
import { Chakra_Petch, Manrope } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const display = Chakra_Petch({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "MaddenHQ",
    template: "%s · MaddenHQ",
  },
  description:
    "Open-source Madden league HQ — multi-league stats, AI trades, and weekly awards.",
  icons: {
    icon: "/brand/maddenhq-mark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
