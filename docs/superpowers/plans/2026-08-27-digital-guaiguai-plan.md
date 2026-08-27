# Digital GuaiGuai — Implementation Plan

**Date:** 2026-08-27  
**Spec:** `docs/superpowers/specs/2026-08-27-digital-guaiguai-design.md`  
**Status:** Ready to implement

---

## Overview

Build a Tauri 2 desktop app with a transparent always-on-top window rendering a pixel art 乖乖 snack bag. The pet idles on screen bottom, supports drag + gravity fall, and exposes a click-activated stopwatch menu. macOS + Windows targets.

**Implementation order:** scaffold → window → canvas/sprites → physics → stopwatch → tray → persistence → tests → build

---

## Phase 1 — Project Scaffold

### Task 1.1: Initialize Tauri 2 project

**Files to create:**
- `package.json` — Vite + TypeScript frontend
- `src-tauri/Cargo.toml` — Tauri 2 dependencies
- `src-tauri/tauri.conf.json` — window + tray config
- `src/main.ts` — entry point
- `index.html` — canvas mount point
- `vite.config.ts`

**Commands:**
```bash
npm create tauri-app@latest . -- --template vanilla-ts
# Or manual scaffold if interactive fails in CI
```

**tauri.conf.json window defaults:**
```json
{
  "width": 96,
  "height": 128,
  "transparent": true,
  "decorations": false,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "resizable": false
}
```

**Acceptance:** `npm run tauri dev` opens a transparent frameless window on Linux dev environment (or macOS/Windows).

---

### Task 1.2: Project directory structure

```
src/
├── main.ts
├── canvas/
│   ├── renderer.ts       # Canvas draw loop
│   └── sprite-sheet.ts   # Frame loading + draw
├── pet/
│   ├── state-machine.ts  # Idle | Drag | Fall | MenuOpen
│   └── physics.ts        # Gravity + landing
├── stopwatch/
│   ├── timer.ts          # elapsedMs logic
│   └── menu.ts           # Menu UI render + hit test
└── input/
    └── pointer.ts        # Click vs drag detection

src-tauri/src/
├── main.rs
├── tray.rs               # System tray menu
├── window.rs             # Position, monitor queries
├── persistence.rs        # Save/load position JSON
└── plugins/
    └── mod.rs            # BackstagePlugin trait stub

assets/sprites/
├── guaiguai-idle.png     # 4-frame sheet (placeholder)
├── guaiguai-drag.png
├── guaiguai-fall.png
└── guaiguai-focus.png
```

**Acceptance:** All modules import without error; empty stubs compile.

---

## Phase 2 — Transparent Window & Positioning

### Task 2.1: Rust window helpers

**File:** `src-tauri/src/window.rs`

Implement:
- `get_work_area_bottom(monitor)` — screen bottom minus dock/taskbar
- `set_window_position(x, y)` — Tauri window API
- `get_current_monitor()` — monitor where window is

**macOS:** Use `objc` / Tauri monitor API for `visibleFrame`.  
**Windows:** Use `GetMonitorInfo` work area via `windows` crate or Tauri monitor helpers.

**Acceptance:** Window can be programmatically placed at bottom-center of primary monitor.

---

### Task 2.2: IPC commands

**File:** `src-tauri/src/main.rs`

| Command | Args | Returns |
|---------|------|---------|
| `get_screen_bottom` | — | `{ bottomY, monitorId }` |
| `set_pet_position` | `{ x, y }` | — |
| `get_pet_position` | — | `{ x, y, monitorId }` |
| `save_position` | `{ x, y, monitorId }` | — |
| `load_position` | — | `{ x, y, monitorId } \| null` |

**Acceptance:** Frontend can query screen bottom and move window via IPC.

---

## Phase 3 — Canvas & Placeholder Sprites

### Task 3.1: Canvas renderer

**File:** `src/canvas/renderer.ts`

- Full-window `<canvas>` at 96×128, `imageRendering: pixelated`
- `requestAnimationFrame` game loop
- Clear with transparent background each frame
- Draw current sprite frame at (0, 0)

**Acceptance:** Canvas renders in transparent window; no white background bleed.

---

### Task 3.2: Placeholder pixel art

