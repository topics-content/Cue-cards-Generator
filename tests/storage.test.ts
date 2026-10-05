import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ParseError } from "@/lib/parsers/errors";
import { isOwnUploadPath, newUploadPath, ownerPrefix } from "@/lib/storage";

const A = "a@scaler.com";
const B = "b@scaler.com";

describe("upload paths", () => {
  it("puts uploads under the user's own folder with the original extension", () => {
    const p = newUploadPath(A, "Lecture 3.IPYNB");
    expect(p).toMatch(new RegExp(`^${ownerPrefix(A)}/[0-9a-f-]{36}\\.ipynb$`));
    expect(isOwnUploadPath(A, p)).toBe(true);
  });

  it("is case-insensitive on the email", () => {
    expect(ownerPrefix("A@Scaler.com")).toBe(ownerPrefix(A));
  });

  it("rejects unsupported or missing extensions", () => {
    expect(() => newUploadPath(A, "slides.pdf")).toThrow(ParseError);
    expect(() => newUploadPath(A, "docx")).toThrow(ParseError);
  });

  it("refuses another user's upload", () => {
    expect(isOwnUploadPath(B, newUploadPath(A, "x.md"))).toBe(false);
  });

  it("refuses traversal and hand-made paths", () => {
    const own = newUploadPath(A, "x.md");
    expect(isOwnUploadPath(A, `${ownerPrefix(A)}/../${own}`)).toBe(false);
    expect(isOwnUploadPath(A, `${own}/extra`)).toBe(false);
    expect(isOwnUploadPath(A, own.replace(/\.md$/, ".exe"))).toBe(false);
    expect(isOwnUploadPath(A, "")).toBe(false);
  });
});
