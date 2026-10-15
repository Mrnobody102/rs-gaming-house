import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EARTH//PLAY",
  description: "Trắc nghiệm và ghép ảnh trên một màn hình chung.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