**File:** `assets/sprites/` (create programmatically or hand-drawn PNG)

v1 placeholder — simple colored rectangles matching spec palette:
- Green bag rect `#6DBF4A`
- White 造句 box bottom third
- Red pixel text 「乖乖」 (or bitmap font)
- Green circle = traffic light
- Blue/orange pixels = simplified mascot

**Sprite sheet format:** Horizontal strip, frame width = 96px.

**Acceptance:** Idle animation cycles 4 frames at 2 fps.

---

### Task 3.3: Sprite sheet loader

**File:** `src/canvas/sprite-sheet.ts`

```typescript
class SpriteSheet {
  constructor(image: HTMLImageElement, frameWidth: number, frameCount: number)
  drawFrame(ctx: CanvasRenderingContext2D, frameIndex: number, x: number, y: number): void
}
```

**Acceptance:** Loads PNG, draws correct frame by index.

---

## Phase 4 — Pet State Machine & Physics

### Task 4.1: State machine

**File:** `src/pet/state-machine.ts`

```typescript
type PetState = 'idle' | 'drag' | 'fall' | 'menuOpen'

class PetStateMachine {
  state: PetState
  transition(event: PetEvent): void
  getCurrentAnimation(): string
}
```

Events: `DRAG_START`, `DRAG_END`, `CLICK`, `LANDED`, `MENU_CLOSE`, `TICK`

**Acceptance:** State transitions match design spec diagram; unit tests pass.

---

### Task 4.2: Pointer input (click vs drag)

**File:** `src/input/pointer.ts`

- Track `mousedown` position
- On `mouseup`: if distance < 5px → emit `click`, else if was dragging → emit `dragEnd`
- On `mousemove` while down: if distance ≥ 5px → emit `dragStart`, update drag position

During drag: call Tauri `set_pet_position` with cursor coords (offset by sprite anchor).

**Acceptance:** Click opens menu; drag moves window; no menu on drag release.

---

### Task 4.3: Gravity physics

**File:** `src/pet/physics.ts`

```typescript
interface PhysicsState {
  y: number
  vy: number
  groundY: number
}

function tickFall(state: PhysicsState, gravity = 0.8): 'falling' | 'landed'
```

- On `dragEnd`: set `vy = 0`, enter fall state
- Each frame: `vy += gravity`, `y += vy`
- When `y >= groundY`: snap to ground, trigger bounce (vy = -3 for 1 frame), emit `LANDED`
- `groundY` from IPC `get_screen_bottom` minus sprite height

**Acceptance:** Pet falls to screen bottom with visible bounce; unit tests for land detection.

---

## Phase 5 — Stopwatch

### Task 5.1: Timer logic

**File:** `src/stopwatch/timer.ts`

```typescript
class Stopwatch {
  elapsedMs: number
  running: boolean
  private startedAt: number | null

  start(): void
  pause(): void
  reset(): void
  tick(now: number): void  // called each frame when running
  format(): string         // "HH:MM:SS"
}
```

**Unit tests:** `tests/stopwatch.test.ts`
- Start → wait → pause → elapsed correct
- Reset → zero
- Start after pause → accumulates

**Acceptance:** All stopwatch unit tests pass.

---

### Task 5.2: Menu UI

**File:** `src/stopwatch/menu.ts`

- Render pixel-style menu above sprite when `menuOpen`
- Buttons: Start/Pause, Reset — drawn on canvas with hit regions
- Click outside menu (transparent canvas area) → close menu
- Menu shows formatted elapsed time

**Acceptance:** Click pet → menu appears; buttons toggle stopwatch; click outside closes.

---

### Task 5.3: 造句区 display integration

**File:** `src/canvas/renderer.ts` (extend)

When stopwatch running or paused with elapsed > 0:
- Draw `HH:MM:SS` in white box area (monospace pixel font)
- Use Focus animation sprite

When idle + menu closed + stopwatch at zero:
- Draw red 「乖乖」 in white box

**Acceptance:** Timer visible on bag body; matches spec mockup behavior.

---

## Phase 6 — System Tray

### Task 6.1: Tray icon + menu

**File:** `src-tauri/src/tray.rs`

