import type { Viewport } from "next";
import { Raleway } from "next/font/google";
import type { ReactNode } from "react";
import "./customer-menu.css";

// Brand titles use Noka once the owner has a commercial license; Raleway covers everything until then.
const display = Raleway({ subsets: ["latin"], style: ["normal", "italic"], variable: "--cm-font-display", display: "swap" });
const body = Raleway({ subsets: ["latin"], style: ["normal", "italic"], variable: "--cm-font-body", display: "swap" });

export const viewport: Viewport = {
  themeColor: "#311c47",
};

export default function CustomerLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className={`cm-root ${display.variable} ${body.variable}`}>{children}</div>;
}
