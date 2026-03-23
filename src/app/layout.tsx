import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Global Investing Copilot",
  description: "A full-stack investing platform for US, Hong Kong, and China markets."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
