# Husky Hours

A local UW course schedule explorer built with Vite and vanilla JavaScript.

## Run

npm install
npm run dev

Open the local URL printed by Vite. Run `npm test` for the scheduling engine tests and `npm run build` for a deployable static `dist` folder.

## Features

- 54 source sections from the supplied Winter 2027 CSE 123, MATH 126, and STAT 311 MyPlan PDFs.
- Compatible lecture/quiz combinations, overlap rejection, pinned sections, strict hours, blocked times, and minimum transition buffers.
- Adjustable ranking for ideal hours, gaps, campus days, and estimated travel.
- Weekly calendar, saved local comparisons, and JSON schedule export.
- Browser-local MyPlan PDF import with a review step; files are not sent to a server.

## Data and limits

Starter data is a November 1, 2026 snapshot, not live registration availability. Letter prefixes infer lecture/quiz pairings. MATH 126 D retains its required quiz; STAT 311 B has no quiz. Exams and prerequisites are not automatically validated. Unknown meeting times are rejected. Unknown locations remain visible. Only standard MyPlan lecture/quiz/lab section tables are supported; review imported data carefully.

Walking values are user-configurable estimates, not mapped routes: different buildings default to 10 minutes and same-building transitions to 2 minutes. Unknown transitions are flagged. Ranking is a weighted penalty, not a guarantee of the best real-world schedule. Generation is capped at 200,000 search nodes and indicates truncation. Preferences and saved schedules persist in this browser's local storage.

`src/engine.js` contains the pure scheduling logic. `src/parser.js` parses extracted MyPlan text. `src/courses.json` contains starter data. `scripts/*.txt` preserve extracted source text for reproducibility. `scripts/seed.mjs` rebuilds starter JSON. `scripts/check-pdfjs.mjs` checks the supplied local PDFs with the same extraction library used by the browser.


## Visual schedule discovery

The studio opens with a gallery of distinct weekly patterns. Schedules with identical course meeting times are grouped, preserving every section combination in the detail view. Browse 12 miniature calendars per page, filter by campus days, lecture format, start/finish times, and total gaps, or sort by preference match, later starts, earlier finishes, gaps, days, or estimated travel. Save directly from the gallery and compare calendar previews in Saved.

## Continue on another device

Requires Node.js 22.12+ (or Node.js 24 LTS) and npm.

```sh
git clone https://github.com/RzanderR/uw-course-scheduler.git
cd uw-course-scheduler
npm ci
npm run dev
```

Preferences and saved schedules are browser-local and do not sync through GitHub. Course data and source code are in the repository. To verify additional local source PDFs, run `node scripts/check-pdfjs.mjs <PDF-directory>`.
