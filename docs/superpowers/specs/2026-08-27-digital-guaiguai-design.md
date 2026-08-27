# Digital GuaiGuai — Design Spec

**Date:** 2026-08-27  
**Status:** Approved  
**Repo:** Digital-GuaiGuai

## Summary

A cross-platform (macOS + Windows) desktop pet based on the Taiwanese **乖乖 (Kuai Kuai)** corn snack — specifically the green **造句包 (sentence-making pack)**. The pet sits on the bottom of the screen as a quiet companion with pixel art animations, drag-and-gravity physics, and a backstage stopwatch accessible via click menu.

## Background & Cultural Context

In Taiwanese/HK IT and backstage culture, a green 乖乖 bag placed on servers, audio consoles, or lighting desks symbolizes smooth operation — **「綠色金順」** (green color, golden smooth). The virtual 乖乖 extends this tradition: a always-on-top companion that keeps things running smoothly, with a practical stopwatch for backstage timing.

**Reference:** Green 乖乖 造句包 packaging — lime green bag, mascot boy, traffic light (green on), white 造句 text box with red 乖乖 characters.

## Goals (v1)

1. Pixel art 乖乖 desktop pet — idle companion on screen bottom
2. Drag to reposition; release to fall with gravity to screen bottom
3. Click (no drag) → stopwatch menu (start / pause / reset)
4. Stopwatch elapsed time displayed in the 造句区-style white box
5. System tray/menu bar backup controls
6. macOS + Windows from a single Tauri codebase

## Non-Goals (v1)

| Feature | Target |
|---------|--------|
| Audio console integration (OSC/MIDI) | v2 |
| Lighting console integration (MA2/ETC) | v2 |
| Linux support | v2 |
| Countdown / Pomodoro timers | v2 |
| Feeding / tamagotchi game loop | Out of scope |
| Sound effects | v2 optional |
| Multiple pets | v2 |
| Stopwatch state persistence across restarts | v2 (v1 resets on quit) |

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Tauri Shell (Rust)                     │
│  ├─ Transparent frameless window        │
│  ├─ Always-on-top                       │
│  ├─ System tray (menu bar / taskbar)    │
│  └─ IPC commands (stopwatch, settings)  │
└──────────────┬──────────────────────────┘
               │ invoke / events
┌──────────────▼──────────────────────────┐
│  Frontend (HTML + Canvas)               │
│  ├─ Sprite renderer (pixel art)         │
│  ├─ Physics loop (drag + gravity)       │
│  ├─ State machine (idle / fall / menu)  │
│  └─ Stopwatch UI (click menu)           │
└─────────────────────────────────────────┘
```

**Core approach:**
- One transparent window sized to the sprite (~96×128 px to fit bag + mascot)
- Window follows pet position; moves with cursor during drag
- Rust handles OS-level concerns (tray, launch-at-startup, future plugins)
- Canvas handles animation, physics, and interaction
- v1 does not connect to audio/lighting consoles; Rust reserves a `Plugin` trait for v2

**Project structure:**
```
digital-guaiguai/
├── src-tauri/          # Rust: window, tray, IPC
├── src/
│   ├── canvas/         # renderer, sprites, physics
│   ├── pet/            # state machine, animations
│   ├── stopwatch/      # timer logic + menu UI
│   └── main.ts
└── assets/sprites/     # pixel art sheets
```

---

## Visual Design — 乖乖 Character

**Representation:** Hybrid (Option C) — whole green snack bag as main body, mascot boy visible on the bag.

### Sprite composition (~96×128 px canvas)

| Layer | Element | Notes |
|-------|---------|-------|
| Background | Lime green bag shape | Rounded rectangle, `#7EC850` approximate |
| Mid | Mascot boy | Blue hair/hat, buck teeth, orange shirt, yellow bow tie — simplified pixel form |
| Accent | Traffic light | Black pole, **green light on** (idle); amber flash optional v2 |
| UI area | White 造句 box | Bottom third of bag; displays stopwatch `HH:MM:SS` when running |
| Text | Red 乖乖 | Centered in white box when stopwatch idle |

### Color palette (approximate)

| Color | Hex | Usage |
|-------|-----|-------|
| Bag green | `#6DBF4A` | Main bag body |
| Bag green dark | `#4A9E2E` | Shading, bottom banner |
| Mascot blue | `#3B7FD9` | Hair/hat |
| Mascot orange | `#F07830` | Shirt |
| Bow yellow | `#F0C030` | Bow tie |
| 乖乖 red | `#D03030` | 乖乖 characters |
| White box | `#F8F8F8` | 造句 area |
| Traffic green | `#30D030` | Green light (on) |
| Gold text | `#D0A030` | 綠色金順 banner (optional detail) |

### Animation frames (v1 minimum)

| Animation | Frames | FPS | Trigger |
|-----------|--------|-----|---------|
| Idle | 4 | 2 | Default — subtle bag sway, traffic light glow pulse |
| Drag | 1 | — | Mouse dragging — bag tilted slightly |
| Fall | 3 | 8 | Gravity fall — squash on land |
| Focus | 2 | 2 | Stopwatch running — mascot still, green light steady |
| Blink | 2 | — | Random every ~30s — mascot eyes close (optional v1) |

### Stopwatch display in 造句区

When stopwatch is **running** or **paused**, the white box shows elapsed time instead of 乖乖 text:

