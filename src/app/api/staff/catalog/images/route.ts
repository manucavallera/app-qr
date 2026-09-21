import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import {
  createImageStorage,
  detectImageContentType,
  generateImageKey,
  type ImageContentType,
} from "@/modules/catalog/storage";

const staffRoles = ["ADMIN", "OPERATOR"] as const;
const maxImageBytes = 3 * 1024 * 1024;
const imageTypes = new Set<ImageContentType>(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, staffRoles);
  if (principal instanceof NextResponse) return principal;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "IMAGE_REQUIRED" }, { status: 400 });
    }
    if (file.size < 1 || file.size > maxImageBytes) {
      return NextResponse.json({ error: "IMAGE_SIZE_INVALID" }, { status: 413 });
    }
    if (!imageTypes.has(file.type as ImageContentType)) {
      return NextResponse.json({ error: "IMAGE_TYPE_NOT_ALLOWED" }, { status: 415 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const detectedType = detectImageContentType(bytes);
    if (!detectedType || detectedType !== file.type) {
      return NextResponse.json({ error: "IMAGE_CONTENT_INVALID" }, { status: 415 });
    }

    const key = generateImageKey(detectedType);
    const storage = createImageStorage();
    await storage.put({ key, bytes, contentType: detectedType });
    return NextResponse.json({ key, url: storage.publicUrl(key) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
