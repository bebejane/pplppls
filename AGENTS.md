# AGENTS.md

In-browser / Electron **DAW** built with React 16 + Create React App 3 (its README is stale boilerplate — `package.json` is the source of truth). No TypeScript; no passing tests.

## Commands

- **Package manager is pnpm.** `yarn.lock` was deleted and `node_modules` is pnpm-installed; `pnpm-lock.yaml`/`pnpm-workspace.yaml` are untracked but active. Use `pnpm install` / `pnpm add`. Never regenerate `yarn.lock`. (`pnpm-workspace.yaml` only whitelists postinstall build scripts like core-js/fsevents — leave it.)
- `pnpm dev` / `pnpm build` run through `react-app-rewired --openssl-legacy-provider`. The `--openssl-legacy-provider` flag is **required**: webpack 4 on Node ≥17 (pinned 24.x in `engines`) fails with `ERR_OSSL_EVP_UNSUPPORTED` without it. Keep it in the scripts.
- `pnpm test` currently **fails by design**: `src/App.test.js` is leftover CRA boilerplate that imports `./App` (the component moved to `src/components/App.js`) and looks for a "learn react" link that doesn't exist. Don't treat test output as a quality signal; fix the test file if you touch it.
- App needs real audio input at startup: `engine.init()` rejects without microphone permission, so verify manual changes in a real browser. `pnpm serve` serves the production build on :5000.

## Architecture

- Entry: `src/index.js` → `src/components/App.js` renders one of the apps under `src/components/apps/`. **`PurplePurples/` is the product**; the other app dirs (`Wave`, `Spyders`, `Smokey`, `PitchShifter`, `Effing`, `Bloody`, `InputTest`, `Test`, `Wave2`, `MultiMixer`) are experimental mini-apps shown on a splash screen only when `localStorage['lastApp']` is unset.
- The Web Audio engine lives in `src/services/AudioEngine/` (`index.js` is an `EventEmitter`). It is a singleton reachable via `import Global from '../Global'` → `Global.engine`; most apps construct it in their own constructor.
- **Workers:** `react-app-rewired.config.js` routes every file ending in `worker.js` through `worker-loader` (emitting `static/js/[id].worker.[hash].js`). Audio workers live at `src/services/AudioEngine/{encoders,meter,record}/worker.js`. Keep the `worker.js` suffix on any new worker or it breaks the bundle.
- **Effects:** each effect is a class in `src/services/AudioEngine/effects/`. Registering a new effect touches `effects/index.js` in **three** places: add a `defaults` entry to the `EFFECTS` array, `require` the class, and add a branch in `createEffect`.
- Files prefixed with `_` (`_Sound.js`, `_Sequencer.js`, `_Sequence.js`, `Wave/_index.js`, `temp/_old_stuff.js`) are archived, unimported dead code — leave them alone.
- Root-level `audio/`, `utils/`, `icons/` are gitignored, machine-local scratch dirs (project-file samples, Electron `.icns`), not part of the repo. Don't move their contents into `src/` or assume they exist on other machines.

## Electron

- `public/electron.js` is the shell (frameless window, loads :3000 in dev, `build/index.html` in production). `pnpm electron-dev` runs dev server + shell; `pnpm electron-pack` runs electron-builder (mac dir target, icon `icons/purples.icns`).