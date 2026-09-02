# Digital GuaiGuai

A cross-platform desktop pet based on the Taiwanese green **乖乖 (Kuai Kuai)** snack bag — the IT/backstage charm for smooth operation (**綠色金順**).

Pixel art 乖乖 sits on your screen bottom, idles quietly, and includes a backstage stopwatch in the 造句区.

## Features (v1)

- Always-on-top transparent pixel art 乖乖 companion
- Drag to move; release to fall with gravity to screen bottom
- Click → stopwatch menu (start / pause / reset)
- System tray controls (macOS menu bar / Windows taskbar)
- Position persists across restarts
- **Click-through** — mouse passes through transparent areas; only the pet/menu captures clicks (toggle in tray)

## Requirements

- Node.js 18+
- Rust 1.88+
- Platform deps for [Tauri 2](https://v2.tauri.app/start/prerequisites/)

### Linux dev deps

```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

## Development

```bash
npm install
npm run generate-sprites   # optional — placeholder PNGs included
npm test
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

Outputs: macOS `.app` / Windows `.exe` in `src-tauri/target/release/bundle/`.

## Docs

- Design spec: `docs/superpowers/specs/2026-08-27-digital-guaiguai-design.md`
- Implementation plan: `docs/superpowers/plans/2026-08-27-digital-guaiguai-plan.md`

## License

MIT
