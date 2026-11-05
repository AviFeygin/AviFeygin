// Draws a groundskeeper mowing the GitHub contribution graph as an animated SVG.
// The graph stays flat; he walks across it diagonally, bouncing off the edges.
// Usage: node scripts/mower.mjs <github-user> <out-dir>
// Writes <out-dir>/mower.svg (light) and <out-dir>/mower-dark.svg (dark).
// No dependencies. Needs Node 18+ for fetch.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const [user = "AviFeygin", outDir = "dist"] = process.argv.slice(2);

// ---------- data ----------

async function loadCalendar() {
  // CALENDAR_HTML lets you test against a saved copy of the page.
  const html = process.env.CALENDAR_HTML
    ? await readFile(process.env.CALENDAR_HTML, "utf8")
    : await (await fetch(`https://github.com/users/${user}/contributions`)).text();

  const cells = [];
  for (const m of html.matchAll(/<td[^>]*data-date="([^"]+)"[^>]*>/g)) {
    const tag = m[0];
    const id = tag.match(/contribution-day-component-(\d+)-(\d+)/);
    const level = tag.match(/data-level="(\d)"/);
    if (!id || !level) continue;
    cells.push({ r: +id[1], c: +id[2], level: +level[1] });
  }
  if (cells.length < 7) throw new Error(`No calendar cells found for ${user}`);
  return cells;
}

// ---------- look ----------

const THEMES = {
  light: {
    levels: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
    blade: ["", "#73d487", "#2fa952", "#24863f", "#17532a"],
    mowed: ["#c9e59a", "#b2d77c"],
    clip: "#5fae3c",
  },
  dark: {
    levels: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
    blade: ["", "#17603a", "#0b8a43", "#3cc45a", "#6af07c"],
    mowed: ["#4b7a2c", "#3f6a24"],
    clip: "#6cc04a",
  },
};

// ---------- the groundskeeper ----------
// Original pixel art in a small isometric style: three tones per material and
// dark outlines. Two views, each mirrored, give four facings. Each view is built
// from layers so the mower can sit in front of him or behind him.

const PALETTE = {
  X: "#1e1a18", // outline
  A: "#5cc261", // cap light
  C: "#2f8a35", // cap
  c: "#1c5e22", // cap shade
  T: "#ffd9ad", // skin light
  S: "#efb57c", // skin
  s: "#c98752", // skin shade
  E: "#1d140c", // eye
  h: "#6b4429", // hair
  H: "#4a2c19", // hair shade
  F: "#9fe09a", // shirt light
  G: "#62b85d", // shirt
  g: "#3e8a3a", // shirt shade
  L: "#5d4037", // belt
  P: "#6a9be0", // overalls light
  O: "#3b70b5", // overalls
  o: "#244a7c", // overalls shade
  B: "#6d4c41", // boots
  b: "#3e2723", // boots shade
  I: "#e0e0e0", // handle light
  J: "#8d8d8d", // handle shade
  R: "#ff7a68", // mower light
  M: "#e53935", // mower
  m: "#9e2420", // mower shade
  W: "#f4f4f4", // engine cover
  w: "#b9b9b9", // engine shade
  K: "#262626", // tyre
  k: "#8a8a8a", // hub
};

