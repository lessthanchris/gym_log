/** Yosemite Decimal System grades offered as suggestions; any text is accepted. */
export const YDS_GRADES: string[] = [
  "5.5", "5.6", "5.7", "5.8", "5.9",
  ...[10, 11, 12, 13, 14, 15].flatMap((n) => ["a", "b", "c", "d"].map((l) => `5.${n}${l}`)),
];

const UNKNOWN_GRADE = 1e6;
const UNGRADED = 1e7;

/**
 * Sort key for a grade string. Understands YDS ("5.10b", "5.11", "5.9+") and
 * French ("6a+", "7b"); anything else sorts after known grades.
 */
export function gradeSortKey(grade: string | null | undefined): number {
  if (!grade) return UNGRADED;
  const g = grade.trim().toLowerCase();

  const yds = /^5\.(\d{1,2})([abcd])?([+-])?$/.exec(g);
  if (yds) {
    const n = Number(yds[1]);
    let key = n * 4;
    if (yds[2]) key += "abcd".indexOf(yds[2]);
    else if (n >= 10) key += 1.5; // "5.11" sits between b and c
    if (yds[3] === "+") key += 0.5;
    if (yds[3] === "-") key -= 0.5;
    return key;
  }

  const french = /^([3-9])([abc])?(\+)?$/.exec(g);
  if (french) {
    // Offset past YDS so mixed lists stay grouped by system.
    return 1000 + Number(french[1]) * 6 + (french[2] ? "abc".indexOf(french[2]) * 2 : 0) + (french[3] ? 1 : 0);
  }

  return UNKNOWN_GRADE;
}
