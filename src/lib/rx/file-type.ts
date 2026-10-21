export const MAX_RX_BYTES = 5 * 1024 * 1024;

export type RxFileType = { mime: "image/jpeg" | "image/png" | "application/pdf"; ext: "jpg" | "png" | "pdf" };

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b);

/** Identifies a prescription file by its content (magic bytes), never by its name or claimed type. */
export function detectRxFileType(bytes: Uint8Array): RxFileType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", ext: "pdf" }; // %PDF-
  return null;
}
