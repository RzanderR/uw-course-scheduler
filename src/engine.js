import {
  events,
  meetings,
  isPrimary,
  sectionGroup,
  scheduleId,
} from "./model.js";
export const defaults = {
  early: 3,
  gaps: 4,
  days: 2,
  walk: 2,
  start: 540,
  end: 1080,
  hardStart: 0,
  hardEnd: 1440,
  allowAsync: true,
  buffer: 0,
  travelDefault: 10,
  blocks: [],
  routes: {},
};
export const fmt = (n) =>
  n == null
    ? "Async"
    : `${Math.floor(n / 60) % 12 || 12}:${String(n % 60).padStart(2, "0")} ${n < 720 || n === 1440 ? "AM" : "PM"}`;
export function travel(a, b, p) {
  if (!a.building || !b.building)
    return { minutes: p.travelDefault, unknown: true };
  if (a.building === b.building) return { minutes: 2, unknown: false };
  let key = [a.building, b.building].sort().join("–");
  return {
    minutes: p.routes[key] ?? p.travelDefault,
    unknown: p.routes[key] == null,
  };
}
export function metrics(sections, p) {
  let gap = 0,
    walk = 0,
    days = 0,
    early = 0,
    late = 0,
    tight = 0,
    unknown = 0;
  const all = events(sections);
  for (let d = 0; d < 7; d++) {
    let day = all
      .filter((s) => s.days.includes(d))
      .sort((a, b) => a.start - b.start);
    if (!day.length) continue;
    days++;
    early += Math.max(0, p.start - day[0].start);
    late += Math.max(0, day.at(-1).end - p.end);
    for (let i = 1; i < day.length; i++) {
      let g = day[i].start - day[i - 1].end,
        t = travel(day[i - 1], day[i], p);
      gap += g;
      walk += t.minutes;
      if (t.unknown) unknown++;
      if (g < t.minutes) tight++;
    }
  }
  return {
    gap,
    walk,
    days,
    early,
    late,
    tight,
    unknown,
    async: sections.filter((s) => s.async).length,
  };
}
export function compatible(a, b) {
  return meetings(a).every((x) =>
    meetings(b).every(
      (y) =>
        !x.days.some(
          (d) => y.days.includes(d) && x.start < y.end && y.start < x.end,
        ),
    ),
  );
}
export function generate(courses, p, pins = {}) {
  let groups = courses.map((c) =>
    c.sections
      .filter((s) => isPrimary(s) && (p.allowAsync || !s.async))
      .flatMap((l) => {
        let children = c.sections.filter(
          (s) => !isPrimary(s) && (s.parent === l.id || s.parent === "*"),
        );
        let types = [...new Set(children.map(sectionGroup))];
        let combos = [[l]];
        for (let type of types)
          combos = combos.flatMap((a) =>
            children
              .filter((s) => sectionGroup(s) === type)
              .map((s) => [...a, s]),
          );
        return combos;
      })
      .map((a) => a.map((s) => ({ ...s, course: c.code, term: c.term })))
      .filter((a) =>
        Object.entries(pins[c.code] || {}).every(
          ([type, id]) =>
            !id ||
            a.some(
              (s) =>
                (sectionGroup(s) === type || s.type === type) && s.id === id,
            ),
        ),
      )
      .filter((a) =>
        a.every((s, i) => a.slice(i + 1).every((t) => compatible(s, t))),
      ),
  );
  let results = [],
    visited = 0,
    truncated = false;
  function visit(i, ss) {
    if (++visited > 200000) {
      truncated = true;
      return;
    }
    if (i === groups.length) {
      let m = metrics(ss, p),
        score =
          (p.early * (m.early + m.late)) / 60 +
          (p.gaps * m.gap) / 60 +
          p.days * m.days * 2 +
          (p.walk * m.walk) / 30;
      results.push({
        id: scheduleId(ss),
        sections: ss,
        metrics: m,
        score,
      });
      return;
    }
    for (let option of groups[i]) {
      if (
        events(option).some(
          (s) =>
            s.start < p.hardStart ||
            s.end > p.hardEnd ||
            p.blocks.some(
              (b) =>
                s.days.includes(b.day) && s.start < b.end && b.start < s.end,
            ),
        )
      )
        continue;
      if (option.some((s) => ss.some((t) => !compatible(s, t)))) continue;
      let combined = [...ss, ...option],
        timed = events(combined);
      if (
        p.buffer &&
        timed.some((s) =>
          timed.some(
            (t) =>
              s !== t &&
              s.days.some((d) => t.days.includes(d)) &&
              s.end <= t.start &&
              t.start - s.end < p.buffer,
          ),
        )
      )
        continue;
      visit(i + 1, combined);
      if (truncated) break;
    }
  }
  if (courses.length) visit(0, []);
  results.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
  return { results, truncated };
}
