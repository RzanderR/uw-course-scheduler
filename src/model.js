export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export const DAY_SHORT = ["M", "T", "W", "Th", "F", "Sa", "Su"];
export const isPrimary = (s) =>
  s.role ? s.role === "primary" : s.type === "Lecture";
export const sectionGroup = (s) =>
  isPrimary(s) ? "Main section" : s.group || s.type;
export function meetings(s) {
  if (Array.isArray(s.meetings)) return s.meetings;
  return s.days?.length
    ? [
        {
          days: s.days,
          start: s.start,
          end: s.end,
          building: s.building || "",
          room: s.room || "",
        },
      ]
    : [];
}
export const events = (sections) =>
  sections.flatMap((s) => meetings(s).map((m) => ({ ...s, ...m })));
export const calendarDays = (sections) =>
  events(sections).some((s) => s.days.some((d) => d > 4))
    ? [0, 1, 2, 3, 4, 5, 6]
    : [0, 1, 2, 3, 4];
export function validateCourse(input) {
  const course = structuredClone(input);
  course.code = String(course.code || "").trim();
  course.term = String(course.term || "").trim();
  course.title = String(course.title || "").trim();
  if (!course.code || course.code.length > 80 || course.code.includes("|"))
    throw Error("Enter a course name or code (up to 80 characters).");
  if (!course.term || course.term.length > 100)
    throw Error("Enter the term or session, including its year.");
  if (!Array.isArray(course.sections) || !course.sections.length)
    throw Error("Add at least one main section.");
  if (course.sections.length > 500)
    throw Error("A course can contain up to 500 sections.");
  const ids = new Set();
  for (const s of course.sections) {
    s.id = String(s.id || "").trim();
    s.type = String(s.type || "").trim();
    if (
      !s.id ||
      !s.type ||
      s.id.includes("|") ||
      s.type.includes("|") ||
      String(s.group || "").includes("|")
    )
      throw Error("Each section needs a name and meeting type.");
    if (ids.has(s.id)) throw Error(`Section ${s.id} appears more than once.`);
    ids.add(s.id);
    s.role = isPrimary(s) ? "primary" : "companion";
    s.group = sectionGroup(s);
    if (s.role === "companion" && !s.parent)
      throw Error(`Choose which main section ${s.id} belongs to.`);
    s.meetings = meetings(s);
    s.async = Boolean(s.async);
    if (s.async && s.meetings.length)
      throw Error(
        `${s.id}: asynchronous sections cannot also have scheduled meetings. Add a separate required component for scheduled sessions.`,
      );
    if (!s.async && !s.meetings.length)
      throw Error(
        `${s.id}: add meeting times, or mark the section asynchronous.`,
      );
    for (const m of s.meetings) {
      if (
        !Array.isArray(m.days) ||
        !m.days.length ||
        m.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
      )
        throw Error(`${s.id}: select at least one meeting day.`);
      m.days = [...new Set(m.days)].sort((a, b) => a - b);
      if (
        !Number.isInteger(m.start) ||
        !Number.isInteger(m.end) ||
        m.start < 0 ||
        m.end > 1440 ||
        m.start >= m.end
      )
        throw Error(
          `${s.id}: meeting end must be after its start. Split overnight meetings into two days.`,
        );
      m.building = String(m.building || "").trim();
      m.room = String(m.room || "").trim();
    }
    for (let i = 0; i < s.meetings.length; i++)
      for (let j = i + 1; j < s.meetings.length; j++) {
        let a = s.meetings[i],
          b = s.meetings[j];
        if (
          a.days.some((d) => b.days.includes(d)) &&
          a.start < b.end &&
          b.start < a.end
        )
          throw Error(`${s.id}: meeting rows overlap.`);
      }
    // Keep legacy summary fields for older saved plans; the engine uses meetings.
    const first = s.meetings[0];
    s.days = first?.days || [];
    s.start = first?.start ?? null;
    s.end = first?.end ?? null;
    s.building = first?.building || "";
    s.room = first?.room || "";
  }
  const primary = course.sections.filter(isPrimary);
  if (!primary.length)
    throw Error(
      "Add at least one main section. It can be a lecture, seminar, lab, or any other meeting type.",
    );
  for (const s of course.sections.filter((s) => !isPrimary(s)))
    if (s.parent !== "*" && !primary.some((p) => p.id === s.parent))
      throw Error(`${s.id}: linked main section ${s.parent} is missing.`);
  return course;
}
export function validatePlanCourses(courses) {
  if (!Array.isArray(courses) || courses.length > 30)
    throw Error("A plan must contain an array of up to 30 courses.");
  const valid = courses.map(validateCourse),
    codes = new Set(),
    terms = new Set();
  for (const c of valid) {
    if (codes.has(c.code.toLowerCase()))
      throw Error(`Duplicate course ${c.code}.`);
    codes.add(c.code.toLowerCase());
    terms.add(c.term.toLowerCase());
  }
  if (terms.size > 1)
    throw Error(
      "Use one term or session per plan. Give courses the same term label when their weeks should be compared together.",
    );
  return valid;
}

// Include the term and meeting content so saved choices cannot silently become a different course offering.
export function sectionSignature(s) {
  return JSON.stringify([
    s.term || "",
    s.course || "",
    s.id,
    sectionGroup(s),
    Boolean(s.async),
    meetings(s).map((m) => [
      m.days,
      m.start,
      m.end,
      m.building || "",
      m.room || "",
    ]),
  ]);
}
export const scheduleId = (sections) =>
  JSON.stringify(sections.map(sectionSignature));