const HEAD_FRONT = [
  "......XXXXX.....",
  ".....XAAAACX....",
  "....XAAAACCCX...",
  "....XCCCCCCCXXXX",
  "....XcccccccAAAcX",
  "....XhhTTTTSXXXX",
  "....XhTTTTETX...",
  "....XHTTTTTSX...",
  ".....XsTTTSsX...",
  "......XXssXX....",
];
const HEAD_BACK = [
  "......XXXXX..XX.",
  ".....XAAAACXXAcX",
  "....XAAAACCCXcX.",
  "....XCCCCCCCcX..",
  "....XcccccccX...",
  "....XhhhhhhhsX..",
  "....XhhhhhhhSX..",
  "....XHhhhhhHX...",
  ".....XHhhhHX....",
  "......XXssXX....",
];
const BODY_FRONT = [
  "....XXFFGGGGXX....",
  "...XFFFGGGGGGgX...",
  "...XFFGGGGGGGgSX..",
  "...XFgGGGGGGGgSSX.",
  "...XFgGGGGGGGXXTSX",
  "...XFgGGGGGGgX.XSX",
  "...XggLLLLLLLoX...",
  "....XPOOOOOOoX....",
  "....XPOOOOOOoX....",
  "....XPOOOOOOoX....",
];
const BODY_BACK = [
  "....XXFFGGGGXX....",
  "...XFFFGGGGGGgX...",
  "...XFFGGgGGGGgSX..",
  "...XFgGGgGGGGgSSX.",
  "...XFgGGgGGGGgXTSX",
  "...XFgGGgGGGGgXXX.",
  "...XggLLLLLLLoX...",
  "....XPOoOOOOoX....",
  "....XPOOOOOOoX....",
  "....XPOOOOOOoX....",
];
const LEGS = [
  [
    "....XPOOOXOOoX....",
    "....XPOoXXPOoX....",
    "...XPOoX..XPOoX...",
    "...XPOoX...XPOoX..",
    "...XPOoX...XPOoX..",
    "..XBBBbX....XBBBX.",
    "..XBBBBbX...XBBBBX",
    "...XXXXX.....XXXXX",
  ],
  [
    "....XPOOOOOOoX....",
    "....XPOOOOOOoX....",
    ".....XPOoPOoX.....",
    ".....XPOoPOoX.....",
    ".....XPOoPOoX.....",
    "....XBBBBBBbX.....",
    "....XBBBBBBBbX....",
    ".....XXXXXXXX.....",
  ],
];
const MOWER = [
  "..XXXXXXXX..",
  ".XRRRRRRRMX.",
  "XRRXWWWXRMMX",
  "XRRXwWWXMMmX",
  "XRRRXXXMMMmX",
  "XMMMMMMMMMmX",
  "XmmmmmmmmmmX",
  ".XKkX..XKkX.",
  "..XX....XX..",
];
const HANDLE_FRONT = [
  "IJ...",
  "IJ...",
  ".IJ..",
  ".IJ..",
  "..IJ.",
  "..IJ.",
  "...IJ",
  "...IJ",
];
const HANDLE_BACK = ["IIJ..", "..IIJ"];

// Feet sit here on the canvas.
const ANCHOR_X = 10;
const ANCHOR_Y = 34;

function compose(layers, w = 34, h = 40) {
  const grid = Array.from({ length: h }, () => Array(w).fill("."));
  for (const { art, x, y } of layers) {
    art.forEach((line, i) => {
      [...line].forEach((ch, j) => {
        if (ch !== "." && grid[y + i] && x + j < w) grid[y + i][x + j] = ch;
      });
    });
  }
  return grid.map((row) => row.join(""));
}

function pixels(rows) {
  // Art rows to <rect>s, merging runs of one color.
  let out = "";
  rows.forEach((line, i) => {
    let x = 0;
    while (x < line.length) {
      const ch = line[x];
      let run = 1;
      while (line[x + run] === ch) run++;
      if (ch !== ".") {
        out += `<rect x="${x - ANCHOR_X}" y="${i - ANCHOR_Y}" width="${run}" height="1" fill="${PALETTE[ch]}"/>`;
      }
      x += run;
    }
  });
  return out;
}

// Person layers sit with the feet (last legs row) on ANCHOR_Y.
const PERSON_TOP = ANCHOR_Y - 27;
function frontFrame(legs) {
  return compose([
    { art: HEAD_FRONT, x: 0, y: PERSON_TOP },
    { art: BODY_FRONT, x: 0, y: PERSON_TOP + 10 },
    { art: legs, x: 0, y: PERSON_TOP + 20 },
    { art: HANDLE_FRONT, x: 17, y: PERSON_TOP + 15 },
    { art: MOWER, x: 19, y: PERSON_TOP + 23 },
  ]);
}
function backFrame(legs) {
  return compose([
    { art: MOWER, x: 21, y: PERSON_TOP + 10 },
    { art: HEAD_BACK, x: 0, y: PERSON_TOP },
    { art: BODY_BACK, x: 0, y: PERSON_TOP + 10 },
    { art: legs, x: 0, y: PERSON_TOP + 20 },
    { art: HANDLE_BACK, x: 17, y: PERSON_TOP + 14 },
  ]);
}

