import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "../orders/errors";
import { getServerEnv, type ServerEnv } from "../../lib/env";

export type ImageContentType = "image/jpeg" | "image/png" | "image/webp";

export interface ImageStorage {
  put(input: { key: string; bytes: Uint8Array; contentType: ImageContentType }): Promise<void>;
  publicUrl(key: string): string;
  delete(key: string): Promise<void>;
}

const contentTypeByExtension: Record<string, ImageContentType> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function assertSafeImageKey(key: string): void {
  if (!/^[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(key)) {
    throw new DomainError("INVALID_IMAGE_KEY", "La clave de imagen no es válida.");
  }
}

export function detectImageContentType(bytes: Uint8Array): ImageContentType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= pngSignature.length && pngSignature.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export function generateImageKey(contentType: ImageContentType): string {
  const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  return `${randomBytes(24).toString("base64url")}.${extension}`;
}

export class LocalImageStorage implements ImageStorage {
  private readonly root: string;

  constructor(root = path.resolve(process.cwd(), "var/uploads")) {
    this.root = path.resolve(root);
  }

  private filePath(key: string): string {
    assertSafeImageKey(key);
    const filePath = path.resolve(this.root, key);
    if (!filePath.startsWith(`${this.root}${path.sep}`)) {
      throw new DomainError("INVALID_IMAGE_KEY", "La clave de imagen no es válida.");
    }
    return filePath;
  }

  async put(input: { key: string; bytes: Uint8Array; contentType: ImageContentType }): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.filePath(input.key), input.bytes, { flag: "wx" });
  }

  publicUrl(key: string): string {
    this.filePath(key);
    return `/uploads/${encodeURIComponent(key)}`;
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.filePath(key));
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }

  async read(key: string): Promise<{ bytes: Uint8Array; contentType: ImageContentType }> {
    const bytes = await readFile(this.filePath(key));
    const extension = key.split(".").at(-1) ?? "";
    const contentType = contentTypeByExtension[extension];
    if (!contentType) throw new DomainError("INVALID_IMAGE_KEY", "La clave de imagen no es válida.");
    return { bytes, contentType };
  }
}

export class S3ImageStorage implements ImageStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly publicBaseUrl: string,
  ) {}

  async put(input: { key: string; bytes: Uint8Array; contentType: ImageContentType }): Promise<void> {
    assertSafeImageKey(input.key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.bytes,
        ContentType: input.contentType,
      }),
    );
  }

  publicUrl(key: string): string {
    assertSafeImageKey(key);
    return `${this.publicBaseUrl}/${encodeURIComponent(key)}`;
  }

  async delete(key: string): Promise<void> {
    assertSafeImageKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

export function createImageStorage(env: ServerEnv = getServerEnv()): ImageStorage {
  if (env.IMAGE_STORAGE_DRIVER === "local") {
    return new LocalImageStorage(path.resolve(process.cwd(), env.UPLOAD_DIR));
  }

  const bucket = env.S3_BUCKET;
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new DomainError("INVALID_STORAGE_CONFIG", "Falta configurar el almacenamiento de imágenes.");
  }

  const endpoint = env.S3_ENDPOINT || undefined;
  const client = new S3Client({
    region: env.S3_REGION,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    credentials: { accessKeyId, secretAccessKey },
  });
  const publicBaseUrl = endpoint
    ? `${endpoint.replace(/\/$/, "")}/${bucket}`
    : `https://${bucket}.s3.${env.S3_REGION}.amazonaws.com`;
  return new S3ImageStorage(client, bucket, publicBaseUrl);
}
