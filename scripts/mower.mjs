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
// The mower is pushed close in front of him, so it stays over the tile he mows.
const PERSON_TOP = ANCHOR_Y - 27;
const FRONT_MOWER = { x: 13, y: PERSON_TOP + 22 };
const BACK_MOWER = { x: 13, y: PERSON_TOP + 14 };
const SHORT_HANDLE = ["IJ", "IJ", "IJ", "IJ", "IJ", "IJ"];

function frontFrame(legs) {
  return compose([
    { art: HEAD_FRONT, x: 0, y: PERSON_TOP },
    { art: BODY_FRONT, x: 0, y: PERSON_TOP + 10 },
    { art: legs, x: 0, y: PERSON_TOP + 20 },
    { art: SHORT_HANDLE, x: 16, y: PERSON_TOP + 16 },
    { art: MOWER, ...FRONT_MOWER },
  ]);
}
function backFrame(legs) {
  return compose([
    { art: MOWER, ...BACK_MOWER },
    { art: HEAD_BACK, x: 0, y: PERSON_TOP },
    { art: BODY_BACK, x: 0, y: PERSON_TOP + 10 },
    { art: legs, x: 0, y: PERSON_TOP + 20 },
  ]);
}

// Where the mower's middle sits relative to his feet, for each view.
const mowerMid = (m) => [m.x + MOWER[0].length / 2 - ANCHOR_X, m.y + MOWER.length / 2 - ANCHOR_Y];
const FRONT_OFF = mowerMid(FRONT_MOWER);
const BACK_OFF = mowerMid(BACK_MOWER);

function view(frames, clipAt, color) {
  const clips = [0, 1, 2, 3]
    .map((i) => `<rect class="clip c${i}" x="${clipAt[0]}" y="${clipAt[1] - 3}" width="1.5" height="1.5" fill="${color}"/>`)
    .join("");
  return `<g class="legA">${pixels(frames[0])}</g><g class="legB">${pixels(frames[1])}</g>` + clips;
}

// ---------- layout and timing ----------

const CELL = 11;
const PITCH = 14;
const ROWS = 7;
const WALK_SPEED = 26; // px per second between tiles
const MOW_SPEED = 13; // px per second while mowing
const TURN_TIME = 0.35; // seconds to swing the mower round between passes
const PAUSE = 4; // seconds to admire the finished lawn
const REGROW = 1.5; // seconds for the grass to grow back

// Diagonal facings: which view draws them and where the mower sits.
const FACING = {
  SE: { view: "front", flip: 1, off: FRONT_OFF },
  SW: { view: "front", flip: -1, off: [-FRONT_OFF[0], FRONT_OFF[1]] },
  NE: { view: "back", flip: 1, off: BACK_OFF },
  NW: { view: "back", flip: -1, off: [-BACK_OFF[0], BACK_OFF[1]] },
};
const facingOf = (dx, dy, prev) => {
  if (Math.abs(dx) < 1e-6 || Math.abs(dy) < 1e-6) {
    // Straight moves never happen on purpose; keep the last facing.
    return prev;
  }
  return (dy > 0 ? "S" : "N") + (dx > 0 ? "E" : "W");
};

// Each tile is mowed in three diagonal passes, one per stripe.
// k is the stripe's offset across the tile (u - v in tile coordinates).
const STRIPES = [
  { k: -CELL * (2 / 3), dir: "SE" },
  { k: 0, dir: "NW" },
  { k: CELL * (2 / 3), dir: "SE" },
];
const OVERRUN = 2; // mower runs a little past the tile edge

function passEnds(k, dir) {
  // Ends of the line u - v = k inside the tile, plus a little overrun.
  const half = CELL / 2 - Math.abs(k) / 2 + OVERRUN;
  const a = [k / 2 - half, -k / 2 - half];
  const b = [k / 2 + half, -k / 2 + half];
  return dir === "SE" ? [a, b] : [b, a];
}

