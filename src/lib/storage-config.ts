import { z } from "zod";

// Which private storage driver to use, from the environment. Pure, so it can be unit tested.
//
//   STORAGE_DRIVER=local  development only: ./storage on disk (refused in production)
//   STORAGE_DRIVER=s3     AWS S3 (e.g. ap-south-1, Mumbai) or Cloudflare R2 via S3_ENDPOINT

export type StorageConfig =
  | { driver: "local" }
  | {
      driver: "s3";
      bucket: string;
      region: string;
      endpoint?: string;
      /** Omit both to use the default AWS credential chain (IAM role) — preferred on AWS. */
      credentials?: { accessKeyId: string; secretAccessKey: string };
      sse: { mode: "AES256" } | { mode: "aws:kms"; kmsKeyId?: string } | { mode: "provider-default" };
    };

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optional = z.preprocess(blankToUndefined, z.string().trim().optional());

const s3Env = z
  .object({
    S3_BUCKET: z.string().trim().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, "S3_BUCKET is not a valid bucket name"),
    S3_REGION: z.preprocess(blankToUndefined, z.string().trim().default("ap-south-1")),
    S3_ENDPOINT: z.preprocess(blankToUndefined, z.url({ protocol: /^https$/ }).optional()),
    S3_ACCESS_KEY_ID: optional,
    S3_SECRET_ACCESS_KEY: optional,
    S3_SSE: z.preprocess(blankToUndefined, z.enum(["AES256", "aws:kms", "provider-default"]).default("AES256")),
    S3_KMS_KEY_ID: optional,
  })
  .refine((e) => !!e.S3_ACCESS_KEY_ID === !!e.S3_SECRET_ACCESS_KEY, {
    message: "Set both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, or neither (to use an IAM role)",
  })
  .refine((e) => e.S3_SSE !== "provider-default" || !!e.S3_ENDPOINT, {
    // AWS S3 itself must get an explicit SSE header; "provider-default" is for R2, which always encrypts at rest.
    message: "S3_SSE=provider-default is only for S3-compatible services set with S3_ENDPOINT (e.g. Cloudflare R2)",
  })
  .refine((e) => !e.S3_KMS_KEY_ID || e.S3_SSE === "aws:kms", { message: "S3_KMS_KEY_ID needs S3_SSE=aws:kms" });

export function storageConfigFromEnv(env: Record<string, string | undefined>): StorageConfig {
  const driver = env.STORAGE_DRIVER?.trim() || "local";
  if (driver === "local") {
    if (env.NODE_ENV === "production") {
      throw new Error("Local file storage is for development only. Set STORAGE_DRIVER=s3 and configure private object storage.");
    }
    return { driver: "local" };
  }
  if (driver !== "s3") throw new Error(`Unknown STORAGE_DRIVER "${driver}" (use "local" or "s3")`);

  const parsed = s3Env.safeParse(env);
  if (!parsed.success) {
    // Name the variables only — never echo their values (one may be a secret key).
    throw new Error(`Invalid S3 storage settings: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  }
  const e = parsed.data;
  return {
    driver: "s3",
    bucket: e.S3_BUCKET,
    region: e.S3_REGION,
    endpoint: e.S3_ENDPOINT,
    credentials: e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY ? { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY } : undefined,
    sse: e.S3_SSE === "aws:kms" ? { mode: "aws:kms", kmsKeyId: e.S3_KMS_KEY_ID } : { mode: e.S3_SSE },
  };
}

/** Server-side encryption parameters for PutObject. */
export function sseParams(sse: Extract<StorageConfig, { driver: "s3" }>["sse"]): {
  ServerSideEncryption?: "AES256" | "aws:kms";
  SSEKMSKeyId?: string;
} {
  if (sse.mode === "AES256") return { ServerSideEncryption: "AES256" };
  if (sse.mode === "aws:kms") return { ServerSideEncryption: "aws:kms", ...(sse.kmsKeyId ? { SSEKMSKeyId: sse.kmsKeyId } : {}) };
  return {};
}