Use Tauri 2 `tray-icon` feature:
- Icon: simplified green 乖乖 (16×16 PNG)
- Menu items: Show/Hide, Stopwatch status, Pause, Reset, Launch at startup, Quit

**Events:** Emit Tauri events to frontend for pause/reset; frontend emits state back for tray label update.

**Acceptance:** Tray shows elapsed time when running; pause/reset work from tray.

---

### Task 6.2: Launch at startup (optional toggle)

**File:** `src-tauri/src/main.rs`

- macOS: `tauri-plugin-autostart` or login item API
- Windows: Registry Run key or autostart plugin
- Default: off

**Acceptance:** Toggle in tray persists preference; app relaunches on login when enabled.

---

## Phase 7 — Persistence

### Task 7.1: Save/load position

**File:** `src-tauri/src/persistence.rs`

Store at `{app_config_dir}/position.json`:
```json
{ "x": 1200, "y": 800, "monitorId": "..." }
```

- Save on drag end + land
- Load on startup → place window; if invalid monitor, fall to primary bottom

**Acceptance:** Quit + reopen restores last landed position.

---

## Phase 8 — v2 Plugin Stub

### Task 8.1: BackstagePlugin trait

**File:** `src-tauri/src/plugins/mod.rs`

```rust
pub trait BackstagePlugin: Send + Sync {
    fn name(&self) -> &str;
    fn on_tick(&mut self, elapsed: std::time::Duration);
    fn send_command(&self, cmd: &str) -> Result<(), String>;
}

pub struct PluginRegistry {
    plugins: Vec<Box<dyn BackstagePlugin>>,
}
```

Empty registry in v1; no implementations.

**Acceptance:** Compiles; no runtime effect.

---

## Phase 9 — Testing & QA

### Unit tests (Vitest)

| File | Tests |
|------|-------|
| `tests/stopwatch.test.ts` | start/pause/reset/format |
| `tests/pointer.test.ts` | click vs drag threshold |
| `tests/physics.test.ts` | gravity, land, bounce |

```bash
npm test
```

### Manual QA checklist

- [ ] macOS: transparent window, no white flash
- [ ] macOS: drag + fall to dock-adjusted bottom
- [ ] macOS: menu bar tray works
- [ ] Windows: same as above with taskbar
- [ ] Multi-monitor: fall to correct monitor bottom
- [ ] Stopwatch accurate over 5+ minutes
- [ ] Position persists across restart

---

## Phase 10 — Build & Release

### Task 10.1: CI (GitHub Actions)

**File:** `.github/workflows/build.yml`

- Trigger: push to main, PR
- Jobs: `test` (unit tests), `build-macos`, `build-windows`
- Use `tauri-apps/tauri-action`

### Task 10.2: README update

Document:
- What Digital GuaiGuai is (green 乖乖 backstage companion)
- Build/run instructions
- macOS + Windows download links (when released)

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@tauri-apps/api` ^2 | Frontend IPC |
| `@tauri-apps/cli` ^2 | Build tooling |
| `tauri` ^2 | Rust shell |
| `tauri-plugin-autostart` | Launch at startup |
| `vitest` | Unit tests |
| `typescript` | Frontend |
| `vite` | Bundler |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Transparent window white flash on Windows | Set `#00000000` background; test early on Win |
| Click-through not working on macOS | Use Tauri `set_ignore_cursor_events` for transparent pixels |
| Dock height wrong on macOS multi-monitor | Query per-monitor visible frame, not global |
| Placeholder art looks bad | Ship placeholder; swap sprites without code changes |
| Linux dev ≠ macOS/Win behavior | Manual QA on both targets before v1 release |

---

## Definition of Done

All items from spec Success Criteria:

1. ✅ macOS + Windows run; 乖乖 idles on screen bottom
2. ✅ Drag + gravity fall smooth
3. ✅ Click → stopwatch menu; start/pause/reset work
4. ✅ Elapsed time in 造句区 when running
5. ✅ Tray reflects stopwatch state
6. ✅ Position persists across restart

---

## Next Step

Start **Phase 1, Task 1.1** — scaffold Tauri 2 project on branch `cursor/digital-guaiguai-impl-0960`.
