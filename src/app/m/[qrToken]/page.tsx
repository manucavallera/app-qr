import { MenuClient } from "./menu-client";

export default async function QRMenuPage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  return <MenuClient qrToken={qrToken} />;
}
