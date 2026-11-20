# JBL — Jojo's Blockgame Laboratory

React + Vite block stacker (SRS, 7-bag) with Sprint, Battle, Opening, Finesse and Settings.
It deploys to GitHub Pages at https://jbl.umjo.me: every push to `main` runs `.github/workflows/deploy.yml`.

## Layout

- `src/game.js` is the engine (`BlockEngine`). It has two hooks used by practice modes: `sequence` (a fixed piece order) and `validatePlacement` (rejects a lock).
- `src/render.js` draws to canvas. `src/ui.jsx` has the shared components: `Segmented`, `Stat`, `Countdown`, `Kbd`, `KeyHints`.
- `src/styles.css` holds all styling.
- `src/openings.js` holds the opener data, transcribed from four.lol, plus the mirror function. `src/finesse.js` computes optimal inputs.
- Keys come from `src/keys.js`. Bindings use `e.code`, so the 한/영 toggle never matters.

## Animation

Every animation must be **interruptible, staggered, and optimistic**:

- **Interruptible.** Use CSS transitions for state changes so a new state can take over mid-flight. Never block input or wait for an animation to finish before acting. Never chain timers that a new action can't cancel.
- **Staggered.** When several things appear together (menu items, option rows, buttons), they arrive one after another with a short offset (about 30–40 ms). They never pop in as one block.
- **Optimistic.** The UI moves to the new state immediately (selection, navigation, results). Animation decorates the change after it has already happened. Nothing waits for an exit animation or a network round trip.

Keep motion light (≈150–350 ms, ease-out `var(--out)`, small distances). Respect `prefers-reduced-motion`. Never animate anything that would shift the play area during a game, and never animate the countdown words: they switch instantly.

## UI rules

- Title starts at a fixed top. The settings block sits directly under it (top aligned, never centred), so switching tabs or options never moves controls already on screen. Actions (buttons + key hints) are anchored to the bottom. Areas whose content varies (e.g. opener previews) get a fixed size.
- Buttons that sit together are the same size. Key hints sit a fixed gap below the buttons.
- Key hints appear only in game: in the side column (Battle: under the boards). Never on setup screens, Settings, the board or result overlays.
- Uppercase for title-like text and key commands. Descriptions stay in sentence case. Keep type small and spacing generous.
- Restart is always F.
- Key caps and segmented controls are flat: solid fill, no stroke.
