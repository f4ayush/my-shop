import { describe, expect, it } from "vitest";
import { sseParams, storageConfigFromEnv } from "./storage-config";

describe("storageConfigFromEnv", () => {
  it("defaults to local disk in development", () => {
    expect(storageConfigFromEnv({ NODE_ENV: "development" })).toEqual({ driver: "local" });
    expect(storageConfigFromEnv({ NODE_ENV: "development", STORAGE_DRIVER: "" })).toEqual({ driver: "local" });
  });

  it("refuses local storage in production, set or defaulted", () => {
    expect(() => storageConfigFromEnv({ NODE_ENV: "production" })).toThrow(/development only/);
    expect(() => storageConfigFromEnv({ NODE_ENV: "production", STORAGE_DRIVER: "local" })).toThrow(/development only/);
  });

  it("rejects unknown drivers", () => {
    expect(() => storageConfigFromEnv({ STORAGE_DRIVER: "gcs" })).toThrow(/Unknown STORAGE_DRIVER/);
  });

  it("AWS S3 in Mumbai with an IAM role: SSE-S3 by default", () => {
    const c = storageConfigFromEnv({ NODE_ENV: "production", STORAGE_DRIVER: "s3", S3_BUCKET: "my-pharmacy-rx" });
    expect(c).toEqual({
      driver: "s3",
      bucket: "my-pharmacy-rx",
      region: "ap-south-1",
      endpoint: undefined,
      credentials: undefined,
      sse: { mode: "AES256" },
    });
  });

  it("AWS S3 with a KMS key", () => {
    const c = storageConfigFromEnv({
      STORAGE_DRIVER: "s3",
      S3_BUCKET: "my-pharmacy-rx",
      S3_SSE: "aws:kms",
      S3_KMS_KEY_ID: "alias/pharmacy-rx",
    });
    expect(c.driver === "s3" && c.sse).toEqual({ mode: "aws:kms", kmsKeyId: "alias/pharmacy-rx" });
  });

  it("Cloudflare R2 with keys and provider-default encryption", () => {
    const c = storageConfigFromEnv({
      STORAGE_DRIVER: "s3",
      S3_BUCKET: "pharmacy-rx",
      S3_REGION: "auto",
      S3_ENDPOINT: "https://accountid.r2.cloudflarestorage.com",
      S3_ACCESS_KEY_ID: "test-access-key",
      S3_SECRET_ACCESS_KEY: "test-secret-key",
      S3_SSE: "provider-default",
    });
    expect(c).toMatchObject({
      driver: "s3",
      region: "auto",
      endpoint: "https://accountid.r2.cloudflarestorage.com",
      credentials: { accessKeyId: "test-access-key", secretAccessKey: "test-secret-key" },
      sse: { mode: "provider-default" },
    });
  });

  it("rejects incomplete or unsafe settings without echoing secret values", () => {
    const base = { STORAGE_DRIVER: "s3", S3_BUCKET: "my-pharmacy-rx" };
    expect(() => storageConfigFromEnv({ STORAGE_DRIVER: "s3" })).toThrow(/Invalid S3 storage settings/);
    expect(() => storageConfigFromEnv({ ...base, S3_BUCKET: "My_Bucket" })).toThrow(/bucket name/);
    const halfKeys = () => storageConfigFromEnv({ ...base, S3_SECRET_ACCESS_KEY: "do-not-print-me" });
    expect(halfKeys).toThrow(/both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY/);
    expect(halfKeys).not.toThrow(/do-not-print-me/);
    expect(() => storageConfigFromEnv({ ...base, S3_ENDPOINT: "http://minio.local:9000" })).toThrow();
    // Plain AWS S3 must always send an encryption header.
    expect(() => storageConfigFromEnv({ ...base, S3_SSE: "provider-default" })).toThrow(/only for S3-compatible/);
    expect(() => storageConfigFromEnv({ ...base, S3_SSE: "none" })).toThrow();
    expect(() => storageConfigFromEnv({ ...base, S3_KMS_KEY_ID: "alias/x" })).toThrow(/needs S3_SSE=aws:kms/);
  });
});

describe("sseParams", () => {
  it("maps each mode to PutObject parameters", () => {
    expect(sseParams({ mode: "AES256" })).toEqual({ ServerSideEncryption: "AES256" });
    expect(sseParams({ mode: "aws:kms" })).toEqual({ ServerSideEncryption: "aws:kms" });
    expect(sseParams({ mode: "aws:kms", kmsKeyId: "alias/k" })).toEqual({ ServerSideEncryption: "aws:kms", SSEKMSKeyId: "alias/k" });
    expect(sseParams({ mode: "provider-default" })).toEqual({});
  });
});
