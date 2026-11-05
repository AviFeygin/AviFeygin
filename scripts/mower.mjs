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
    mowed: ["#d4ebb6", "#c4e09f"],
    clip: "#5fae3c",
  },
  dark: {
    levels: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
    blade: ["", "#17603a", "#0b8a43", "#3cc45a", "#6af07c"],
    mowed: ["#5a8541", "#4f783a"],
    clip: "#6cc04a",
  },
};

// ---------- the groundskeeper ----------
// Original pixel art in a small isometric style: three tones per material and
// dark outlines. Two views, each mirrored, give four facings. Each view is built
// from layers so the mower can sit in front of him or behind him.

const PALETTE = {
  X: "#1e1a18", // outline
  T: "#ffd2a6", // skin light
  S: "#eaa96f", // skin
  s: "#c27f4c", // skin shade
  E: "#1d140c", // eye
  h: "#5a3a26", // hair
  H: "#3b2416", // hair shade
  F: "#ff7a6b", // shirt light
  G: "#d8352c", // shirt
  g: "#8f1d18", // shirt shade
  P: "#565b68", // trousers light
  O: "#383d49", // trousers
  o: "#22262e", // trousers shade
  B: "#4a3a33", // boots
  b: "#2a201c", // boots shade
  I: "#b0b0b0", // handle light
  J: "#5e5e5e", // handle shade
  R: "#d3e0d6", // mower light
  M: "#a6baac", // mower
  m: "#6e8577", // mower shade
  W: "#eef4ef", // engine cover
  w: "#bccbc0", // engine shade
  K: "#151515", // tyre
};

// A small figure, about 18 pixels tall, like a park worker seen from above.
const HEAD_FRONT = [
  "...XXXX...",
  "..XhhhhX..",
  "..XhTTTSX.",
  "..XhTTETX.",
  "..XHTTTsX.",
  "...XXssX..",
];
const HEAD_BACK = [
  "...XXXX...",
  "..XhhhhX..",
  "..XhhhhhX.",
  "..XhhhhSX.",
  "..XHhhhsX.",
  "...XXssX..",
];
const BODY_FRONT = [
  "..XFGGGX...",
  ".XFFGGGgX..",
  ".XFGGGGgSX.",
  ".XFgGGGXTSX",
  ".XggGGgX.X.",
  "..XOOOOoX..",
  "..XPOOOoX..",
];
const BODY_BACK = [
  "..XFGGGX...",
  ".XFFGGGgX..",
  ".XFGgGGgSX.",
  ".XFgGgGgSX.",
  ".XggGgGgX..",
  "..XOOOOoX..",
  "..XPOOOoX..",
];
const LEGS = [
  [
    "..XPoXOoX..",
    ".XPoX.XOoX.",
    ".XPoX.XOoX.",
    ".XbBX..XbBX",
    "..XX....XX.",
  ],
  [
    "..XPOOOoX..",
    "...XPOoX...",
    "...XPOoX...",
    "...XbBBX...",
    "....XXX....",
  ],
];
const MOWER = [
  ".XXXXXX.",
  "XRRWWRMX",
  "XRMwwMmX",
  "XMMMMMmX",
  ".XKXXKX.",
  "..X..X..",
];

// Feet sit here on the canvas.
const ANCHOR_X = 5;
const ANCHOR_Y = 24;

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
const SPRITE_H = HEAD_FRONT.length + BODY_FRONT.length + LEGS[0].length - 1;
const PERSON_TOP = ANCHOR_Y - SPRITE_H;
const BODY_TOP = PERSON_TOP + HEAD_FRONT.length;
const LEGS_TOP = BODY_TOP + BODY_FRONT.length;
const FRONT_MOWER = { x: 7, y: PERSON_TOP + 14 };
const BACK_MOWER = { x: 7, y: PERSON_TOP + 9 };
const SHORT_HANDLE = ["IJ", "IJ", "IJ", "IJ"];

// Walking between tiles he puts the mower away, arms at his sides.
const BODY_FRONT_WALK = [
  "..XFGGGX..",
  ".XFFGGGgX.",
  "XFFGGGGggX",
  "XFgGGGGggX",
  "XSgGGGGgSX",
  "XXXOOOOoXX",
  "..XPOOOoX.",
];
const BODY_BACK_WALK = [
  "..XFGGGX..",
  ".XFFGGGgX.",
  "XFFGgGGggX",
  "XFgGgGGggX",
  "XSgGgGGgSX",
  "XXXOOOOoXX",
  "..XPOOOoX.",
];

