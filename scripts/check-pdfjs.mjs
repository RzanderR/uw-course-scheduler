import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const directory = process.argv[2];
if (!directory)
  throw Error(
    "Usage: node scripts/check-pdfjs.mjs <directory-containing-course-PDFs>",
  );
import { parseCourse } from "../src/parser.js";
for (let name of ["CSE123", "MATH126", "STAT311"]) {
  let doc = await getDocument({
      data: new Uint8Array(readFileSync(resolve(directory, `${name}.pdf`))),
      useSystemFonts: true,
    }).promise,
    text = "";
  for (let n = 1; n <= doc.numPages; n++) {
    let p = await doc.getPage(n),
      c = await p.getTextContent();
    text += c.items.map((i) => i.str).join("\n") + "\n";
  }
  let course = parseCourse(text, name);
  console.log(
    name,
    course.sections.length,
    course.sections.filter((s) => s.async).map((s) => s.id),
  );
  await doc.destroy();
}
