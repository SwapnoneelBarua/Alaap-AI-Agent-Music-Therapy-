import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alaap — a moment with music",
  description: "A gentle, music-supported mood check-in.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
