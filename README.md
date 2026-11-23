# JBL — Jojo's Blockgame Laboratory

A modern block stacker sprint built with React + Vite.

Live: **[jbl.umjo.me](https://jbl.umjo.me)**

## Credits & Inspiration

The attack and combo tables, the lock and garbage delays and the randomizer follow the rules **[Jstris](https://jstris.jezevec10.com/)** by [Jezevec10](https://github.com/Jezevec10) documents in its public [guide](https://github.com/jezevec10/jstris-guide). Huge thanks to Jstris and its community — this project would not exist without them.

JBL is an independent, non-affiliated project. It is not endorsed by or connected to Jstris or The Tetris Company. Core mechanics follow the publicly documented [SRS Guideline](https://tetris.wiki/Super_Rotation_System).

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # production build
```

## Deployment

Auto-deployed to GitHub Pages via [.github/workflows/deploy.yml](.github/workflows/deploy.yml) on every push to `main`.

## License

GPL-3.0 (see `LICENSE`). The rank card's foil effects are from
[pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css) by Simon
Goellner, GPL-3.0 (`src/holo/NOTICE.md`). The CPU engines keep their own
terms (`src/bots/NOTICE.md`).