function frontFrame(legs, mowing) {
  if (!mowing) {
    return compose([
      { art: HEAD_FRONT, x: 0, y: PERSON_TOP },
      { art: BODY_FRONT_WALK, x: 0, y: BODY_TOP },
      { art: legs, x: 0, y: LEGS_TOP },
    ]);
  }
  return compose([
    { art: HEAD_FRONT, x: 0, y: PERSON_TOP },
    { art: BODY_FRONT, x: 0, y: BODY_TOP },
    { art: legs, x: 0, y: LEGS_TOP },
    { art: SHORT_HANDLE, x: 9, y: BODY_TOP + 4 },
    { art: MOWER, ...FRONT_MOWER },
  ]);
}
function backFrame(legs, mowing) {
  if (!mowing) {
    return compose([
      { art: HEAD_BACK, x: 0, y: PERSON_TOP },
      { art: BODY_BACK_WALK, x: 0, y: BODY_TOP },
      { art: legs, x: 0, y: LEGS_TOP },
    ]);
  }
  return compose([
    { art: MOWER, ...BACK_MOWER },
    { art: HEAD_BACK, x: 0, y: PERSON_TOP },
    { art: BODY_BACK, x: 0, y: BODY_TOP },
    { art: legs, x: 0, y: LEGS_TOP },
  ]);
}

// Where the mower's middle sits relative to his feet, for each view.
const mowerMid = (m) => [m.x + MOWER[0].length / 2 - ANCHOR_X, m.y + MOWER.length / 2 - ANCHOR_Y];
const FRONT_OFF = mowerMid(FRONT_MOWER);
const BACK_OFF = mowerMid(BACK_MOWER);

function view(frame, clipAt, color) {
  // Two versions of each view: mowing (mower out, clippings flying) and walking.
  const clips = [0, 1, 2, 3]
    .map((i) => `<rect class="clip c${i}" x="${clipAt[0]}" y="${clipAt[1] - 3}" width="1.5" height="1.5" fill="${color}"/>`)
    .join("");
  const steps = (mowing) =>
    `<g class="legA">${pixels(frame(LEGS[0], mowing))}</g><g class="legB">${pixels(frame(LEGS[1], mowing))}</g>`;
  return `<g class="mw">${steps(true)}${clips}</g><g class="wk">${steps(false)}</g>`;
}

// ---------- layout and timing ----------

const WEEKS = 26; // show the last six months so the squares can be big
const CELL = 24;
const PITCH = 28;
const ROWS = 7;
const WALK_SPEED = 26; // px per second between tiles
const MOW_SPEED = 13; // px per second while mowing
const TURN_TIME = 0.35; // seconds to swing the mower round between passes
const MOWER_OUT = 0.5; // seconds to get the mower out or put it away
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
const OVERRUN = 3; // mower runs a little past the tile edge

function passEnds(k, dir) {
  // Ends of the line u - v = k inside the tile, plus a little overrun.
  const half = CELL / 2 - Math.abs(k) / 2 + OVERRUN;
  const a = [k / 2 - half, -k / 2 - half];
  const b = [k / 2 + half, -k / 2 + half];
  return dir === "SE" ? [a, b] : [b, a];
}

