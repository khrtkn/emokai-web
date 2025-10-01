import "@/styles/globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "SOFU AR Character Creator",
  description: "Create photorealistic AR characters and stages from your imagination."
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
