import type { Viewport } from "next";
import { Geist, Outfit } from "next/font/google";
import type { ReactNode } from "react";
import "./customer-menu.css";

const display = Outfit({ subsets: ["latin"], variable: "--cm-font-display", display: "swap" });
const body = Geist({ subsets: ["latin"], variable: "--cm-font-body", display: "swap" });

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#15100d" },
  ],
};

export default function CustomerLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className={`cm-root ${display.variable} ${body.variable}`}>{children}</div>;
}
