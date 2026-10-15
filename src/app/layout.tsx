import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME } from "@/shared/brand";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Đoán ảnh vệ tinh, bấm chuông và giành điểm.",
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
