import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Quorum — a little clarity, together",
  description:
    "Private, real-time estimation for teams. Pick your cards, share a room, and find your next number together.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
