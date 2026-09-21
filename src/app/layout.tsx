import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { PwaRegister } from "./pwa-register";

export const metadata: Metadata = {
  title: {
    default: "Pedidos QR",
    template: "%s | Pedidos QR",
  },
  description: "Carta y pedidos del bar",
  applicationName: "Pedidos QR",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111827",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-AR">
      <body><PwaRegister />{children}</body>
    </html>
  );
}
