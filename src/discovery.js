// A pattern keeps course identity and meeting times, but groups interchangeable rooms/sections.
export function patternKey(schedule) {
  return schedule.sections.map(s => [s.course, s.type, s.async ? 'async' : `${s.days.join(',')}:${s.start}:${s.end}`].join('/')).sort().join('|');
}
export function bounds(schedule) {
  const timed = schedule.sections.filter(s => s.days.length);
  return {start: timed.length ? Math.min(...timed.map(s => s.start)) : null, end: timed.length ? Math.max(...timed.map(s => s.end)) : null};
}
export function discover(results, filters = {}) {
  const groups = new Map();
  for (const result of results) {
    const b = bounds(result), m = result.metrics;
    if (filters.days && m.days > +filters.days) continue;
    if (filters.async === 'none' && m.async > 0) continue;
    if (filters.async === 'some' && m.async === 0) continue;
    if (filters.start && b.start !== null && b.start < +filters.start) continue;
    if (filters.end && b.end !== null && b.end > +filters.end) continue;
    if (filters.gap && m.gap > +filters.gap) continue;
    const key = patternKey(result);
    if (!groups.has(key)) groups.set(key, {key, variants: []});
    groups.get(key).variants.push(result);
  }
  const value = r => ({gaps:r.metrics.gap, days:r.metrics.days, walk:r.metrics.walk, later:-(bounds(r).start ?? 1440), finish:bounds(r).end ?? 0}[filters.sort] ?? r.score);
  const compare = (a,b) => value(a)-value(b) || a.score-b.score || a.id.localeCompare(b.id);
  const patterns = [...groups.values()];
  for (const group of patterns) {group.variants.sort(compare); group.best=group.variants[0];}
  patterns.sort((a,b)=>compare(a.best,b.best));
  return patterns;
}
