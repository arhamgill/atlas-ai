import type { Metadata, Viewport } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { SiteNav } from "@/components/ui/SiteNav";
import { getSearchIndex } from "@/lib/db/queries";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AI Atlas — The global AI race, visualized",
    template: "%s · AI Atlas",
  },
  description:
    "An interactive intelligence platform for exploring global AI adoption, investment, research and development across 189 countries.",
  applicationName: "AI Atlas",
};

export const viewport: Viewport = {
  themeColor: "#07080a",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Under 10 KB for every country that has a page, so the palette can search
  // entirely on the client — a search that round-trips per keystroke never
  // feels instant.
  const searchIndex = await getSearchIndex();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="grain flex min-h-full flex-col">
        <NuqsAdapter>
          <SiteNav />
          <CommandPalette countries={searchIndex} />
          {children}
        </NuqsAdapter>
      </body>
    </html>
  );
}
