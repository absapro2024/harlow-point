# Harlow Point: Shift Work (Milestone 1 vertical slice)

## Install on iPhone (no Mac needed)
1. Open the game link in **Safari** on your iPhone.
2. Tap **Share**, then **Add to Home Screen**.
3. Launch it from the icon. It runs full-screen like an app and saves on the device. Turn the phone sideways for the best view.

The game is iOS only. Other devices see an "iOS only" screen. Developers can test on a desktop with `?dev=1` (WASD, mouse, Shift = run, E = interact, Esc = menu).

## Controls
Left side: drag to walk. Right side: drag to look. ✋ interact/talk. RUN toggles running (avoid it indoors). The top buttons open the Menu, Work Orders, Radio and Help.

## Docs
- `docs/DESIGN.md`: game design document, engine choice, gameplay loops, architecture, data model, roadmap, risk assessment, asset plan
- `docs/AI.md`: the coworker AI systems
- `docs/ASSETS.md`: placeholder asset register (all `PLACEHOLDER_ASSET`)

## Run locally
`python3 -m http.server` in this folder, then open `http://localhost:8000/?dev=1`.