```
┌──────────────┐
│  ⏱ 00:12:34  │  ← monospace pixel font in white box
│  [▶][↺]      │  ← Start/Pause + Reset (click menu)
└──────────────┘
     🟢 traffic light
```

When stopwatch is **stopped and menu closed**, white box shows red 乖乖 characters (default idle).

---

## Pet Behavior

### State machine

```
        ┌──────┐
        │ Idle │◄────────────────┐
        └──┬───┘                 │
           │ click (no drag)     │ landed
           ▼                     │
      ┌─────────┐    release    ┌──────┐
      │ MenuOpen│               │ Fall │
      └─────────┘               └──┬───┘
                                   ▲
           drag start              │
      ┌──────┐ ────────────────────┘
      │ Drag │
      └──────┘
```

| State | Behavior |
|-------|----------|
| **Idle** | Sits on screen bottom, idle animation loop |
| **Drag** | Follows cursor; window repositions in real time |
| **Fall** | Gravity applied on release; lands on screen bottom |
| **MenuOpen** | Click without drag opens stopwatch menu |

### Click vs drag detection

- Mouse down → up with movement **< 5px** → **click** (open menu)
- Movement **≥ 5px** → **drag** (no menu)

### Gravity physics

- On release: `vy += gravity` (0.8 px/frame²), `y += vy`
- Land on screen bottom minus taskbar/dock height (queried per OS)
- Short bounce animation (1–2 frames) on land → return to Idle

### Multi-monitor (v1)

- Falls to bottom of the **monitor where the window currently is**
- Cross-monitor walking deferred to v2

---

## Stopwatch

### Menu UI

Click 乖乖 → pixel-style menu appears above sprite:

```
┌─────────────────┐
│  ⏱ 00:00:00     │
│  [Start] [Reset]│
└─────────────────┘
      🟢 乖乖 bag
```

| Control | Action |
|---------|--------|
| **Start / Pause** | Toggle stopwatch |
| **Reset** | Zero elapsed; menu stays open |

- Menu rendered on Canvas (consistent pixel art style)
- Click outside menu → close menu, return to Idle
- Stopwatch continues running when menu is closed

### Data model

```typescript
interface Stopwatch {
  elapsedMs: number
  running: boolean
  startedAt: number | null  // Date.now() when started
}
```

- Update display via `requestAnimationFrame` or `setInterval(100ms)`
- Format: `HH:MM:SS`

### Pet reaction when running

- Stopwatch **running** → play Focus idle variant (mascot still, green light steady)
- **Paused / stopped** → return to normal Idle animation

---

## Platform & Window Management

### Tauri window config

```json
{
  "transparent": true,
  "decorations": false,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "width": 96,
  "height": 128
}
```

### macOS vs Windows

| Behavior | macOS | Windows |
|----------|-------|---------|
| Dock / taskbar height | Query `visibleFrame` | Query work area API |
| Tray | Menu bar tray icon | System tray icon |
| Non-sprite mouse events | Ignored (click-through transparent areas) | Same |

### System tray menu

```
🟢 Digital GuaiGuai
├── Show / Hide
├── Stopwatch: 00:12:34 (running)
│   ├── Pause
│   └── Reset
├── Launch at startup  ☐
└── Quit
```

- v1 tray is read-only mirror of stopwatch state
- Launch at startup: optional, default off

### Persistence (v1 minimal)

```json
{ "x": 1200, "y": 800, "monitorId": "..." }
```

- App restart → pet returns to last position (or falls to monitor bottom)
- Stopwatch state does **not** persist (restart = reset)

---

## v2 Plugin Interface (stub only in v1)

```rust
// src-tauri/src/plugins/mod.rs
pub trait BackstagePlugin {
    fn name(&self) -> &str;
    fn on_tick(&mut self, elapsed: Duration);
    fn send_command(&self, cmd: &str) -> Result<()>;
}
```

- v1: define trait + empty registry only
- v2: implement `AudioConsolePlugin` (OSC/MIDI), `LightingConsolePlugin` (MA net/ETC)

---

## Testing

| Layer | What to test |
|-------|--------------|
| **Unit** | Stopwatch logic (start/pause/reset/elapsed calculation) |
| **Unit** | Click vs drag detection (< 5px threshold) |
| **Unit** | Gravity physics (land at bottom, bounce) |
| **Manual** | macOS + Windows: transparent window, tray, drag/fall |
| **Manual** | Multi-monitor: correct monitor bottom landing |

- No E2E automation in v1 (desktop window hard to automate)
- CI: run unit tests; Mac/Win builds via manual release

---

## Success Criteria (v1 done)

1. macOS + Windows both run; 乖乖 sits on screen bottom idling
2. Drag + gravity fall feels smooth
3. Click → stopwatch menu; start/pause/reset work correctly
4. Elapsed time shows in 造句区 white box when running
5. Tray icon reflects stopwatch state
6. Quit + reopen remembers position

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Shell | Tauri 2.x (Rust) |
| Frontend | TypeScript + HTML Canvas |
| Sprite format | PNG sprite sheets |
| Build targets | macOS (.app), Windows (.exe) |

---

## Open Questions

1. **Custom 造句 message** — should users be able to write a custom message in the white box (like the real pack)? Deferred to v2.
2. **Sprite art source** — v1 uses placeholder pixel art; replace with final art when available.
3. **Audio/lighting console protocols** — research needed for v2 (OSC, MIDI, MA-Net, sACN).
