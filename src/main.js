import "./style.css";
import { openCourseEditor } from "./editor.js";
import {
  events,
  meetings,
  isPrimary,
  sectionGroup,
  calendarDays,
  DAY_NAMES,
  DAY_SHORT,
  validateCourse,
  validatePlanCourses,
  sectionSignature,
  scheduleId,
} from "./model.js";
import { defaults, fmt, generate, metrics, travel } from "./engine.js";
import { discover, bounds } from "./discovery.js";
import { parseCourse } from "./parser.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let stored;
try {
  stored = JSON.parse(localStorage.getItem("husky-v1"));
} catch {}
let courses = stored?.courses || [],
  p = { ...structuredClone(defaults), ...stored?.p },
  pins = stored?.pins || {},
  saved = stored?.saved || [],
  active = 0,
  view = "explore",
  selectedId = "",
  results = [],
  truncated = false,
  notice = "";
let studio = "browse",
  filters = { sort: "match" },
  page = 0,
  patterns = [];
for (const c of courses) {
  const previous = pins[c.code] || {};
  const updated = {};
  for (const id of Object.values(previous)) {
    const section = c.sections.find((s) => s.id === id);
    if (section) updated[sectionGroup(section)] = id;
  }
  pins[c.code] = updated;
}
for (const item of saved) {
  for (const section of item.sections) {
    section.term ??= courses.find((c) => c.code === section.course)?.term || "";
  }
  item.id = scheduleId(item.sections);
}
const persist = () => {
  try {
    localStorage.setItem(
      "husky-v1",
      JSON.stringify({ courses, p, pins, saved }),
    );
  } catch {
    notice =
      "Browser storage is full. Changes remain available until this page closes.";
  }
};
const timeVal = (n) =>
  n === 1440
    ? "23:59"
    : `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const mins = (s) => s.split(":").reduce((a, v) => a * 60 + Number(v), 0);
function recalc() {
  page = 0;
  ({ results, truncated } = generate(courses, p, pins));
  active = Math.max(
    0,
    results.findIndex((r) => r.id === selectedId),
  );
  persist();
  render();
}
function selectOptions(c, type) {
  return (
    `<option value="">Any ${type.toLowerCase()}</option>` +
    c.sections
      .filter((s) => sectionGroup(s) === type)
      .map(
        (s) =>
          `<option value="${esc(s.id)}" ${pins[c.code]?.[type] === s.id ? "selected" : ""}>${esc(s.id)} · ${
            s.async
              ? "Asynchronous"
              : meetings(s)
                  .map(
                    (m) =>
                      m.days.map((d) => DAY_SHORT[d]).join("") +
                      " " +
                      fmt(m.start),
                  )
                  .join("; ")
          }${s.building ? " · " + esc(s.building) : ""}</option>`,
      )
      .join("")
  );
}
function stat(m) {
  return `<div><b>${m.days}</b><span>campus days</span></div><div><b>${Math.round(m.gap / 6) / 10}<small>h</small></b><span>weekly gaps</span></div><div><b>${m.walk}<small>m</small></b><span>travel estimate</span></div><div><b>${m.async}</b><span>async sections</span></div>`;
}
function calendar(r) {
  const timed = events(r.sections),
    days = calendarDays([
      ...r.sections,
      ...p.blocks.map((b) => ({ days: [b.day], start: b.start, end: b.end })),
    ]),
    from = Math.min(480, ...timed.map((s) => s.start)),
    to = Math.max(1080, ...timed.map((s) => s.end)),
    height = (to - from) * 1.12;
  return `<div class="calendar-scroll"><div class="calendar" style="--day-count:${days.length};min-width:${days.length === 7 ? 760 : 580}px"><div class="day-head"><span>TIME</span>${days.map((d) => `<b>${DAY_SHORT[d].toUpperCase()}</b>`).join("")}</div><div class="week" style="height:${height}px"><div class="times">${Array.from({ length: Math.ceil((to - from) / 60) }, (_, i) => `<span style="top:${i * 67.2}px">${fmt(from + i * 60).replace(":00", "")}</span>`).join("")}</div>${days
    .map(
      (d) =>
        `<div class="day">${timed
          .filter((s) => s.days.includes(d))
          .map(
            (s) =>
              `<button class="event color${
                Math.max(
                  0,
                  courses.findIndex((c) => c.code === s.course),
                ) % 5
              }" data-section="${esc(s.course + "|" + sectionGroup(s) + "|" + s.id)}" style="top:${(s.start - from) * 1.12}px;height:${(s.end - s.start) * 1.12}px" title="Click to pin ${esc(s.course)} ${s.id}"><strong>${esc(s.course)} <em>${esc(s.id)}</em></strong><span>${esc(s.type)} · ${fmt(s.start)}</span><span>${esc(s.building ? s.building + " " + s.room : "Location TBA")}</span></button>`,
          )
          .join("")}${p.blocks
          .filter((b) => b.day === d)
          .map(
            (b) =>
              `<div class="blocked" style="top:${Math.max(0, b.start - from) * 1.12}px;height:${Math.max(0, Math.min(to, b.end) - Math.max(from, b.start)) * 1.12}px">Unavailable</div>`,
          )
          .join("")}</div>`,
    )
    .join("")}</div></div></div>`;
}
function render() {
  patterns = discover(results, filters);
  page = Math.min(page, Math.max(0, Math.ceil(patterns.length / 12) - 1));
  let r = results[active];
  $("#app").innerHTML =
    `<header><a class="brand" href="#"><span class="logo">H</span>husky<span class="light">hours</span></a><nav><button data-view="explore" class="${view === "explore" ? "chosen" : ""}">Schedule studio</button><button data-view="saved" class="${view === "saved" ? "chosen" : ""}">Saved <span class="count">${saved.length}</span></button></nav><span class="term">${esc(courses[0]?.term || "YOUR NEXT TERM")}</span></header><div class="intro"><div><span class="eyebrow">A BETTER WEEK STARTS HERE</span><h1>Make room for your life.</h1><p>Explore the possibilities. Find a schedule that feels like you.</p></div><div class="intro-note"><span class="spark">&#10035;</span> Your courses. Your priorities.<br><small>One week, thoughtfully arranged.</small></div></div>${notice ? `<div role="status" class="notice">${esc(notice)} <button id="dismiss">Dismiss</button></div>` : ""}<main><aside><section><div class="section-heading"><h2>Your courses</h2><span>${courses.length} selected</span></div>${courses.map((c, i) => `<article class="course"><div class="course-heading"><b><i class="dot color${i % 5}"></i>${esc(c.code)}</b><button class="edit-course" data-edit="${i}">Edit</button><button class="remove" data-remove="${i}" aria-label="Remove ${esc(c.code)}">×</button></div><small>${c.sections.length} sections · ${esc(c.term)}</small>${[...new Set(c.sections.map(sectionGroup))].map((type) => `<label class="pin-label">${esc(type)}<select data-pin="${esc(c.code + "|" + type)}">${selectOptions(c, type)}</select></label>`).join("")}</article>`).join("")}<button class="primary add-course" id="add-course">+ Add course</button><button class="upload" id="import">Import MyPlan PDF</button><div class="plan-actions"><button id="export-plan">Export courses</button><button id="import-plan">Import courses</button><input type="file" id="plan-file" accept="application/json,.json" hidden></div><input hidden type="file" id="file" accept="application/pdf" multiple><button class="new-plan" id="new-plan">Start a new term</button><p class="micro">UW MyPlan PDFs · review sections before adding.<br>Imported data is a snapshot; availability is not live.</p></section><section><div class="section-heading"><h2>Shape your week</h2><button id="reset">Reset</button></div><p class="micro">Move a priority higher to give it more influence.</p>${[
      ["early", "Comfortable hours", "Prefer your ideal start and finish"],
      ["gaps", "Less waiting", "Keep breaks between classes short"],
      ["days", "Fewer campus days", "Group meetings into fewer days"],
      ["walk", "Shorter walks", "Reduce estimated building-to-building time"],
    ]
      .map(
        ([key, label, help]) =>
          `<label class="priority"><span>${label}<b>${p[key]}/5</b></span><input aria-label="${label}" data-weight="${key}" type="range" min="0" max="5" value="${p[key]}"><small>${help}</small></label>`,
      )
      .join(
        "",
      )}<div class="pair"><label>Ideal start<input data-pref="start" type="time" value="${timeVal(p.start)}"></label><label>Ideal finish<input data-pref="end" type="time" value="${timeVal(p.end)}"></label></div><label class="check"><input type="checkbox" id="async" ${p.allowAsync ? "checked" : ""}> Include asynchronous main sections</label></section><section><details><summary>Availability & travel</summary><p class="micro">Hard limits exclude schedules. Travel estimates affect ranking and warnings.</p><div class="pair"><label>Never before<input data-pref="hardStart" type="time" value="${timeVal(p.hardStart)}"></label><label>Never after<input data-pref="hardEnd" type="time" value="${timeVal(p.hardEnd)}"></label></div><label>Minimum break (minutes)<input data-number="buffer" type="number" min="0" max="120" value="${p.buffer}"></label><label>Unverified travel estimate (minutes)<input data-number="travelDefault" type="number" min="1" max="60" value="${p.travelDefault}"></label><form id="block-form"><label>Block time<select name="day">${DAY_NAMES.map((d, i) => `<option value="${i}">${d}</option>`).join("")}</select></label><div class="pair"><input aria-label="Block start" name="start" type="time" required value="12:00"><input aria-label="Block end" name="end" type="time" required value="13:00"></div><button class="upload">Add unavailable time</button></form>${p.blocks.map((b, i) => `<div class="block-row">${DAY_SHORT[b.day]} ${fmt(b.start)}–${fmt(b.end)} <button data-unblock="${i}" aria-label="Remove unavailable time">×</button></div>`).join("")}<form id="route-form"><label>Set building travel estimate<div class="pair"><input name="a" placeholder="e.g. North Hall" required maxlength="80"><input name="b" placeholder="e.g. Library" required maxlength="80"></div></label><div class="pair"><input name="minutes" aria-label="Travel minutes" type="number" min="0" max="120" value="10" required><button class="upload">Save minutes</button></div></form>${Object.entries(
      p.routes,
    )
      .map(
        ([k, v]) =>
          `<div class="block-row">${esc(k)} · ${v} min <button data-route="${esc(k)}" aria-label="Remove travel estimate">×</button></div>`,
      )
      .join("")}</details></section></aside><div class="workspace">${
      view === "saved"
        ? `<div class="workspace-heading"><div><span class="eyebrow">YOUR SHORTLIST</span><h2>Compare your possibilities</h2></div></div>${saved.length ? `<div class="saved-grid">${saved.map((s, i) => `<article class="saved-card"><span class="eyebrow">OPTION ${i + 1}</span><h3>${esc(s.name)}</h3><p class="micro">${esc(s.sections[0]?.term || "Earlier saved plan")}</p>${miniCalendar(s)}<div class="stats">${stat(metrics(s.sections, p))}</div><ul>${s.sections.map((t) => `<li>${esc(t.course)} ${esc(t.id)} · ${esc(t.type)}</li>`).join("")}</ul><div class="pair"><button class="primary" data-open="${i}">Explore this</button><button class="secondary" data-delete="${i}">Remove</button></div></article>`).join("")}</div><p class="micro">Saved section snapshots are retained locally. Travel metrics use your current estimates; availability is rechecked when you explore.</p>` : '<div class="empty"><h3>A little room for possibilities.</h3><p>Save a few schedules from the studio to compare them here.</p></div>'}`
        : `<div class="workspace-heading"><div><span class="eyebrow">YOUR POSSIBILITIES</span><h2>${results.length.toLocaleString()} schedules that fit<span class="green-dot"></span></h2></div><span class="status-pill">${truncated ? "Search limit reached" : "Overlap-free"}</span></div><p class="subline">Compare different weeks at a glance. Sections with identical meeting times are grouped together.</p><div class="studio-tabs"><button id="browse-tab" class="${studio === "browse" ? "chosen" : ""}">Browse schedules</button><button id="detail-tab" class="${studio === "detail" ? "chosen" : ""}">Selected schedule</button></div>${studio === "browse" ? gallery() : ""}${
            studio === "detail"
              ? r
                ? `${variantPicker(r)}<div class="result-top"><div class="pagination"><button id="prev" aria-label="Previous schedule" ${active === 0 ? "disabled" : ""}>&larr;</button><span>Option <b>${active + 1}</b> of ${results.length.toLocaleString()}</span><button id="next" aria-label="Next schedule" ${active === results.length - 1 ? "disabled" : ""}>&rarr;</button></div><button class="primary" id="save">${saved.some((s) => s.id === r.id) ? "Saved" : "+ Save schedule"}</button></div><div class="stats">${stat(r.metrics)}</div><div class="calendar-card">${calendar(r)}</div><div class="legend">${courses.map((c, i) => `<span><i class="dot color${i % 5}"></i>${esc(c.code)}</span>`).join("")}<button id="export">Export schedule</button></div><div class="insights"><h3>Behind this schedule</h3><p>${r.metrics.early + r.metrics.late === 0 ? "All scheduled meetings fit your ideal hours." : `${r.metrics.early + r.metrics.late} minutes per week fall outside your ideal hours.`} ${r.metrics.gap} minutes between meetings across ${r.metrics.days} campus days.</p>${
                    r.metrics.async
                      ? `<p><b>Independent study:</b> ${r.sections
                          .filter((s) => s.async)
                          .map((s) => esc(s.course + " " + s.id))
                          .join(
                            ", ",
                          )} has asynchronous sections. Coursework and any separately scheduled exams still need time.</p>`
                      : ""
                  }<p>${r.metrics.unknown ? `${r.metrics.unknown} weekly transitions use an unverified travel estimate.` : "Travel uses your building estimates."} ${r.metrics.tight ? `<b>${r.metrics.tight} transitions may be too tight.</b>` : ""} Estimates are not measured walking routes.</p><details><summary>Section details & registration numbers</summary>${r.sections.map((s) => `<p>${esc(s.course)} ${esc(s.id)} · ${esc(s.type)} · SLN ${esc(s.sln)} · ${s.async ? "Asynchronous" : esc(s.building || "Location TBA")}</p>`).join("")}</details></div>`
                : `<div class="empty"><span>~</span><h3>No schedules fit these limits.</h3><p>Try clearing a pinned section, widening your available hours, or allowing asynchronous lectures.</p><button class="primary" id="clear">Clear pins and hard limits</button></div>`
              : ""
          }`
    }</div></main><footer>HUSKY HOURS <span>An independent planning tool. Verify registration rules, exams, and availability with your institution.</span></footer><dialog id="review"></dialog>`;
  bind();
}
function bind() {
  bindCourses();
  bindDiscovery();
  document.querySelectorAll("[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        view = b.dataset.view;
        render();
      }),
  );
  document.querySelectorAll("[data-pin]").forEach(
    (el) =>
      (el.onchange = () => {
        let [c, t] = el.dataset.pin.split("|");
        pins[c] ??= {};
        pins[c][t] = el.value;
        selectedId = "";
        recalc();
      }),
  );
  document.querySelectorAll("[data-weight]").forEach(
    (el) =>
      (el.onchange = () => {
        p[el.dataset.weight] = +el.value;
        selectedId = "";
        recalc();
      }),
  );
  document.querySelectorAll("[data-pref]").forEach(
    (el) =>
      (el.onchange = () => {
        if (!el.value) return;
        p[el.dataset.pref] = mins(el.value);
        selectedId = "";
        recalc();
      }),
  );
  document.querySelectorAll("[data-number]").forEach(
    (el) =>
      (el.onchange = () => {
        if (!el.checkValidity()) return;
        p[el.dataset.number] = +el.value;
        recalc();
      }),
  );
  document.querySelectorAll("[data-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        let [c] = courses.splice(+b.dataset.remove, 1);
        delete pins[c.code];
        recalc();
      }),
  );
  document.querySelectorAll("[data-unblock]").forEach(
    (b) =>
      (b.onclick = () => {
        p.blocks.splice(+b.dataset.unblock, 1);
        recalc();
      }),
  );
  document.querySelectorAll("[data-route]").forEach(
    (b) =>
      (b.onclick = () => {
        delete p.routes[b.dataset.route];
        recalc();
      }),
  );
  $("#async").onchange = (e) => {
    p.allowAsync = e.target.checked;
    selectedId = "";
    recalc();
  };
  $("#reset").onclick = () => {
    p = structuredClone(defaults);
    pins = {};
    selectedId = "";
    recalc();
  };
  $("#clear")?.addEventListener("click", () => {
    pins = {};
    p.hardStart = 0;
    p.hardEnd = 1440;
    p.blocks = [];
    p.buffer = 0;
    p.allowAsync = true;
    recalc();
  });
  $("#dismiss")?.addEventListener("click", () => {
    notice = "";
    render();
  });
  $("#prev")?.addEventListener("click", () => {
    active--;
    selectedId = results[active].id;
    render();
  });
  $("#next")?.addEventListener("click", () => {
    active++;
    selectedId = results[active].id;
    render();
  });
  $("#save")?.addEventListener("click", () => {
    let r = results[active];
    if (!saved.some((s) => s.id === r.id))
      saved.push({ ...r, name: `Schedule ${saved.length + 1}` });
    persist();
    render();
  });
  document.querySelectorAll("[data-section]").forEach(
    (b) =>
      (b.onclick = () => {
        let [c, t, id] = b.dataset.section.split("|");
        pins[c] ??= {};
        pins[c][t] = pins[c][t] === id ? "" : id;
        selectedId = results[active].id;
        recalc();
      }),
  );
  document.querySelectorAll("[data-delete]").forEach(
    (b) =>
      (b.onclick = () => {
        saved.splice(+b.dataset.delete, 1);
        persist();
        render();
      }),
  );
  document.querySelectorAll("[data-open]").forEach(
    (b) =>
      (b.onclick = () => {
        let s = saved[+b.dataset.open];
        if (
          s.sections.some(
            (t) =>
              !courses.some(
                (c) =>
                  c.code === t.course &&
                  c.sections.some(
                    (x) =>
                      sectionSignature({
                        ...x,
                        course: c.code,
                        term: c.term,
                      }) === sectionSignature(t),
                  ),
              ),
          )
        ) {
          notice =
            "This saved option belongs to a different term or includes changed or removed sections. Import its original course plan to explore it.";
          render();
          return;
        }
        pins = {};
        for (let t of s.sections) {
          pins[t.course] ??= {};
          pins[t.course][sectionGroup(t)] = t.id;
        }
        selectedId = s.id;
        view = "explore";
        studio = "detail";
        recalc();
      }),
  );
  $("#block-form").onsubmit = (e) => {
    e.preventDefault();
    let f = new FormData(e.target),
      start = mins(f.get("start")),
      end = mins(f.get("end"));
    if (start >= end) {
      notice = "Unavailable time must end after it starts.";
      render();
      return;
    }
    p.blocks.push({ day: +f.get("day"), start, end });
    recalc();
  };
  $("#route-form").onsubmit = (e) => {
    e.preventDefault();
    let f = new FormData(e.target),
      a = f.get("a").trim(),
      b = f.get("b").trim();
    if (!a || !b || a === b) {
      notice = "Enter two different building names or codes.";
      render();
      return;
    }
    p.routes[[a, b].sort().join("–")] = +f.get("minutes");
    recalc();
  };
  $("#import").onclick = () => $("#file").click();
  $("#file").onchange = async (e) => {
    const files = [...e.target.files];
    $("#import").textContent = "Reading PDFs…";
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).href;
      let imported = [];
      for (let file of files) {
        const doc = await pdfjs.getDocument({
          data: new Uint8Array(await file.arrayBuffer()),
        }).promise;
        let text = "";
        for (let n = 1; n <= doc.numPages; n++) {
          let page = await doc.getPage(n),
            content = await page.getTextContent();
          text += content.items.map((i) => i.str).join("\n") + "\n";
        }
        imported.push(parseCourse(text, file.name));
        await doc.destroy();
      }
      review(imported);
    } catch (err) {
      notice = "Import could not be completed: " + err.message;
      render();
    }
  };
  $("#export")?.addEventListener("click", () => {
    let r = results[active],
      blob = new Blob(
        [
          JSON.stringify(
            {
              term: courses[0]?.term || "",
              sections: r.sections,
              metrics: r.metrics,
              preferences: p,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "husky-schedule.json";
    a.click();
    URL.revokeObjectURL(url);
  });
}

recalc();

function miniCalendar(r) {
  const timed = events(r.sections),
    all = events([...courses.flatMap((c) => c.sections), ...r.sections]),
    days = calendarDays([...courses.flatMap((c) => c.sections), ...r.sections]),
    from = Math.min(480, ...all.map((s) => s.start)),
    to = Math.max(1080, ...all.map((s) => s.end));
  return `<div class="mini" style="--day-count:${days.length}" aria-label="Weekly schedule preview, ${fmt(from)} to ${fmt(to)}"><div class="mini-head"><span>${fmt(from).replace(":00", "")}</span>${days.map((d) => `<b>${DAY_SHORT[d]}</b>`).join("")}</div><div class="mini-body"><div class="mini-axis"><span style="top:${((720 - from) / (to - from)) * 100}%">NOON</span><small>${fmt(to).replace(":00", "")}</small></div>${days
    .map(
      (d) =>
        `<div class="mini-day">${timed
          .filter((s) => s.days.includes(d))
          .map(
            (s) =>
              `<i title="${esc(s.course + " " + s.id)} ${fmt(s.start)}–${fmt(s.end)}" class="mini-event color${
                Math.max(
                  0,
                  courses.findIndex((c) => c.code === s.course),
                ) % 5
              }" style="top:${((s.start - from) / (to - from)) * 100}%;height:${((s.end - s.start) / (to - from)) * 100}%"></i>`,
          )
          .join("")}</div>`,
    )
    .join("")}</div></div>`;
}
function filterSelect(key, label, options) {
  return `<label>${label}<select data-discover="${key}">${options.map(([v, t]) => `<option value="${v}" ${String(filters[key] || "") === String(v) ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
}
function gallery() {
  if (!courses.length)
    return `<div class="empty welcome"><span class="eyebrow">START WITH YOUR COURSES</span><h3>Your next term starts here.</h3><p>Add any course, from any institution. Enter the available sections and meeting times, then compare the weeks that fit your life.</p><button class="primary" id="welcome-add">Add your first course</button><p class="micro">Already have a plan? Import its exported file from the sidebar.<br>MyPlan PDF import is also available for supported UW course tables.</p></div>`;
  const count = patterns.reduce((n, g) => n + g.variants.length, 0),
    visible = patterns.slice(page * 12, page * 12 + 12);
  return `<section class="discovery"><div class="discovery-intro"><div><h3>See the shape of your week</h3><p>${patterns.length.toLocaleString()} distinct weekly patterns from ${count.toLocaleString()} matching schedules${truncated ? " in the searched subset" : ""}.</p></div><button id="clear-discovery" class="secondary">Clear filters</button></div><div class="browse-filters">${filterSelect(
    "sort",
    "Sort schedules",
    [
      ["match", "Best preference match"],
      ["later", "Latest starts"],
      ["finish", "Earliest finishes"],
      ["gaps", "Fewest weekly gaps"],
      ["days", "Fewest campus days"],
      ["walk", "Least estimated travel"],
    ],
  )}${filterSelect("days", "Campus days", [
    ["", "Any number"],
    ["3", "3 days or fewer"],
    ["4", "4 days or fewer"],
  ])}${filterSelect("async", "Section format", [
    ["", "Any format"],
    ["none", "No async sections"],
    ["some", "Includes async sections"],
  ])}${filterSelect("start", "Earliest class", [
    ["", "Any start"],
    ["540", "9 AM or later"],
    ["600", "10 AM or later"],
    ["660", "11 AM or later"],
    ["720", "Noon or later"],
  ])}${filterSelect("end", "Latest finish", [
    ["", "Any finish"],
    ["840", "By 2 PM"],
    ["900", "By 3 PM"],
    ["960", "By 4 PM"],
    ["1020", "By 5 PM"],
  ])}${filterSelect("gap", "Weekly gaps", [
    ["", "Any amount"],
    ["60", "Up to 1 hour"],
    ["120", "Up to 2 hours"],
    ["240", "Up to 4 hours"],
  ])}</div><div class="browse-legend">${courses.map((c, i) => `<span><i class="dot color${i % 5}"></i>${esc(c.code)}</span>`).join("")}<small>Same time scale across previews · travel is estimated</small></div>${
    visible.length
      ? `<div class="pattern-grid">${visible
          .map((g, i) => {
            let r = g.best,
              b = bounds(r),
              index = page * 12 + i;
            return `<article class="pattern-card ${r.id === results[active]?.id ? "is-selected" : ""}"><div class="pattern-title"><span>WEEK ${index + 1}</span><span>${g.variants.length} section ${g.variants.length === 1 ? "combination" : "combinations"}</span></div><button class="preview-button" data-pattern="${index}" aria-label="Open week ${index + 1}">${miniCalendar(r)}</button><div class="pattern-hours">${b.start === null ? "Fully asynchronous" : fmt(b.start) + " – " + fmt(b.end)}<small>${b.start === null ? "No scheduled meetings" : "Earliest start / latest finish"}</small></div><div class="pattern-metrics"><span><b>${r.metrics.days}</b> days</span><span><b>${Math.round(r.metrics.gap / 6) / 10}h</b> gaps</span><span><b>${r.metrics.walk}m</b> travel</span></div><p class="pattern-note">${r.metrics.async ? r.metrics.async + " async section" + (r.metrics.async === 1 ? "" : "s") : "All sections scheduled"}${r.metrics.tight ? " · Tight transfers" : ""}${r.metrics.unknown ? " · Travel unverified" : ""}</p><div class="pair"><button class="primary" data-pattern="${index}">View week</button><button class="secondary" data-save-pattern="${index}">${saved.some((s) => s.id === r.id) ? "Saved" : "Save"}</button></div></article>`;
          })
          .join(
            "",
          )}</div><div class="browse-pagination"><span>Showing ${page * 12 + 1}–${Math.min((page + 1) * 12, patterns.length)} of ${patterns.length} patterns</span><div><button class="secondary" id="patterns-prev" ${page === 0 ? "disabled" : ""}>Previous</button><span>Page ${page + 1} of ${Math.ceil(patterns.length / 12)}</span><button class="secondary" id="patterns-next" ${(page + 1) * 12 >= patterns.length ? "disabled" : ""}>Next</button></div></div>`
      : `<div class="empty"><h3>No weeks match these filters.</h3><p>Broaden your filters or relax pinned sections and availability in the sidebar.</p><button class="primary" id="empty-reset">Clear browse filters</button></div>`
  }</section>`;
}
function variantPicker(r) {
  let group = discover(results).find((g) =>
    g.variants.some((v) => v.id === r.id),
  );
  return `<div class="variant-bar"><button id="back-browse" class="secondary">&larr; All weekly patterns</button><label>Same week, different sections<select id="variant">${(group?.variants || [r]).map((v) => `<option value="${esc(v.id)}" ${v.id === r.id ? "selected" : ""}>${esc(v.sections.map((s) => s.course + " " + s.id).join(" / "))} · ${v.metrics.walk}m travel</option>`).join("")}</select></label></div>`;
}
function bindDiscovery() {
  const browse = () => {
    studio = "browse";
    render();
  };
  $("#browse-tab")?.addEventListener("click", browse);
  $("#back-browse")?.addEventListener("click", browse);
  $("#detail-tab")?.addEventListener("click", () => {
    studio = "detail";
    render();
  });
  const clear = () => {
    filters = { sort: "match" };
    page = 0;
    render();
  };
  $("#clear-discovery")?.addEventListener("click", clear);
  $("#empty-reset")?.addEventListener("click", clear);
  document.querySelectorAll("[data-discover]").forEach(
    (el) =>
      (el.onchange = () => {
        filters[el.dataset.discover] = el.value;
        page = 0;
        render();
      }),
  );
  document.querySelectorAll("[data-pattern]").forEach(
    (el) =>
      (el.onclick = () => {
        let r = patterns[+el.dataset.pattern].best;
        active = results.findIndex((s) => s.id === r.id);
        selectedId = r.id;
        studio = "detail";
        render();
        $(".workspace").scrollIntoView({ behavior: "smooth", block: "start" });
      }),
  );
  document.querySelectorAll("[data-save-pattern]").forEach(
    (el) =>
      (el.onclick = () => {
        let r = patterns[+el.dataset.savePattern].best;
        if (!saved.some((s) => s.id === r.id))
          saved.push({ ...r, name: `Schedule ${saved.length + 1}` });
        persist();
        render();
      }),
  );
  $("#variant")?.addEventListener("change", (e) => {
    active = results.findIndex((s) => s.id === e.target.value);
    selectedId = e.target.value;
    render();
  });
  $("#patterns-prev")?.addEventListener("click", () => {
    page--;
    render();
    $(".discovery").scrollIntoView({ behavior: "smooth" });
  });
  $("#patterns-next")?.addEventListener("click", () => {
    page++;
    render();
    $(".discovery").scrollIntoView({ behavior: "smooth" });
  });
}
function saveCourse(course, index = -1) {
  const next = [...courses];
  if (index >= 0) next[index] = course;
  else next.push(course);
  const valid = validatePlanCourses(next);
  if (index >= 0) delete pins[courses[index].code];
  courses = valid;
  delete pins[course.code];
  selectedId = "";
  recalc();
}
function editCourse(index = -1) {
  openCourseEditor($("#review"), index >= 0 ? courses[index] : null, {
    term: courses[0]?.term || "",
    onSave: (c) => saveCourse(c, index),
    onCancel: () => render(),
  });
}
function downloadJson(data, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function bindCourses() {
  $("#add-course").onclick = () => editCourse();
  $("#new-plan").onclick = () => {
    const dialog = $("#review");
    dialog.innerHTML = `<h2>Start a new term</h2><p>Export your course data first if you want to return to it. Starting a new term clears the active courses, pins, and unavailable times. Saved schedules remain in this browser.</p><div class="dialog-actions"><button id="cancel-new" class="secondary">Cancel</button><button id="backup-new" class="secondary">Export current courses</button><button id="confirm-new" class="primary">Start empty plan</button></div>`;
    dialog.showModal();
    $("#cancel-new").onclick = () => dialog.close();
    $("#backup-new").onclick = () =>
      downloadJson({ version: 1, courses }, "course-plan.json");
    $("#confirm-new").onclick = () => {
      dialog.close();
      courses = [];
      pins = {};
      p.blocks = [];
      selectedId = "";
      filters = { sort: "match" };
      studio = "browse";
      view = "explore";
      recalc();
    };
  };
  $("#welcome-add")?.addEventListener("click", () => editCourse());
  document
    .querySelectorAll("[data-edit]")
    .forEach((el) => (el.onclick = () => editCourse(+el.dataset.edit)));
  $("#export-plan").onclick = () =>
    downloadJson({ version: 1, courses }, "course-plan.json");
  $("#import-plan").onclick = () => $("#plan-file").click();
  $("#plan-file").onchange = async (e) => {
    let file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 5_000_000)
        throw Error("Course plan files must be smaller than 5 MB.");
      const data = JSON.parse(await file.text()),
        incoming = validatePlanCourses(data.courses);
      const dialog = $("#review");
      dialog.innerHTML = `<h2>Import course plan</h2><p>This replaces the active course list with ${incoming.length} courses${incoming.length ? " for " + esc(incoming[0].term) : ""}. Section pins will be cleared. Saved schedules and preferences stay in this browser.</p><ul>${incoming.map((c) => `<li>${esc(c.code)} · ${c.sections.length} sections</li>`).join("")}</ul><div class="dialog-actions"><button id="cancel-plan" class="secondary">Cancel</button><button id="confirm-plan" class="primary">Use this course plan</button></div>`;
      dialog.showModal();
      $("#cancel-plan").onclick = () => {
        dialog.close();
        render();
      };
      $("#confirm-plan").onclick = () => {
        dialog.close();
        courses = incoming;
        pins = {};
        selectedId = "";
        notice = "Course plan imported. Review your preferences for this term.";
        recalc();
      };
    } catch (err) {
      notice = "Could not import course plan: " + err.message;
      render();
    }
  };
}
function review(imported) {
  const queue = [...imported];
  function next() {
    if (!queue.length) {
      notice =
        "Courses imported and reviewed. Verify section requirements and registration availability with your institution.";
      render();
      return;
    }
    const course = queue.shift();
    if (!course.term) course.term = courses[0]?.term || "";
    openCourseEditor($("#review"), course, {
      onSave: (c) => {
        const index = courses.findIndex(
          (x) => x.code.toLowerCase() === c.code.toLowerCase(),
        );
        saveCourse(c, index);
        queueMicrotask(next);
      },
      onCancel: () => render(),
    });
  }
  next();
}
