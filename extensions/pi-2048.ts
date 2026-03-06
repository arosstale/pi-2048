/**
 * pi-2048 — The classic 2048 sliding tile puzzle for pi
 *
 * Slide numbered tiles on a 4×4 grid. When two tiles with the same number
 * touch, they merge into one! Reach the 2048 tile to win.
 *
 * Controls: Arrow keys / WASD / HJKL (vim)
 * R = restart, Q/Esc = quit
 *
 * 6 color themes, high score persistence, undo support
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import { TUI } from "@mariozechner/pi-tui";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ── Types ──────────────────────────────────────────────────────────────────
type Grid = number[][];
interface GameState {
  grid: Grid;
  score: number;
  best: number;
  won: boolean;
  lost: boolean;
  theme: number;
  prev: { grid: Grid; score: number } | null; // undo
}

// ── Themes ─────────────────────────────────────────────────────────────────
const THEMES: { name: string; bg: string; empty: string; tiles: Record<number, { fg: string; bg: string }> }[] = [
  {
    name: "Classic",
    bg: "\x1b[48;2;187;173;160m", empty: "\x1b[48;2;205;193;180m",
    tiles: {
      2:    { fg: "\x1b[38;2;119;110;101m", bg: "\x1b[48;2;238;228;218m" },
      4:    { fg: "\x1b[38;2;119;110;101m", bg: "\x1b[48;2;237;224;200m" },
      8:    { fg: "\x1b[38;2;249;246;242m", bg: "\x1b[48;2;242;177;121m" },
      16:   { fg: "\x1b[38;2;249;246;242m", bg: "\x1b[48;2;245;149;99m" },
      32:   { fg: "\x1b[38;2;249;246;242m", bg: "\x1b[48;2;246;124;95m" },
      64:   { fg: "\x1b[38;2;249;246;242m", bg: "\x1b[48;2;246;94;59m" },
      128:  { fg: "\x1b[38;2;249;246;242m", bg: "\x1b[48;2;237;207;114m" },
      256:  { fg: "\x1b[38;2;249;246;242m", bg: "\x1b[48;2;237;204;97m" },
      512:  { fg: "\x1b[38;2;249;246;242m", bg: "\x1b[48;2;237;200;80m" },
      1024: { fg: "\x1b[38;2;249;246;242m", bg: "\x1b[48;2;237;197;63m" },
      2048: { fg: "\x1b[38;2;249;246;242m", bg: "\x1b[48;2;237;194;46m" },
    },
  },
  {
    name: "Neon",
    bg: "\x1b[48;2;20;20;30m", empty: "\x1b[48;2;35;35;50m",
    tiles: {
      2:    { fg: "\x1b[38;2;0;255;255m",   bg: "\x1b[48;2;30;50;50m" },
      4:    { fg: "\x1b[38;2;0;255;200m",   bg: "\x1b[48;2;30;55;45m" },
      8:    { fg: "\x1b[38;2;255;0;255m",   bg: "\x1b[48;2;55;20;55m" },
      16:   { fg: "\x1b[38;2;255;100;255m", bg: "\x1b[48;2;60;25;60m" },
      32:   { fg: "\x1b[38;2;255;255;0m",   bg: "\x1b[48;2;55;55;20m" },
      64:   { fg: "\x1b[38;2;255;150;0m",   bg: "\x1b[48;2;60;40;15m" },
      128:  { fg: "\x1b[38;2;0;255;100m",   bg: "\x1b[48;2;20;55;30m" },
      256:  { fg: "\x1b[38;2;100;255;255m", bg: "\x1b[48;2;25;55;55m" },
      512:  { fg: "\x1b[38;2;255;50;50m",   bg: "\x1b[48;2;55;20;20m" },
      1024: { fg: "\x1b[38;2;255;200;50m",  bg: "\x1b[48;2;55;45;15m" },
      2048: { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;80;0;120m" },
    },
  },
  {
    name: "Ocean",
    bg: "\x1b[48;2;15;25;50m", empty: "\x1b[48;2;25;40;70m",
    tiles: {
      2:    { fg: "\x1b[38;2;200;220;255m", bg: "\x1b[48;2;40;80;120m" },
      4:    { fg: "\x1b[38;2;200;230;255m", bg: "\x1b[48;2;50;90;140m" },
      8:    { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;30;100;160m" },
      16:   { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;20;110;180m" },
      32:   { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;10;120;200m" },
      64:   { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;0;80;180m" },
      128:  { fg: "\x1b[38;2;255;255;200m", bg: "\x1b[48;2;0;140;160m" },
      256:  { fg: "\x1b[38;2;255;255;200m", bg: "\x1b[48;2;0;160;140m" },
      512:  { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;0;170;120m" },
      1024: { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;0;180;100m" },
      2048: { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;0;200;200m" },
    },
  },
  {
    name: "Ember",
    bg: "\x1b[48;2;30;15;10m", empty: "\x1b[48;2;50;25;15m",
    tiles: {
      2:    { fg: "\x1b[38;2;255;200;150m", bg: "\x1b[48;2;80;40;20m" },
      4:    { fg: "\x1b[38;2;255;190;130m", bg: "\x1b[48;2;100;50;20m" },
      8:    { fg: "\x1b[38;2;255;255;200m", bg: "\x1b[48;2;160;60;10m" },
      16:   { fg: "\x1b[38;2;255;255;200m", bg: "\x1b[48;2;190;70;10m" },
      32:   { fg: "\x1b[38;2;255;255;220m", bg: "\x1b[48;2;210;80;10m" },
      64:   { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;230;50;10m" },
      128:  { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;240;150;30m" },
      256:  { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;245;170;20m" },
      512:  { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;250;190;10m" },
      1024: { fg: "\x1b[38;2;60;20;5m",     bg: "\x1b[48;2;255;210;50m" },
      2048: { fg: "\x1b[38;2;30;10;5m",     bg: "\x1b[48;2;255;230;100m" },
    },
  },
  {
    name: "Grayscale",
    bg: "\x1b[48;2;40;40;40m", empty: "\x1b[48;2;60;60;60m",
    tiles: {
      2:    { fg: "\x1b[38;2;30;30;30m",    bg: "\x1b[48;2;200;200;200m" },
      4:    { fg: "\x1b[38;2;30;30;30m",    bg: "\x1b[48;2;185;185;185m" },
      8:    { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;130;130;130m" },
      16:   { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;115;115;115m" },
      32:   { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;100;100;100m" },
      64:   { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;85;85;85m" },
      128:  { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;70;70;70m" },
      256:  { fg: "\x1b[38;2;255;200;50m",  bg: "\x1b[48;2;55;55;55m" },
      512:  { fg: "\x1b[38;2;255;150;50m",  bg: "\x1b[48;2;45;45;45m" },
      1024: { fg: "\x1b[38;2;255;100;50m",  bg: "\x1b[48;2;35;35;35m" },
      2048: { fg: "\x1b[38;2;255;255;0m",   bg: "\x1b[48;2;20;20;20m" },
    },
  },
  {
    name: "Sakura",
    bg: "\x1b[48;2;50;30;40m", empty: "\x1b[48;2;70;45;55m",
    tiles: {
      2:    { fg: "\x1b[38;2;80;40;50m",    bg: "\x1b[48;2;255;220;230m" },
      4:    { fg: "\x1b[38;2;80;40;50m",    bg: "\x1b[48;2;255;200;215m" },
      8:    { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;230;130;160m" },
      16:   { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;220;100;140m" },
      32:   { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;210;80;120m" },
      64:   { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;200;50;100m" },
      128:  { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;180;80;150m" },
      256:  { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;160;60;140m" },
      512:  { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;140;40;130m" },
      1024: { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;120;20;120m" },
      2048: { fg: "\x1b[38;2;255;200;230m", bg: "\x1b[48;2;100;0;100m" },
    },
  },
];

// ── Save/Load ──────────────────────────────────────────────────────────────
const SAVE_DIR = join(homedir(), ".pi", "2048");
const SAVE_FILE = join(SAVE_DIR, "save.json");

function loadBest(): number {
  try {
    if (existsSync(SAVE_FILE)) return JSON.parse(readFileSync(SAVE_FILE, "utf-8")).best || 0;
  } catch {}
  return 0;
}
function saveBest(best: number) {
  try { mkdirSync(SAVE_DIR, { recursive: true }); writeFileSync(SAVE_FILE, JSON.stringify({ best })); } catch {}
}

// ── Grid Logic ─────────────────────────────────────────────────────────────
function emptyGrid(): Grid { return Array.from({ length: 4 }, () => [0, 0, 0, 0]); }
function cloneGrid(g: Grid): Grid { return g.map(r => [...r]); }

function addRandom(g: Grid): boolean {
  const empty: [number, number][] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (g[r][c] === 0) empty.push([r, c]);
  if (empty.length === 0) return false;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  g[r][c] = Math.random() < 0.9 ? 2 : 4;
  return true;
}

function slideRow(row: number[]): { result: number[]; score: number; moved: boolean } {
  // Remove zeros, merge, pad
  const filtered = row.filter(v => v !== 0);
  let score = 0;
  const merged: number[] = [];
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i] * 2;
      merged.push(val);
      score += val;
      i += 2;
    } else {
      merged.push(filtered[i]);
      i++;
    }
  }
  while (merged.length < 4) merged.push(0);
  const moved = row.some((v, idx) => v !== merged[idx]);
  return { result: merged, score, moved };
}

function move(g: Grid, dir: "left" | "right" | "up" | "down"): { grid: Grid; score: number; moved: boolean } {
  const ng = cloneGrid(g);
  let totalScore = 0;
  let moved = false;

  if (dir === "left") {
    for (let r = 0; r < 4; r++) {
      const { result, score, moved: m } = slideRow(ng[r]);
      ng[r] = result; totalScore += score; if (m) moved = true;
    }
  } else if (dir === "right") {
    for (let r = 0; r < 4; r++) {
      const { result, score, moved: m } = slideRow([...ng[r]].reverse());
      ng[r] = result.reverse(); totalScore += score; if (m) moved = true;
    }
  } else if (dir === "up") {
    for (let c = 0; c < 4; c++) {
      const col = [ng[0][c], ng[1][c], ng[2][c], ng[3][c]];
      const { result, score, moved: m } = slideRow(col);
      for (let r = 0; r < 4; r++) ng[r][c] = result[r];
      totalScore += score; if (m) moved = true;
    }
  } else {
    for (let c = 0; c < 4; c++) {
      const col = [ng[3][c], ng[2][c], ng[1][c], ng[0][c]];
      const { result, score, moved: m } = slideRow(col);
      for (let r = 0; r < 4; r++) ng[3 - r][c] = result[r];
      totalScore += score; if (m) moved = true;
    }
  }
  return { grid: ng, score: totalScore, moved };
}

function canMove(g: Grid): boolean {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    if (g[r][c] === 0) return true;
    if (c < 3 && g[r][c] === g[r][c + 1]) return true;
    if (r < 3 && g[r][c] === g[r + 1][c]) return true;
  }
  return false;
}

function hasWon(g: Grid): boolean {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (g[r][c] >= 2048) return true;
  return false;
}

// ── Render ─────────────────────────────────────────────────────────────────
const RST = "\x1b[0m";
const BOLD = "\x1b[1m";
const CELL_W = 8; // chars per cell
const PAD = "  ";

function renderTile(val: number, theme: typeof THEMES[0]): string {
  if (val === 0) return `${theme.empty}${" ".repeat(CELL_W)}${RST}`;
  const t = theme.tiles[val] || theme.tiles[2048] || { fg: "\x1b[38;2;255;255;255m", bg: "\x1b[48;2;60;60;60m" };
  const s = String(val);
  const pad = CELL_W - s.length;
  const left = Math.floor(pad / 2), right = pad - left;
  return `${t.bg}${t.fg}${BOLD}${" ".repeat(left)}${s}${" ".repeat(right)}${RST}`;
}

function renderGame(s: GameState, w: number, h: number): string[] {
  const theme = THEMES[s.theme % THEMES.length];
  const lines: string[] = [];
  const boardW = CELL_W * 4 + 5; // 4 cells + 5 borders

  // Center offset
  const padX = Math.max(0, Math.floor((w - boardW) / 2));
  const indent = " ".repeat(padX);

  // Header
  lines.push("");
  lines.push(`${indent}${BOLD}\x1b[38;2;237;194;46m  2 0 4 8${RST}  ${BOLD}Theme: ${theme.name}${RST} (T to cycle)`);
  lines.push(`${indent}  Score: ${BOLD}${s.score}${RST}  Best: ${BOLD}${s.best}${RST}`);
  lines.push("");

  // Board border
  const hBorder = `${theme.bg} ${"─".repeat(CELL_W)} `.repeat(4) + ` ${RST}`;
  lines.push(`${indent}${theme.bg}${"┌" + "─".repeat(CELL_W) + "┬"}${"─".repeat(CELL_W) + "┬"}${"─".repeat(CELL_W) + "┬"}${"─".repeat(CELL_W)}┐${RST}`);

  for (let r = 0; r < 4; r++) {
    // Cell row (3 lines tall: padding, number, padding)
    const topPad = `${indent}${theme.bg}│${RST}` + s.grid[r].map(v => {
      if (v === 0) return `${theme.empty}${" ".repeat(CELL_W)}${RST}`;
      const t = theme.tiles[v] || theme.tiles[2048] || { fg: "", bg: "\x1b[48;2;60;60;60m" };
      return `${t.bg}${" ".repeat(CELL_W)}${RST}`;
    }).join(`${theme.bg}│${RST}`) + `${theme.bg}│${RST}`;
    lines.push(topPad);

    const numRow = `${indent}${theme.bg}│${RST}` + s.grid[r].map(v => renderTile(v, theme)).join(`${theme.bg}│${RST}`) + `${theme.bg}│${RST}`;
    lines.push(numRow);

    lines.push(topPad); // bottom padding same as top

    if (r < 3) {
      lines.push(`${indent}${theme.bg}${"├" + "─".repeat(CELL_W) + "┼"}${"─".repeat(CELL_W) + "┼"}${"─".repeat(CELL_W) + "┼"}${"─".repeat(CELL_W)}┤${RST}`);
    }
  }
  lines.push(`${indent}${theme.bg}${"└" + "─".repeat(CELL_W) + "┴"}${"─".repeat(CELL_W) + "┴"}${"─".repeat(CELL_W) + "┴"}${"─".repeat(CELL_W)}┘${RST}`);
  lines.push("");

  // Status
  if (s.won) {
    lines.push(`${indent}  ${BOLD}\x1b[38;2;237;194;46m🎉 YOU WIN! 🎉${RST}  Keep playing or R to restart`);
  } else if (s.lost) {
    lines.push(`${indent}  ${BOLD}\x1b[38;2;220;50;50mGAME OVER${RST}  Press R to restart`);
  } else {
    lines.push(`${indent}  Use arrow keys, WASD, or HJKL to move tiles`);
  }
  lines.push("");

  // Help bar
  const helpBorder = "─".repeat(Math.min(boardW, 60));
  lines.push(`${indent}${theme.bg} ${helpBorder} ${RST}`);
  lines.push(`${indent}  ${BOLD}Controls:${RST} ←↑↓→/WASD/HJKL=Move  U=Undo  T=Theme  R=Restart  Q=Quit`);
  lines.push("");
  return lines;
}

// ── TUI Component ──────────────────────────────────────────────────────────
function create2048Component(state: GameState): Component {
  return {
    render(w: number, h: number) { return renderGame(state, w, h); },
    handleInput(key: string) {
      // Direction
      let dir: "left" | "right" | "up" | "down" | null = null;
      if (key === "left" || key === "a" || key === "h") dir = "left";
      else if (key === "right" || key === "d" || key === "l") dir = "right";
      else if (key === "up" || key === "w" || key === "k") dir = "up";
      else if (key === "down" || key === "s" || key === "j") dir = "down";

      if (dir && !state.lost) {
        const { grid, score, moved } = move(state.grid, dir);
        if (moved) {
          state.prev = { grid: cloneGrid(state.grid), score: state.score };
          state.grid = grid;
          state.score += score;
          if (state.score > state.best) { state.best = state.score; saveBest(state.best); }
          addRandom(state.grid);
          if (hasWon(state.grid)) state.won = true;
          if (!canMove(state.grid)) state.lost = true;
        }
        return true;
      }
      if (key === "u" && state.prev) {
        state.grid = state.prev.grid;
        state.score = state.prev.score;
        state.prev = null;
        state.won = hasWon(state.grid);
        state.lost = false;
        return true;
      }
      if (key === "r" || key === "R") {
        state.grid = emptyGrid();
        addRandom(state.grid); addRandom(state.grid);
        state.score = 0; state.won = false; state.lost = false; state.prev = null;
        return true;
      }
      if (key === "t" || key === "T") {
        state.theme = (state.theme + 1) % THEMES.length;
        return true;
      }
      if (key === "q" || key === "escape") return "exit";
      return false;
    },
  };
}

// ── Extension ──────────────────────────────────────────────────────────────
export default function (api: ExtensionAPI) {
  api.registerCommand({
    name: "2048",
    description: "Play 2048 — slide tiles, merge numbers, reach 2048!",
    parameters: {},
    execute: async (ctx) => {
      const state: GameState = {
        grid: emptyGrid(),
        score: 0,
        best: loadBest(),
        won: false,
        lost: false,
        theme: 0,
        prev: null,
      };
      addRandom(state.grid); addRandom(state.grid);

      const tui = new TUI(ctx as any, { fullscreen: true });
      tui.mount(create2048Component(state));
      await tui.run();
      tui.unmount();

      ctx.ui.setStatus(`2048: Score ${state.score} | Best ${state.best}`);
      return `Game over! Score: ${state.score} | Best: ${state.best}`;
    },
  });
}
