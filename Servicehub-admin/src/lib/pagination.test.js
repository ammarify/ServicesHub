import { describe, expect, it } from "vitest";
import { pageItems } from "./pagination";

describe("pageItems", () => {
  it("lists every page when there are seven or fewer", () => {
    expect(pageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps the first and last page and the current page's neighbours", () => {
    expect(pageItems(6, 12)).toEqual([1, "gap-start", 5, 6, 7, "gap-end", 12]);
  });

  it("doesn't leave a lonely gap near either end", () => {
    expect(pageItems(1, 12)).toEqual([1, 2, 3, 4, "gap-end", 12]);
    expect(pageItems(12, 12)).toEqual([1, "gap-start", 9, 10, 11, 12]);
  });
});
