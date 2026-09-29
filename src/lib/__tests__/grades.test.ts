import { describe, expect, it } from "vitest";
import { gradeSortKey } from "../grades";

const sortGrades = (gs: (string | null)[]) => [...gs].sort((a, b) => gradeSortKey(a) - gradeSortKey(b));

describe("gradeSortKey", () => {
  it("orders YDS grades, including letterless and +/- forms", () => {
    expect(sortGrades(["5.11a", "5.9", "5.10d", "5.10", "5.9+", "5.12b", "5.7", "5.11"])).toEqual([
      "5.7", "5.9", "5.9+", "5.10", "5.10d", "5.11a", "5.11", "5.12b",
    ]);
  });

  it("orders French grades after YDS and unknown and ungraded last", () => {
    expect(sortGrades([null, "project", "6b+", "5.10a", "6a", "7a"])).toEqual([
      "5.10a", "6a", "6b+", "7a", "project", null,
    ]);
  });
});
