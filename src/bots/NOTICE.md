# Bots

Battle CPUs other than Stacker run third-party bots compiled to WebAssembly.

## Cold Clear — `cc/`

- Source: https://github.com/MinusKelvin/cold-clear (MinusKelvin), licensed under the Mozilla Public License 2.0.
- `cc/jbl_cc_bg.wasm` and `cc/jbl_cc.js` are built from an unmodified Cold Clear plus a small wrapper crate (`jbl-cc`, MPL-2.0) that exposes one synchronous call, `cc_move`. The wrapper source is in `src/` (`jbl_cc_lib.rs`, `jbl_cc_Cargo.toml`).
- MPL-2.0 text: https://www.mozilla.org/MPL/2.0/

## MisaMino — `misa.js`

- Source: https://github.com/misakamm/MisaMino (misakamm), via the command-line port https://github.com/jezevec10/MisaMinoBot (jezevec10).
- The upstream LICENSE reads only "Copyleft by Misakamm"; no formal licence text is given. It is used here with credit, unmodified apart from a wrapper (`src/jbl_misa.cpp`) that exposes one call, `misa_move`, and turns its mirrored moves into screen directions.

`engines.js` loads the two modules, `worker.js` runs them off the main thread, `play.js` reads the board and plays the moves, and `player.js` is the Battle CPU.
