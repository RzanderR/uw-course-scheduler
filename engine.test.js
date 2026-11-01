import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generate, defaults, compatible, metrics } from "./src/engine.js";
import { parseCourse } from "./src/parser.js";
const courses = JSON.parse(
  readFileSync(
    new URL("./tests/fixtures/uw-winter-2027.json", import.meta.url),
  ),
);
test("PDF extraction preserves all 54 source sections and asynchronous exceptions", () => {
  assert.deepEqual(
    courses.map((c) => c.sections.length),
    [30, 16, 8],
  );
  assert.equal(courses[1].sections.find((s) => s.id === "D").async, true);
  assert.equal(courses[2].sections.find((s) => s.id === "B").async, true);
  assert.equal(courses[0].sections.find((s) => s.id === "AI").building, "");
  for (let [i, n] of ["CSE123", "MATH126", "STAT311"].entries())
    assert.deepEqual(
      parseCourse(readFileSync(`tests/fixtures/${n}.txt`, "utf8")),
      courses[i],
    );
});
test("every generated schedule is conflict-free and respects lecture pairings", () => {
  let { results } = generate(courses, defaults);
  assert.ok(results.length > 0);
  for (let r of results) {
    for (let s of r.sections) {
      assert.ok(r.sections.every((t) => s === t || compatible(s, t)));
      if (s.parent)
        assert.ok(
          r.sections.some(
            (l) =>
              l.course === s.course &&
              l.type === "Lecture" &&
              l.id === s.parent,
          ),
        );
    }
    for (let c of courses) {
      let sections = r.sections.filter((s) => s.course === c.code);
      assert.equal(sections.filter((s) => s.type === "Lecture").length, 1);
      assert.equal(
        sections.filter((s) => s.type === "Quiz").length,
        c.code === "STAT 311" && sections.some((s) => s.id === "B") ? 0 : 1,
      );
    }
  }
});
test("pins, blocked time, strict hours and async filters constrain results", () => {
  let p = {
    ...defaults,
    allowAsync: false,
    hardStart: 570,
    blocks: [{ day: 1, start: 900, end: 960 }],
  };
  let { results } = generate(courses, p, { "CSE 123": { Lecture: "B" } });
  assert.ok(results.length > 0);
  for (let r of results) {
    assert.ok(r.sections.some((s) => s.course === "CSE 123" && s.id === "B"));
    assert.ok(r.sections.every((s) => !s.async && s.start >= 570));
    assert.ok(
      r.sections.every(
        (s) => !s.days.includes(1) || s.end <= 900 || s.start >= 960,
      ),
    );
  }
  assert.equal(
    generate(courses, { ...defaults, hardStart: 1100, allowAsync: false })
      .results.length,
    0,
  );
});
test("adjacent meetings do not overlap; travel uncertainty stays visible", () => {
  let a = { days: [0], start: 600, end: 650, building: "A" },
    b = { days: [0], start: 650, end: 700, building: "" };
  assert.equal(compatible(a, b), true);
  let m = metrics([a, b], defaults);
  assert.equal(m.tight, 1);
  assert.equal(m.unknown, 1);
  assert.equal(m.walk, 10);
});
test("weight changes rerank schedules and result scores stay sorted", () => {
  let a = generate(courses, {
      ...defaults,
      gaps: 5,
      early: 0,
      days: 0,
      walk: 0,
    }).results,
    b = generate(courses, {
      ...defaults,
      gaps: 0,
      early: 5,
      days: 0,
      walk: 0,
    }).results;
  assert.ok(a[0].metrics.gap <= b[0].metrics.gap);
  assert.ok(
    b[0].metrics.early + b[0].metrics.late <=
      a[0].metrics.early + a[0].metrics.late,
  );
  assert.ok(a.every((r, i) => !i || r.score >= a[i - 1].score));
});
