// Best-effort parser for text-based UW MyPlan section tables, not arbitrary PDF layouts.
export function parseCourse(text, filename = "") {
  text = text.replace(/\u0000/g, "").replace(/\r/g, "");
  const code =
    text.match(/\b([A-Z][A-Z &]{1,15})[ \t]+(\d{2,4}[A-Z]?)\b/) ||
    filename.match(/([A-Z][A-Z &]{1,15})[ _-]*(\d{2,4}[A-Z]?)/);
  if (!code)
    throw Error(
      "Could not identify a course code. Add the course manually using the course editor.",
    );
  const term = text.match(
    /\b(Winter|Spring|Summer|Autumn|Fall)\s+(?:(?:Quarter|Semester)\s+)?(20\d{2})\b/i,
  );
  const course = {
    code: `${code[1].trim()} ${code[2]}`,
    term: term ? `${term[1]} ${term[2]}`.toUpperCase() : "",
    sections: [],
  };
  const re =
    /(?:^|\n)\s*([A-Z0-9]{1,8})\s*\n\s*(Lecture|Quiz|Lab|Discussion|Seminar|Studio|Workshop)\b([\s\S]*?)(?=\n\s*[A-Z0-9]{1,8}\s*\n\s*(?:Lecture|Quiz|Lab|Discussion|Seminar|Studio|Workshop)\b|$)/g;
  for (const m of text.matchAll(re)) {
    const body = m[3],
      times = [
        ...body.matchAll(
          /\b((?:Th|Sa|Su|M|T|W|F|S)+)\s*\n\s*(\d{1,2}:\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)/g,
        ),
      ];
    const sln = body.match(/\b\d{5,7}\b/);
    const minutes = (s, a) => {
      let [h, n] = s.split(":").map(Number);
      return ((h % 12) + (a === "PM" ? 12 : 0)) * 60 + n;
    };
    const async = !times.length && /asynchronous/i.test(body);
    if (!times.length && !async)
      throw Error(
        `${course.code} ${m[1]} has an unresolved meeting time. Add it manually after confirming its schedule.`,
      );
    const meetings = times.map((t) => {
      let loc = body
        .slice(t.index + t[0].length)
        .match(/^\s*([A-Z]{2,6})\s+(\d{2,4}[A-Z]?)\b/);
      return {
        days: [...t[1].matchAll(/Th|Sa|Su|M|T|W|F|S/g)].map(
          (d) => ({ M: 0, T: 1, W: 2, Th: 3, F: 4, Sa: 5, S: 5, Su: 6 })[d[0]],
        ),
        start: minutes(t[2], t[3]),
        end: minutes(t[4], t[5]),
        building: loc?.[1] || "",
        room: loc?.[2] || "",
      };
    });
    const first = meetings[0];
    course.sections.push({
      id: m[1],
      type: m[2],
      sln: sln?.[0] || "",
      async,
      meetings,
      days: first?.days || [],
      start: first?.start ?? null,
      end: first?.end ?? null,
      building: first?.building || "",
      room: first?.room || "",
    });
  }
  if (!course.sections.length)
    throw Error(
      "No supported section table found. This importer reads text-based UW MyPlan PDFs. Use Add course for other formats or scanned files.",
    );
  let primary = course.sections.filter((s) =>
    ["Lecture", "Seminar", "Studio", "Workshop"].includes(s.type),
  );
  if (!primary.length) primary = course.sections;
  for (const s of course.sections) {
    s.role = primary.includes(s) ? "primary" : "companion";
    s.group = s.role === "primary" ? "Main section" : s.type;
    s.parent = null;
    if (s.role === "companion") {
      const candidates = primary
        .filter((l) => s.id.startsWith(l.id))
        .sort((a, b) => b.id.length - a.id.length);
      s.parent =
        candidates[0]?.id || (primary.length === 1 ? primary[0].id : null);
      if (!s.parent)
        throw Error(
          `Cannot infer the required main section for ${s.id}. Enter this course manually to specify its pairing.`,
        );
    }
  }
  return course;
}