function view(frames, clipAt, color) {
  const [cx, cy] = [clipAt[0] - ANCHOR_X, clipAt[1] - ANCHOR_Y];
  const clips = [0, 1, 2, 3]
    .map((i) => `<rect class="clip c${i}" x="${cx}" y="${cy}" width="1.5" height="1.5" fill="${color}"/>`)
    .join("");
  return (
    `<g class="legA">${pixels(frames[0])}</g>` + `<g class="legB">${pixels(frames[1])}</g>` + clips
  );
}

// ---------- layout and timing ----------

const CELL = 11;
const PITCH = 14;
const ROWS = 7;
const STEP = 0.065; // seconds per step
const PAUSE = 3; // seconds to admire the stripes
const REGROW = 1.2; // seconds for the grass to grow back

// Diagonal facings and which view draws them.
const FACING = {
  "1,1": { name: "SE", view: "front", flip: 1 },
  "-1,1": { name: "SW", view: "front", flip: -1 },
  "1,-1": { name: "NE", view: "back", flip: 1 },
  "-1,-1": { name: "NW", view: "back", flip: -1 },
};

function route(cols) {
  // Walk diagonally, bounce off the top and bottom, and at each side wall
  // step over one square before heading back. This reaches every square.
  const steps = [];
  let c = 0;
  let r = 0;
  let dc = 1;
  let dr = 1;
  let pass = 0;
  const seen = new Set(["0,0"]);
  steps.push({ c, r, dc, dr, pass });
  while (seen.size < cols * ROWS && steps.length < 5000) {
    let nr = r + dr;
    if (nr < 0 || nr >= ROWS) {
      dr = -dr;
      nr = r + dr;
    }
    const nc = c + dc;
    if (nc < 0 || nc >= cols) {
      dc = -dc;
      pass++;
      r = nr;
    } else {
      c = nc;
      r = nr;
    }
    steps.push({ c, r, dc, dr, pass });
    seen.add(`${c},${r}`);
  }
  return steps;
}

