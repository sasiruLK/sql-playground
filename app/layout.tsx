import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SQL Playground",
  description: "Run safe read-only SQL queries against a demo Postgres dataset.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
