# Husky Hours

A browser-local course schedule planner. Start with an empty plan and add courses from any institution for any term or session. No course catalog is hardcoded into the app.

## Run on any device

Requires Node.js 22.12+ or Node.js 24 and npm.

```sh
git clone https://github.com/RzanderR/uw-course-scheduler.git
cd uw-course-scheduler
npm ci
npm run dev
```

Open the URL printed by Vite. `npm test` runs the scheduling, import, validation, and discovery tests. `npm run build` produces a static `dist` folder.

## Add your courses

Use **Add course** to enter a course code/name, a term label including its year, and the available sections. Course codes, section names, and meeting types are free text: a main section can be a lecture, seminar, studio, lab, or another type.

- The planner chooses one **main section** per course.
- **Required components** are linked to a particular main section or to any main section. Give alternatives the same component name (for example, Lab). Components with different names (Lab and Discussion) are both required.
- Each section can have several meeting rows, with different days, times, buildings, and rooms. Monday through Sunday are supported.
- Explicitly asynchronous sections have no scheduled meetings. Their required in-person components remain scheduled.
- Edit any course later. Invalid times, overlapping meetings, duplicate section names, missing main sections, and mixed-term course lists are rejected.

Plan one term/session at a time. Use **Start a new term** to clear the active courses after exporting them. Existing local courses from earlier app versions are preserved; they are not defaults for new users.

## Import and portability

**Import MyPlan PDF** is a convenience parser for text-based UW MyPlan section tables. It recognizes other departments and years and extracts multiple meeting rows. Every imported course opens in the editor so users can correct times, term labels, and inferred pairings before saving. Arbitrary institutional PDF layouts, scanned files, and live registration systems are not automatically supported: use the manual editor for those sources.

**Export courses / Import courses** transfer the complete editable course dataset as a JSON file between browsers/devices. An import replaces the active course list after a review step. Preferences and saved schedules remain local to each browser; they are not synced by GitHub or included in the course export. Individual schedules can also be exported from the detail view.

## Explore schedules

The gallery groups identical course meeting patterns while retaining every valid section combination. Miniature calendars, filtering, sorting, direct selection, and saved comparisons make alternatives visible. Ranking considers ideal hours, weekly gaps, days with meetings, and estimated travel. Hard constraints include unavailable times, earliest/latest allowed hours, and minimum transition buffers.

## Limits

Schedules represent a recurring weekly timetable in the courses' local time. Alternating weeks, date-specific exceptions, final exams, prerequisites, seat availability, and registration restrictions must be verified separately. Split overnight meetings into separate days. Courses using different campuses/time zones need times converted to one local timetable before entry.

Travel values are user estimates, not mapped walking routes. Different buildings default to 10 minutes; same-building transitions use 2 minutes; unknown locations/transitions are flagged. The campus-days metric counts days with scheduled meetings, including synchronous online meetings if entered. Search is capped at 200,000 nodes and reports truncation. Very large catalogs should be narrowed with pins and availability constraints.

## Project structure

- `src/model.js`: generic course schema, validation, and meeting helpers.
- `src/editor.js`: manual course entry and editable PDF review.
- `src/engine.js`: section combinations, conflict checks, and scoring.
- `src/discovery.js`: pattern grouping, filtering, and sorting.
- `src/parser.js`: optional MyPlan text adapter.
- `src/main.js`, `src/style.css`: UI and browser-local persistence.
- `tests/fixtures/`: sample UW PDFs' extracted text and parsed data used **only by tests**, never imported by the app.

`node scripts/seed.mjs` regenerates the test fixture from extracted text. `node scripts/check-pdfjs.mjs <PDF-directory>` verifies the original example PDFs when locally available. GitHub Actions runs tests and production builds on pushes and pull requests.
