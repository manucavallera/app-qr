import { z } from "zod";

const serverEnvSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    APP_URL: z.string().url(),
    SESSION_SECRET: z.string().min(32),
    PAYMENT_PROVIDER: z.enum(["fake", "mercadopago"]).default("fake"),
    MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
    MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
    IMAGE_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    UPLOAD_DIR: z.string().default("var/uploads"),
    S3_ENDPOINT: z.union([z.string().url(), z.literal("")]).optional(),
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
  })
  .superRefine((env, context) => {
    if (env.PAYMENT_PROVIDER === "mercadopago") {
      if (!env.MERCADOPAGO_ACCESS_TOKEN) {
        context.addIssue({
          code: "custom",
          path: ["MERCADOPAGO_ACCESS_TOKEN"],
          message: "is required when PAYMENT_PROVIDER is mercadopago",
        });
      }
      if (!env.MERCADOPAGO_WEBHOOK_SECRET) {
        context.addIssue({
          code: "custom",
          path: ["MERCADOPAGO_WEBHOOK_SECRET"],
          message: "is required when PAYMENT_PROVIDER is mercadopago",
        });
      }
    }

    if (env.IMAGE_STORAGE_DRIVER === "s3") {
      for (const key of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
        if (!env[key]) {
          context.addIssue({
            code: "custom",
            path: [key],
            message: "is required when IMAGE_STORAGE_DRIVER is s3",
          });
        }
      }
    }
  });

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("Pedidos QR"),
  NEXT_PUBLIC_SUPPORT_URL: z.union([z.string().url(), z.literal("")]).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parseServerEnv(input: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(input);

  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const key = issue.path.join(".") || "environment";
      return `${key}: ${issue.message}`;
    });

    throw new Error(`Configuración inválida del servidor:\n- ${problems.join("\n- ")}`);
  }

  return result.data;
}

export function parsePublicEnv(input: Record<string, string | undefined>): PublicEnv {
  return publicEnvSchema.parse(input);
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv(process.env);
}

export const publicEnv = parsePublicEnv(process.env);
