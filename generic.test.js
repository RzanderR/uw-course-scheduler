import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateCourse,
  validatePlanCourses,
  events,
  calendarDays,
} from "./src/model.js";
import { generate, defaults, metrics } from "./src/engine.js";
import { parseCourse } from "./src/parser.js";
import { patternKey } from "./src/discovery.js";
const meeting = (days, start = 600, end = 660, building = "North Hall") => ({
  days,
  start,
  end,
  building,
  room: "101",
});
const section = (id, meetings, extra = {}) => ({
  id,
  type: "Seminar",
  role: "primary",
  async: false,
  meetings,
  ...extra,
});
const course = (sections, code = "Design Studio / Graduate") =>
  validateCourse({ code, term: "Summer Session II 2031", sections });
test("arbitrary courses, non-lecture main sections, multiple meetings, and weekends generate correctly", () => {
  let c = course([
    section("SEM-001", [meeting([0, 2]), meeting([5], 780, 900)]),
  ]);
  let r = generate([c], defaults).results;
  assert.equal(r.length, 1);
  assert.equal(events(r[0].sections).length, 2);
  assert.equal(r[0].metrics.days, 3);
  assert.deepEqual(calendarDays(r[0].sections), [0, 1, 2, 3, 4, 5, 6]);
});
test("conflicts and hard constraints include second meeting rows and Sundays", () => {
  let a = course([section("01", [meeting([0]), meeting([6], 900, 960)])]);
  let b = course([section("02", [meeting([6], 930, 990)])], "Music 500B");
  assert.equal(generate([a, b], defaults).results.length, 0);
  assert.equal(generate([a], { ...defaults, hardEnd: 950 }).results.length, 0);
  assert.equal(
    generate([a], { ...defaults, blocks: [{ day: 6, start: 930, end: 940 }] })
      .results.length,
    0,
  );
});
test("each required component is selected with explicit main-section linkage", () => {
  let c = course([
    section("S1", [meeting([0])]),
    section("S2", [meeting([1])]),
    section("Lab-A", [meeting([3])], {
      role: "companion",
      type: "Lab",
      group: "Lab",
      parent: "S1",
    }),
    section("Lab-B", [meeting([4])], {
      role: "companion",
      type: "Lab",
      group: "Lab",
      parent: "S1",
    }),
    section("Disc", [meeting([5])], {
      role: "companion",
      type: "Discussion",
      group: "Discussion",
      parent: "*",
    }),
  ]);
  let r = generate([c], defaults).results;
  assert.equal(r.length, 3);
  assert.ok(r.every((x) => x.sections.some((s) => s.id === "Disc")));
  assert.ok(
    r
      .filter((x) => x.sections.some((s) => s.id === "S1"))
      .every((x) => x.sections.length === 3),
  );
  assert.equal(
    generate([c], defaults, {
      [c.code]: { "Main section": "S1", Lab: "Lab-B" },
    }).results.length,
    1,
  );
});
test("validation rejects ambiguous, invalid and mixed-term data", () => {
  assert.throws(() => course([section("01", [])]), /add meeting/);
  assert.throws(() => course([section("01", [meeting([7])])]), /meeting day/);
  assert.throws(
    () => course([section("01", [meeting([0], 700, 600)])]),
    /end must/,
  );
  assert.throws(
    () => course([section("01", [meeting([0]), meeting([0], 620, 700)])]),
    /overlap/,
  );
  assert.throws(
    () =>
      course([section("01", [meeting([0])]), section("01", [meeting([1])])]),
    /more than once/,
  );
  let c = course([section("01", [meeting([0])])]);
  assert.throws(
    () => validatePlanCourses([c, { ...c, code: "Other", term: "Fall 2032" }]),
    /one term/,
  );
  assert.throws(
    () =>
      course([
        section("01", [meeting([0])], { role: "companion", parent: "missing" }),
      ]),
    /main section/,
  );
});
test("asynchronous courses need no calendar meetings, while required components remain scheduled", () => {
  let c = course([
    section("online", [], { async: true }),
    section("lab", [meeting([6])], {
      role: "companion",
      type: "Lab",
      group: "Practical",
      parent: "online",
    }),
  ]);
  let r = generate([c], defaults).results[0];
  assert.equal(r.metrics.async, 1);
  assert.equal(r.metrics.days, 1);
  assert.equal(
    generate([c], { ...defaults, allowAsync: false }).results.length,
    0,
  );
});
test("grouping accounts for all meetings rather than only the first", () => {
  let a = {
      sections: [
        { ...section("01", [meeting([0]), meeting([5])]), course: "ART 10" },
      ],
    },
    b = structuredClone(a);
  b.sections[0].meetings[1].start += 30;
  assert.notEqual(patternKey(a), patternKey(b));
});
test("PDF parser handles other departments, future years, and multiple meetings", () => {
  let c = parseCourse(
    "BIOEN 599A\nSPRING 2032\nA\nLecture\nIn-person\nMW\n10:00 AM - 10:50 AM\nHALL\n101\nF\n1:00 PM - 2:20 PM\nHALL\n102\n12345\nAA\nLab\nSa\n9:00 AM - 10:20 AM\nLAB\n201\n12346",
  );
  assert.equal(c.code, "BIOEN 599A");
  assert.equal(c.term, "SPRING 2032");
  assert.equal(c.sections[0].meetings.length, 2);
  assert.equal(c.sections[1].parent, "A");
  assert.deepEqual(c.sections[1].meetings[0].days, [5]);
  validateCourse(c);
});
test("missing PDF terms stay unset for user review; unknown formats fail explicitly", () => {
  assert.throws(() => parseCourse("not a course file"), /identify/);
  let c = parseCourse(
    "CHEM 10\nA\nLecture\nAsynchronous Online\nTo be arranged\n12345",
  );
  assert.equal(c.term, "");
  assert.throws(() => validateCourse(c), /term/);
});
import { scheduleId } from "./src/model.js";
test("saved schedule identity changes when the term or meeting content changes", () => {
  const a = generate([course([section("01", [meeting([0])])])], defaults)
    .results[0];
  const b = structuredClone(a.sections);
  b[0].term = "Fall 2032";
  assert.notEqual(scheduleId(a.sections), scheduleId(b));
  b[0].term = a.sections[0].term;
  b[0].meetings[0].start += 15;
  assert.notEqual(scheduleId(a.sections), scheduleId(b));
});