function build(cells, theme) {
  const t = THEMES[theme];
  const cols = Math.max(...cells.map((x) => x.c)) + 1;
  const W = cols * PITCH - (PITCH - CELL);
  const H = ROWS * PITCH - (PITCH - CELL);
  const centerOf = (cell) => [cell.c * PITCH + CELL / 2, cell.r * PITCH + CELL / 2];

  // ---------- route ----------
  // Visit grass tiles nearest-first, starting from the left.
  const grass = cells.filter((x) => x.level > 0);
  const tour = [];
  let here = [-40, H / 2];
  const left = new Set(grass);
  while (left.size) {
    let best = null;
    let bestD = Infinity;
    for (const g of left) {
      const [x, y] = centerOf(g);
      const d = Math.hypot(x - here[0], y - here[1]) + x * 0.05; // lean left-to-right
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    tour.push(best);
    left.delete(best);
    here = centerOf(best);
  }

  // Segments of the walk: {from, to, dur, face}.
  const segs = [];
  let pos = [-70, H / 2];
  let face = "SE";
  const go = (to, speed, forceFace) => {
    const dx = to[0] - pos[0];
    const dy = to[1] - pos[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    face = forceFace || facingOf(dx, dy, face);
    segs.push({ from: pos, to, dur: len / speed, face });
    pos = to;
  };
  const walkTo = (to) => {
    // Only diagonal moves: go diagonally, then zigzag the rest of the way.
    const dx = to[0] - pos[0];
    const dy = to[1] - pos[1];
    const sx = Math.sign(dx) || 1;
    const sy = Math.sign(dy) || 1;
    const d = Math.min(Math.abs(dx), Math.abs(dy));
    go([pos[0] + sx * d, pos[1] + sy * d], WALK_SPEED);
    const restX = to[0] - pos[0];
    const restY = to[1] - pos[1];
    const along = Math.abs(restX) > Math.abs(restY) ? "x" : "y";
    const rest = along === "x" ? restX : restY;
    if (Math.abs(rest) < 0.5) return;
    const n = 2 * Math.ceil(Math.abs(rest) / 16);
    const h = rest / n;
    const base = [...pos];
    for (let i = 1; i <= n; i++) {
      const wobble = i % 2 ? Math.abs(h) : 0;
      const side = sy; // zig towards the side we came from
      go(
        along === "x"
          ? [base[0] + h * i, base[1] + side * wobble]
          : [base[0] + side * wobble * sx, base[1] + h * i],
        WALK_SPEED,
      );
    }
  };

  const cutTimes = new Map(); // tile -> [time each stripe is cut]
  const clock = () => segs.reduce((s, x) => s + x.dur, 0);
  for (const tile of tour) {
    const [cx, cy] = centerOf(tile);
    const times = [];
    STRIPES.forEach(({ k, dir }, i) => {
      const off = FACING[dir].off;
      const [a, b] = passEnds(k, dir);
      const start = [cx + a[0] - off[0], cy + a[1] - off[1]];
      const end = [cx + b[0] - off[0], cy + b[1] - off[1]];
      if (i === 0) walkTo(start);
      else {
        // Swing round to line up the next pass.
        const dx = start[0] - pos[0];
        const dy = start[1] - pos[1];
        segs.push({ from: pos, to: start, dur: TURN_TIME, face: dir });
        pos = start;
        face = dir;
        void dx, dy;
      }
      const t0 = clock();
      go(end, MOW_SPEED, dir);
      times.push(t0 + (clock() - t0) / 2);
    });
    cutTimes.set(tile, times);
  }
  walkTo([W + 80, H / 2]);

  const walkEnd = clock();
  const total = walkEnd + PAUSE + REGROW + 0.5;
  const pct = (s) => ((s / total) * 100).toFixed(4) + "%";
  const px = (p) => `translate(${p[0].toFixed(2)}px,${p[1].toFixed(2)}px)`;

  let time = 0;
  const moveKf = [];
  const turns = [];
  for (const s of segs) {
    moveKf.push(`${pct(time)}{transform:${px(s.from)}}`);
    if (!turns.length || turns[turns.length - 1][1] !== s.face) turns.push([time, s.face]);
    time += s.dur;
  }
  moveKf.push(`${pct(time)}{transform:${px(pos)}}`, `100%{transform:${px(pos)}}`);
  const showKf = (name) =>
    turns.map(([s, n]) => `${pct(s)}{opacity:${n === name ? 1 : 0}}`).join("") + "100%{opacity:0}";

  // ---------- grass ----------
  const regrowStart = pct(walkEnd + PAUSE);
  const regrowEnd = pct(walkEnd + PAUSE + REGROW);
  const hideAt = (id, at) =>
    `@keyframes ${id}{0%,${pct(at)}{opacity:1}${pct(at + 0.15)},${regrowStart}{opacity:0}${regrowEnd},100%{opacity:1}}.${id}{animation:${id} ${total.toFixed(2)}s linear infinite}`;

  // Stripe bands across a tile, in tile coordinates (u right, v down).
  const bandEdges = [-CELL, -CELL / 3, CELL / 3, CELL];
  const band = (x, y, i) => {
    const [k1, k2] = [bandEdges[i], bandEdges[i + 1]];
    const L = 12;
    const p = [
      [k1 / 2 - L, -k1 / 2 - L],
      [k1 / 2 + L, -k1 / 2 + L],
      [k2 / 2 + L, -k2 / 2 + L],
      [k2 / 2 - L, -k2 / 2 - L],
    ];
    return p.map(([u, v]) => `${(x + u).toFixed(2)},${(y + v).toFixed(2)}`).join(" ");
  };
  // Blade spots for each band, so each pass clears its own blades.
  const BLADES = [
    [[-3.6, 3.4], [-1.2, 4.6]],
    [[-2.6, -1.4], [0.4, 0.8], [2.8, 3.2]],
    [[1.2, -3.6], [3.8, -2.0]],
  ];

  let css = "";
  let defs = "";
  let ground = "";
  let tall = "";
  for (const cell of cells) {
    const x = cell.c * PITCH;
    const y = cell.r * PITCH;
    const rect = `x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2"`;
    if (cell.level === 0) {
      ground += `<rect ${rect} fill="${t.levels[0]}"/>`;
      continue;
    }
    const [cx, cy] = [x + CELL / 2, y + CELL / 2];
    const clip = `t${cell.r}_${cell.c}`;
    defs += `<clipPath id="${clip}"><rect ${rect}/></clipPath>`;
    // Mown lines underneath: light, dark, light.
    ground += `<g clip-path="url(#${clip})">${[0, 1, 2]
      .map((i) => `<polygon points="${band(cx, cy, i)}" fill="${t.mowed[i % 2]}"/>`)
      .join("")}</g>`;
    const times = cutTimes.get(cell);
    const h = 2 + cell.level * 0.9; // taller blades for busier days
    [0, 1, 2].forEach((i) => {
      const id = `g${cell.r}_${cell.c}_${i}`;
      css += hideAt(id, times[i]);
      const blades = BLADES[i]
        .map(([u, v]) => {
          const bx = cx + u;
          const by = cy + v;
          return `M${(bx - 1.1).toFixed(2)} ${by.toFixed(2)}L${bx.toFixed(2)} ${(by - h).toFixed(2)}L${(bx + 1.1).toFixed(2)} ${by.toFixed(2)}Z`;
        })
        .join("");
      tall +=
        `<g class="${id}"><polygon clip-path="url(#${clip})" points="${band(cx, cy, i)}" fill="${t.levels[cell.level]}"/>` +
        `<path d="${blades}" fill="${t.blade[cell.level]}"/></g>`;
    });
  }

  // ---------- sprite ----------
  const front = view([frontFrame(LEGS[0]), frontFrame(LEGS[1])], FRONT_OFF, t.clip);
  const back = view([backFrame(LEGS[0]), backFrame(LEGS[1])], BACK_OFF, t.clip);
  const facings = Object.entries(FACING)
    .map(([name, f]) => `<g class="d${name}"><g transform="scale(${f.flip},1)">${f.view === "front" ? front : back}</g></g>`)
    .join("");

  const dur = `${total.toFixed(2)}s`;
  css += `
@keyframes move{${moveKf.join("")}}
.mover{animation:move ${dur} linear infinite}
${Object.keys(FACING)
  .map((n) => `@keyframes s${n}{${showKf(n)}}.d${n}{animation:s${n} ${dur} step-end infinite}`)
  .join("\n")}
@keyframes stepA{0%,49.9%{opacity:1}50%,100%{opacity:0}}
@keyframes stepB{0%,49.9%{opacity:0}50%,100%{opacity:1}}
.legA{animation:stepA .5s linear infinite}
.legB{animation:stepB .5s linear infinite}
@keyframes fly{0%{transform:translate(0,0);opacity:1}100%{transform:translate(var(--dx),var(--dy));opacity:0}}
.clip{animation:fly .6s ease-out infinite}
.c0{--dx:-5px;--dy:-6px}
.c1{--dx:-8px;--dy:-2px;animation-delay:-.15s}
.c2{--dx:-3px;--dy:-8px;animation-delay:-.3s}
.c3{--dx:-9px;--dy:-5px;animation-delay:-.45s}
`;

  // ---------- frame ----------
  const padX = 34; // room for the whole sprite at the side walls
  const padTop = ANCHOR_Y - CELL / 2 + 12;
  const padBottom = 12;
  const vbW = W + padX * 2;
  const vbH = H + padTop + padBottom;

  return {
    seconds: total,
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padX} ${-padTop} ${vbW} ${vbH}" width="${vbW}" height="${vbH}">` +
      `<title>A groundskeeper mowing ${user}'s contribution graph</title>` +
      `<defs>${defs}</defs><style>${css}</style>` +
      ground +
      tall +
      `<g class="mover" shape-rendering="crispEdges">${facings}</g>` +
      `</svg>`,
  };
}

const cells = await loadCalendar();
await mkdir(outDir, { recursive: true });
const light = build(cells, "light");
await writeFile(join(outDir, "mower.svg"), light.svg);
await writeFile(join(outDir, "mower-dark.svg"), build(cells, "dark").svg);
console.log(
  `Wrote mower.svg and mower-dark.svg to ${outDir} (${cells.length} days, ${Math.round(light.seconds)}s loop)`,
);
