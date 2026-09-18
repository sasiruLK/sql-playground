import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

// Inter is what the curriculum site (da-lecs.vercel.app) sets everything in.
// It has no monospace of its own, so SQL gets JetBrains Mono, which shares
// Inter's upright, open shapes at the sizes the editor uses.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "SQL Playground",
  description:
    "Practise SQL against the LankaKart retail dataset in a private database that runs entirely in your browser.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zooming out below 1 lets students see wide result tables on a phone.
  minimumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#252525" },
  ],
};

/** Applies the saved theme before first paint, so the page never flashes. */
const THEME_SCRIPT = `try {
  var t = localStorage.getItem('sql-playground:theme');
  if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch {}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", inter.variable, jetbrainsMono.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
