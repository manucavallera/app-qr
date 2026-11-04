import type { Viewport } from "next";
import { Geist, Outfit } from "next/font/google";
import type { ReactNode } from "react";
import "./customer-menu.css";

const display = Outfit({ subsets: ["latin"], variable: "--cm-font-display", display: "swap" });
const body = Geist({ subsets: ["latin"], variable: "--cm-font-body", display: "swap" });

export const viewport: Viewport = {
  themeColor: "#311c47",
};

export default function CustomerLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className={`cm-root ${display.variable} ${body.variable}`}>{children}</div>;
}
