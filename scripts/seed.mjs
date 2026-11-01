import { readFileSync, writeFileSync } from "node:fs";
import { parseCourse } from "../src/parser.js";
const courses = ["CSE123", "MATH126", "STAT311"].map((n) =>
  parseCourse(readFileSync(`tests/fixtures/${n}.txt`, "utf8"), n),
);
writeFileSync(
  "tests/fixtures/uw-winter-2027.json",
  JSON.stringify(courses, null, 2),
);
console.log(
  courses.map((c) => `${c.code}: ${c.sections.length} sections`).join("\n"),
);
