import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import SiteHeader from "../components/site-header";
import SiteFooter from "../components/site-footer";
import GlobalScrollArrows from "../components/global-scroll-arrows";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "শিক্ষাসেতু | শিক্ষা ও ক্যারিয়ার প্ল্যাটফর্ম",
    template: "%s | শিক্ষাসেতু",
  },
  description:
    "শিক্ষা, চাকরির প্রস্তুতি, ভর্তি পরীক্ষা, অনলাইন কোর্স ও দক্ষতা উন্নয়নের জন্য একটি সমন্বিত ডিজিটাল প্ল্যাটফর্ম।",
  applicationName: "শিক্ষাসেতু",
  keywords: [
    "বাংলাদেশ শিক্ষা",
    "চাকরির প্রস্তুতি",
    "প্রশ্নব্যাংক",
    "অনলাইন পরীক্ষা",
    "অনলাইন কোর্স",
    "ডিজিটাল শিক্ষা",
  ],
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="bn"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        {children}
        <SiteFooter />
        <GlobalScrollArrows />
      </body>
    </html>
  );
}