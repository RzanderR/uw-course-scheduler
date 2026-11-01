import {
  DAY_NAMES,
  DAY_SHORT,
  validateCourse,
  meetings,
  isPrimary,
} from "./model.js";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const time = (n) =>
  n === 1440
    ? "23:59"
    : `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const minutes = (s) => s.split(":").reduce((a, n) => a * 60 + Number(n), 0);
const blankMeeting = () => ({
  days: [0, 2, 4],
  start: 540,
  end: 590,
  building: "",
  room: "",
});
export function openCourseEditor(
  dialog,
  course,
  { term = "", onSave, onCancel = () => {} },
) {
  const draft = course
    ? structuredClone(course)
    : {
        code: "",
        title: "",
        term,
        sections: [
          {
            id: "01",
            type: "Lecture",
            role: "primary",
            parent: null,
            group: "Main section",
            async: false,
            meetings: [blankMeeting()],
          },
        ],
      };
  draft.sections = draft.sections.map((s) => ({
    ...s,
    role: isPrimary(s) ? "primary" : "companion",
    group: s.group || s.type,
    meetings: structuredClone(meetings(s)),
  }));
  let error = "";
  function draw() {
    dialog.innerHTML = `<form id="course-editor" class="course-editor"><div class="editor-title"><div><span class="eyebrow">YOUR COURSE DATA</span><h2>${course ? "Edit course" : "Add a course"}</h2></div><button type="button" id="close-editor" class="secondary">Cancel</button></div><p>Enter the sections offered for one term. Choose one main section; the planner will also choose one option from each required component linked to it.</p>${error ? `<p class="editor-error" role="alert">${esc(error)}</p>` : ""}<div class="editor-course-fields"><label>Course code or name<input data-course="code" required maxlength="80" value="${esc(draft.code)}" placeholder="e.g. BIO 201, CS50, or Design Studio"></label><label>Term / session and year<input data-course="term" required maxlength="100" value="${esc(draft.term)}" placeholder="e.g. Spring 2028"></label><label class="full">Course title (optional)<input data-course="title" value="${esc(draft.title)}" placeholder="e.g. Introduction to Biology"></label></div><div class="editor-sections">${draft.sections
      .map(
        (s, i) =>
          `<section class="editor-section"><div class="section-heading"><h3>Section ${esc(s.id || i + 1)}</h3><button type="button" data-delete-section="${i}" class="secondary">Remove section</button></div><div class="editor-course-fields"><label>Section name<input required data-section-field="${i}|id" value="${esc(s.id)}" placeholder="e.g. 001 or A"></label><label>Meeting type<input required data-section-field="${i}|type" value="${esc(s.type)}" placeholder="Lecture, seminar, lab..."></label><label>Registration number (optional)<input data-section-field="${i}|sln" value="${esc(s.sln)}"></label><label>How this section is selected<select data-section-field="${i}|role"><option value="primary" ${s.role === "primary" ? "selected" : ""}>Main section — choose one</option><option value="companion" ${s.role === "companion" ? "selected" : ""}>Required component</option></select></label>${
            s.role === "companion"
              ? `<label>Required component name<input required data-section-field="${i}|group" value="${esc(s.group)}" placeholder="e.g. Lab or Discussion"><small>Options with the same name are alternatives; different names are all required.</small></label><label>Allowed main section<select data-section-field="${i}|parent"><option value="*" ${s.parent === "*" ? "selected" : ""}>Any main section</option>${draft.sections
                  .filter(isPrimary)
                  .map(
                    (l) =>
                      `<option value="${esc(l.id)}" ${s.parent === l.id ? "selected" : ""}>${esc(l.id)} · ${esc(l.type)}</option>`,
                  )
                  .join("")}</select></label>`
              : ""
          }</div><label class="check"><input data-section-async="${i}" type="checkbox" ${s.async ? "checked" : ""}> Asynchronous — no scheduled meetings</label>${!s.async ? `<div class="meeting-rows">${s.meetings.map((m, j) => `<div class="meeting-row"><div class="meeting-row-title"><b>Meeting ${j + 1}</b><button type="button" data-delete-meeting="${i}|${j}" aria-label="Remove meeting ${j + 1} from section ${esc(s.id)}">Remove</button></div><fieldset><legend>Days</legend><div class="day-checkboxes">${DAY_SHORT.map((d, k) => `<label title="${DAY_NAMES[k]}"><input type="checkbox" data-meeting-day="${i}|${j}|${k}" ${m.days.includes(k) ? "checked" : ""}>${d}</label>`).join("")}</div></fieldset><div class="editor-course-fields"><label>Start<input required type="time" data-meeting-field="${i}|${j}|start" value="${time(m.start)}"></label><label>End<input required type="time" data-meeting-field="${i}|${j}|end" value="${time(m.end)}"></label><label>Building / location (optional)<input data-meeting-field="${i}|${j}|building" value="${esc(m.building)}" placeholder="Building name or Online"></label><label>Room (optional)<input data-meeting-field="${i}|${j}|room" value="${esc(m.room)}"></label></div></div>`).join("")}</div><button type="button" class="upload" data-add-meeting="${i}">+ Add meeting at another time or location</button>` : '<p class="micro">This section has no calendar blocks. Coursework still needs time.</p>'}</section>`,
      )
      .join(
        "",
      )}</div><button type="button" id="add-section" class="upload">+ Add section option</button><div class="dialog-actions"><span class="micro">All times are local to the course. Review registration rules with your institution.</span><button class="primary" type="submit">Save course</button></div></form>`;
    const $ = (s) => dialog.querySelector(s);
    $("#close-editor").onclick = () => {
      dialog.close();
      onCancel();
    };
    dialog
      .querySelectorAll("[data-course]")
      .forEach(
        (el) => (el.oninput = () => (draft[el.dataset.course] = el.value)),
      );
    dialog.querySelectorAll("[data-section-field]").forEach(
      (el) =>
        (el.onchange = () => {
          let [i, k] = el.dataset.sectionField.split("|");
          let previous = draft.sections[i][k];
          draft.sections[i][k] = el.value;
          if (k === "role") {
            draft.sections[i].parent = el.value === "primary" ? null : "*";
            draft.sections[i].group =
              el.value === "primary" ? "Main section" : draft.sections[i].type;
            draw();
          }
          if (k === "id") {
            for (const s of draft.sections)
              if (s.parent === previous) s.parent = el.value;
            draw();
          }
        }),
    );
    dialog.querySelectorAll("[data-section-async]").forEach(
      (el) =>
        (el.onchange = () => {
          let s = draft.sections[el.dataset.sectionAsync];
          s.async = el.checked;
          s.meetings = el.checked ? [] : [blankMeeting()];
          draw();
        }),
    );
    dialog.querySelectorAll("[data-meeting-field]").forEach(
      (el) =>
        (el.oninput = () => {
          let [i, j, k] = el.dataset.meetingField.split("|");
          draft.sections[i].meetings[j][k] = ["start", "end"].includes(k)
            ? minutes(el.value)
            : el.value;
        }),
    );
    dialog.querySelectorAll("[data-meeting-day]").forEach(
      (el) =>
        (el.onchange = () => {
          let [i, j, k] = el.dataset.meetingDay.split("|");
          let m = draft.sections[i].meetings[j];
          m.days = el.checked
            ? [...new Set([...m.days, +k])]
            : m.days.filter((d) => d !== +k);
        }),
    );
    dialog.querySelectorAll("[data-delete-section]").forEach(
      (el) =>
        (el.onclick = () => {
          draft.sections.splice(+el.dataset.deleteSection, 1);
          draw();
        }),
    );
    dialog.querySelectorAll("[data-delete-meeting]").forEach(
      (el) =>
        (el.onclick = () => {
          let [i, j] = el.dataset.deleteMeeting.split("|");
          draft.sections[i].meetings.splice(+j, 1);
          draw();
        }),
    );
    dialog.querySelectorAll("[data-add-meeting]").forEach(
      (el) =>
        (el.onclick = () => {
          draft.sections[el.dataset.addMeeting].meetings.push(blankMeeting());
          draw();
        }),
    );
    $("#add-section").onclick = () => {
      let id = String(draft.sections.length + 1).padStart(2, "0");
      while (draft.sections.some((s) => s.id === id))
        id = String(+id + 1).padStart(2, "0");
      draft.sections.push({
        id,
        type: "Lecture",
        role: "primary",
        parent: null,
        group: "Main section",
        async: false,
        meetings: [blankMeeting()],
      });
      draw();
    };
    $("#course-editor").onsubmit = (e) => {
      e.preventDefault();
      try {
        const validated = validateCourse(draft);
        onSave(validated);
        dialog.close();
      } catch (err) {
        error = err.message;
        draw();
        dialog.scrollTop = 0;
      }
    };
  }
  draw();
  dialog.showModal();
}
