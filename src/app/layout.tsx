import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "SOFU AR Character Creator",
  description: "Create photorealistic AR characters and stages from your imagination."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body className="bg-canvas text-textPrimary min-h-screen">{children}</body>
    </html>
  );
}
