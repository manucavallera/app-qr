import type { Metadata, Viewport } from "next";
import { Raleway } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { PwaRegister } from "./pwa-register";

const raleway = Raleway({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-raleway",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "WAKE",
    template: "%s | WAKE",
  },
  description: "Carta y pedidos del bar",
  applicationName: "WAKE",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#311c47",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-AR" className={`${raleway.className} ${raleway.variable}`}>
      <body><PwaRegister />{children}</body>
    </html>
  );
}
