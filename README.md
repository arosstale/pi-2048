# pi-2048

The classic 2048 sliding tile puzzle for [pi coding agent](https://github.com/nicobailon/pi-mono).

## Install

```bash
npm i -g pi-2048
```

Add to `~/.pi/agent/settings.json`:
```json
{ "packages": ["npm:pi-2048"] }
```

## Play

```
/2048
```

## Controls

| Key | Action |
|-----|--------|
| ←↑↓→ / WASD / HJKL | Slide tiles |
| U | Undo last move |
| T | Cycle color theme |
| R | Restart |
| Q / Esc | Quit |

## Themes

Classic, Neon, Ocean, Ember, Grayscale, Sakura

## Features

- 4×4 grid with proper merge rules
- High score persistence (~/.pi/2048/save.json)
- 1-level undo
- 6 color themes
- Box-drawing borders with full 24-bit color
