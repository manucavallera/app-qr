import type { Viewport } from "next";
import type { ReactNode } from "react";

export const viewport: Viewport = { themeColor: "#0c0e0c" };

export default function CustomerLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
