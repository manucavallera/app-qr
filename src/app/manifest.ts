import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name: "Pedidos QR", short_name: "Pedidos QR", description: "Carta y pedidos del bar", start_url: "/", display: "standalone", background_color: "#f4f3ef", theme_color: "#263a30", icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] }; }
