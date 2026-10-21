import { describe, expect, it } from "vitest";
import { detectRxFileType } from "./file-type";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0]);

describe("detectRxFileType", () => {
  it("recognises JPEG, PNG and PDF by content", () => {
    expect(detectRxFileType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
    expect(detectRxFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime).toBe("image/png");
    expect(detectRxFileType(new TextEncoder().encode("%PDF-1.7\n"))?.mime).toBe("application/pdf");
  });

  it("rejects other content, whatever it's named", () => {
    expect(detectRxFileType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectRxFileType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(detectRxFileType(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull(); // zip/docx
    expect(detectRxFileType(new Uint8Array())).toBeNull();
  });
});
