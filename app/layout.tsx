import "../lib/fonts/_active.css";
import "../lib/fonts/_vars.css";
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/hooks/useAuth";

export const metadata: Metadata = {
  title: "UKPLUS Admin - 管理者・教師用システム",
  description: "UKPLUS Osakaの管理者・教師向け予約・学習管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased font-body">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
