import { describe, expect, it } from "vitest";
import type { Folder } from "@ai-notes/shared";
import { canMoveFolder } from "./Dashboard.js";

const folder = (id: string, parentFolderId: string | null): Folder => ({
  id, parentFolderId, name: id, ownerId: "local", createdAt: "now", updatedAt: "now",
});

describe("folder movement", () => {
  const folders = [folder("a", null), folder("b", "a"), folder("c", "b"), folder("d", null)];
  it("prevents moving a folder into itself or its descendants", () => {
    expect(canMoveFolder(folders, "a", "a")).toBe(false);
    expect(canMoveFolder(folders, "a", "c")).toBe(false);
    expect(canMoveFolder(folders, "a", "d")).toBe(true);
    expect(canMoveFolder(folders, "b", null)).toBe(true);
    expect(canMoveFolder(folders, "a", "missing")).toBe(false);
  });
});