function build(cells, theme) {
  const t = THEMES[theme];
  // Keep only the most recent WEEKS columns.
  const lastCol = Math.max(...cells.map((x) => x.c));
  const firstCol = Math.max(0, lastCol - WEEKS + 1);
  cells = cells.filter((x) => x.c >= firstCol).map((x) => ({ ...x, c: x.c - firstCol }));
  const cols = lastCol - firstCol + 1;
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

  // Segments of the walk: {from, to, dur, face, mow}.
  const segs = [];
  let pos = [-70, H / 2];
  let face = "SE";
  const go = (to, speed, forceFace, mow = false) => {
    const dx = to[0] - pos[0];
    const dy = to[1] - pos[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    face = forceFace || facingOf(dx, dy, face);
    segs.push({ from: pos, to, dur: len / speed, face, mow });
    pos = to;
  };
  const stand = (dur, mow, faceTo = face) => {
    face = faceTo;
    segs.push({ from: pos, to: pos, dur, face, mow });
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
      if (i === 0) {
        walkTo(start);
        stand(MOWER_OUT, true, dir); // get the mower out
      } else {
        // Swing round to line up the next pass.
        segs.push({ from: pos, to: start, dur: TURN_TIME, face: dir, mow: true });
        pos = start;
        face = dir;
      }
      const t0 = clock();
      go(end, MOW_SPEED, dir, true);
      times.push(t0 + (clock() - t0) / 2);
    });
    stand(MOWER_OUT, false); // put it away before walking on
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
  const modes = [];
  for (const s of segs) {
    moveKf.push(`${pct(time)}{transform:${px(s.from)}}`);
    if (!turns.length || turns[turns.length - 1][1] !== s.face) turns.push([time, s.face]);
    if (!modes.length || modes[modes.length - 1][1] !== s.mow) modes.push([time, s.mow]);
    time += s.dur;
  }
  const modeKf = (on) =>
    modes.map(([s, m]) => `${pct(s)}{opacity:${m === on ? 1 : 0}}`).join("") + `100%{opacity:${on ? 0 : 1}}`;
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
    const L = CELL;
    const p = [
      [k1 / 2 - L, -k1 / 2 - L],
      [k1 / 2 + L, -k1 / 2 + L],
      [k2 / 2 + L, -k2 / 2 + L],
      [k2 / 2 - L, -k2 / 2 - L],
    ];
    return p.map(([u, v]) => `${(x + u).toFixed(2)},${(y + v).toFixed(2)}`).join(" ");
  };
  // Tufts of long grass scattered over each band, so each pass clears its own.
  // A small seeded random keeps the same tile looking the same every day.
  const rng = (seed) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const tuftsFor = (cell, i) => {
    const rand = rng(cell.c * 131 + cell.r * 17 + i * 7 + 1);
    const [k1, k2] = [bandEdges[i] + 1.5, bandEdges[i + 1] - 1.5];
    const want = (i === 1 ? 3 : 2) + Math.ceil(cell.level / 2);
    const out = [];
    for (let tries = 0; out.length < want && tries < 200; tries++) {
      const u = (rand() - 0.5) * CELL * 0.8;
      const v = (rand() - 0.5) * CELL * 0.8 + 2;
      if (u - v >= k1 && u - v <= k2) out.push([u, v, rand()]);
    }
    return out;
  };
  const speck = theme === "dark" ? "#a6d98f" : "#f3f8df";

  let css = "";
  let defs = "";
  let ground = "";
  let tall = "";
  for (const cell of cells) {
    const x = cell.c * PITCH;
    const y = cell.r * PITCH;
    const rect = `x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="4"`;
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
    const h = 2.5 + cell.level * 1.2; // longer grass on busier days
    const f = (n) => n.toFixed(2);
    [0, 1, 2].forEach((i) => {
      const id = `g${cell.r}_${cell.c}_${i}`;
      css += hideAt(id, times[i]);
      let blades = "";
      let specks = "";
      for (const [u, v, r] of tuftsFor(cell, i)) {
        const bx = cx + u;
        const by = cy + v;
        const th = h * (0.75 + r * 0.5);
        // A tuft: three blades fanning out.
        blades +=
          `M${f(bx - 1)} ${f(by)}L${f(bx)} ${f(by - th)}L${f(bx + 1)} ${f(by)}Z` +
          `M${f(bx - 2)} ${f(by)}L${f(bx - 3)} ${f(by - th * 0.7)}L${f(bx - 0.5)} ${f(by)}Z` +
          `M${f(bx + 0.5)} ${f(by)}L${f(bx + 3)} ${f(by - th * 0.7)}L${f(bx + 2)} ${f(by)}Z`;
        if (r > 0.6) specks += `<rect x="${f(bx + 3)}" y="${f(by - 1)}" width="1.2" height="1.2"/>`;
      }
      tall +=
        `<g class="${id}"><polygon clip-path="url(#${clip})" points="${band(cx, cy, i)}" fill="${t.levels[cell.level]}"/>` +
        `<path d="${blades}" fill="${t.blade[cell.level]}"/><g fill="${speck}">${specks}</g></g>`;
    });
  }

  // ---------- sprite ----------
  const front = view(frontFrame, FRONT_OFF, t.clip);
  const back = view(backFrame, BACK_OFF, t.clip);
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
@keyframes mw{${modeKf(true)}}.mw{animation:mw ${dur} step-end infinite}
@keyframes wk{${modeKf(false)}}.wk{animation:wk ${dur} step-end infinite}
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
  const padX = 20; // room for the whole sprite at the side walls
  const padTop = Math.max(SPRITE_H - CELL / 2, 0) + 10;
  const padBottom = 10;
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