function build(cells, theme) {
  const t = THEMES[theme];
  const cols = Math.max(...cells.map((x) => x.c)) + 1;
  const W = cols * PITCH - (PITCH - CELL);
  const H = ROWS * PITCH - (PITCH - CELL);
  const center = (c, r) => [c * PITCH + CELL / 2, r * PITCH + CELL / 2];

  // Come in diagonally from the top-left, mow, then carry on until off-screen.
  const ENTRY = 6;
  const steps = route(cols);
  const last = steps[steps.length - 1];
  const exitSteps = 12;
  const path = [];
  for (let k = ENTRY; k > 0; k--) path.push({ c: -k, r: -k, dc: 1, dr: 1 });
  path.push(...steps);
  for (let k = 1; k <= exitSteps; k++) {
    path.push({ c: last.c + last.dc * k, r: last.r + last.dr * k, dc: last.dc, dr: last.dr });
  }

  const walkEnd = (path.length - 1) * STEP;
  const total = walkEnd + PAUSE + REGROW + 0.5;
  const pct = (s) => ((s / total) * 100).toFixed(3) + "%";

  // Keyframes only where the direction changes.
  const moveKf = [];
  const turns = [];
  path.forEach((p, i) => {
    const prev = path[i - 1];
    const next = path[i + 1];
    const turning = !prev || !next || prev.dc !== p.dc || prev.dr !== p.dr || next.dc !== p.dc || next.dr !== p.dr;
    if (turning) {
      const [x, y] = center(p.c, p.r);
      moveKf.push(`${pct(i * STEP)}{transform:translate(${x}px,${y}px)}`);
    }
    // Facing for the step leaving this square.
    const dir = next ? [Math.sign(next.c - p.c) || p.dc, Math.sign(next.r - p.r) || p.dr] : [p.dc, p.dr];
    const name = FACING[`${dir[0]},${dir[1]}`].name;
    if (!turns.length || turns[turns.length - 1][1] !== name) turns.push([i * STEP, name]);
  });
  moveKf.push(`100%{transform:translate(${center(last.c + last.dc * exitSteps, last.r + last.dr * exitSteps).map((v) => v + "px").join(",")})}`);
  const showKf = (name) => turns.map(([s, n]) => `${pct(s)}{opacity:${n === name ? 1 : 0}}`).join("") + "100%{opacity:0}";

  // First time each square is cut, and which pass cut it.
  const cutAt = new Map();
  path.forEach((p, i) => {
    const key = `${p.c},${p.r}`;
    if (!cutAt.has(key) && p.pass !== undefined) {
      cutAt.set(key, { at: Math.max(0, (i - 0.5) * STEP), pass: p.pass });
    }
  });

  // ---------- grass ----------
  const regrowStart = pct(walkEnd + PAUSE);
  const regrowEnd = pct(walkEnd + PAUSE + REGROW);
  let css = "";
  let ground = "";
  let tall = "";
  for (const cell of cells) {
    const x = cell.c * PITCH;
    const y = cell.r * PITCH;
    if (cell.level === 0) {
      ground += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${t.levels[0]}"/>`;
      continue;
    }
    const { at, pass } = cutAt.get(`${cell.c},${cell.r}`);
    // Cut lawn underneath, striped by pass like a real mown lawn.
    ground += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${t.mowed[pass % 2]}"/>`;
    const id = `g${cell.r}_${cell.c}`;
    css += `@keyframes ${id}{0%,${pct(at)}{opacity:1}${pct(at + 0.001)},${regrowStart}{opacity:0}${regrowEnd},100%{opacity:1}}.${id}{animation:${id} ${total.toFixed(2)}s linear infinite}`;
    const h = 1.5 + cell.level; // taller blades for busier days
    const blades = [2.2, 5.5, 8.8]
      .map((bx, i) => {
        const top = y - h + (i === 1 ? -1.2 : 0);
        return `M${x + bx - 1.3} ${y + 3}L${x + bx} ${top}L${x + bx + 1.3} ${y + 3}Z`;
      })
      .join("");
    tall += `<g class="${id}"><rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${t.levels[cell.level]}"/><path d="${blades}" fill="${t.blade[cell.level]}"/></g>`;
  }

  // ---------- sprite ----------
  const front = view([frontFrame(LEGS[0]), frontFrame(LEGS[1])], [25, 33], t.clip);
  const back = view([backFrame(LEGS[0]), backFrame(LEGS[1])], [27, 18], t.clip);
  const facings = Object.values(FACING)
    .map((f) => `<g class="d${f.name}"><g transform="scale(${f.flip},1)">${f.view === "front" ? front : back}</g></g>`)
    .join("");

  const dur = `${total.toFixed(2)}s`;
  css += `
@keyframes move{${moveKf.join("")}}
.mover{animation:move ${dur} linear infinite}
${Object.values(FACING)
  .map((f) => `@keyframes s${f.name}{${showKf(f.name)}}.d${f.name}{animation:s${f.name} ${dur} step-end infinite}`)
  .join("\n")}
@keyframes stepA{0%,49.9%{opacity:1}50%,100%{opacity:0}}
@keyframes stepB{0%,49.9%{opacity:0}50%,100%{opacity:1}}
.legA{animation:stepA .3s linear infinite}
.legB{animation:stepB .3s linear infinite}
@keyframes fly{0%{transform:translate(0,0);opacity:1}100%{transform:translate(var(--dx),var(--dy));opacity:0}}
.clip{animation:fly .5s ease-out infinite}
.c0{--dx:-5px;--dy:-6px}
.c1{--dx:-8px;--dy:-2px;animation-delay:-.12s}
.c2{--dx:-3px;--dy:-8px;animation-delay:-.25s}
.c3{--dx:-9px;--dy:-5px;animation-delay:-.38s}
`;

  // ---------- frame ----------
  const padX = 34; // room for the whole sprite at the side walls
  const padTop = ANCHOR_Y - CELL / 2 + 2;
  const padBottom = 6 + 6; // mower dips below the bottom row
  const minX = -padX;
  const minY = -padTop;
  const vbW = W + padX * 2;
  const vbH = H + padTop + padBottom;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${vbW} ${vbH}" width="${vbW}" height="${vbH}">` +
    `<title>A groundskeeper mowing ${user}'s contribution graph</title>` +
    `<style>${css}</style>` +
    ground +
    tall +
    `<g class="mover" shape-rendering="crispEdges">${facings}</g>` +
    `</svg>`
  );
}

const cells = await loadCalendar();
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "mower.svg"), build(cells, "light"));
await writeFile(join(outDir, "mower-dark.svg"), build(cells, "dark"));
console.log(`Wrote mower.svg and mower-dark.svg to ${outDir} (${cells.length} days)`);
