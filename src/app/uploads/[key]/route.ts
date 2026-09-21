import { NextResponse } from "next/server";
import { LocalImageStorage, createImageStorage } from "@/modules/catalog/storage";

type RouteContext = { params: Promise<{ key: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const storage = createImageStorage();
  if (!(storage instanceof LocalImageStorage)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const { key } = await context.params;
    const image = await storage.read(key);
    const body = new ArrayBuffer(image.bytes.byteLength);
    new Uint8Array(body).set(image.bytes);
    return new Response(body, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
}
