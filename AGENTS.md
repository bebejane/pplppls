# AGENTS.md

**PurplePurples** — an in-browser **DAW** (Web Audio sampler/sequencer/mixer) built with **Next.js 16.3 (App Router) + TypeScript + SCSS Modules**, migrated from an old Create React App build (original source archived in `legacy/`).

No test runner is wired up (the old CRA `App.test.js` was deleted). The app is browser-only and hard to exercise headlessly (needs microphone permission), so verify behavior in a real browser.

## Commands

- **pnpm** is the package manager. Use `pnpm install` / `pnpm add`. `pnpm-workspace.yaml` declares the single workspace package (`packages: ['.']`, required — pnpm 9 errors with "packages field missing or empty" without it) and whitelists postinstall build scripts (core-js/fsevents/@parcel/watcher/unrs-resolver) via `allowBuilds`, which pnpm ≥11 understands. `package.json` pins `"packageManager": "pnpm@12.3.4"` so Vercel/corepack runs the same pnpm as local.
- `pnpm dev` → dev server (:3000). `pnpm build` → production build (Turbopack; runs `tsc` internally). `pnpm start` → serve build.
- **Verification gates: `pnpm typecheck` (`tsc --noEmit`), `pnpm lint` (flat ESLint, 0 errors), `pnpm build`.** Run all three; the engine is excluded from lint but included in typecheck via `lib/audio/types.ts`.
- `npm`/`yarn` should not be used (no `yarn.lock`).
- Boot flow: open the app → click `PURPLE` → grant mic → "PURPLES" → grid loads. If mic is denied you get the error overlay; `engine.init()` rejects without permission.

## Architecture

### App layer
- Single route: `app/layout.tsx` (metadata, imports `styles/globals.scss`) → `app/page.tsx` → `components/studio/Studio.tsx` (`'use client'`).
- **`Studio` builds the engine lazily in a `useEffect`** (`new AudioEngine(...)` on the `Global` singleton), never during render/SSR — the engine creates an `AudioContext` and touches `window`. It renders `null` until the engine exists.
- `components/purplepurples/PurplePurples.tsx` is the product (the "grid" DAW: a grid of Columns, each a looping sampler cell). Split from one giant class into:
  - hooks: `useEngineListeners.ts` (engine events → state), `useKeyboardShortcuts.ts` (global keys via a mutable handlers ref)
  - `Column.tsx` (+ `ColumnTools`, `ColumnRecord`), `Controls.tsx` (+ `MasterFader`), `Home.tsx` (intro/canvas), dialogs (`Save/New/Help/Recordings`), `NotSupported`, overlays; shared UI in `components/util/` (`Select`, `FileUploader`, `Waveform`), canvases in `components/visualizers/`.
  - `types.ts` re-exports the engine model shapes (`Model`/`ModelFile`/`Preset`/`SoundSettings` from `lib/audio/model-types`) plus grid types (`ColState`/`MoveData`).

### Engine — `lib/audio/` (fully TypeScript)
Everything under `lib/audio/` is `.ts`. The ported DSP keeps its behavior; `lib/audio` is excluded from ESLint, and the files marked `// @ts-nocheck` (Sound, AudioEngine, Analyser, Recorder, Master, the WebAudio-heavy effects, `encoders/mp3.ts`, paulstretch/timestretcher/stretch, `record/worklet.ts`) are intentionally type-unchecked so `tsc` stays green — treat them as **"keep behavior intact"** and don't remove the `@ts-nocheck`.

- **Singleton**: `import Global from '@/lib/Global'` → `Global.engine` (also `Global.bpm`, `Global.fileToMimeType`). Components never construct an engine.
- **Key refactors (behavior-preserving, don't regress):**
  - `master` transport state lives in `Master.ts`; `AudioEngine` keeps `this.master = new Master(this)`.
  - Effect classes share `createEffectBase` (constructor defaults/param merge, runs at the **end** of each constructor because setters touch nodes) and an id→class registry in `effects/index.ts`; shared primitives (`baseEffect`, `Utils`, `createEffectBase`) live in `effects/core.ts` — **no circular imports** between effects and index.
  - **All effects run as AudioWorklets** (were per-effect native node graphs). `effects/workletSource.ts` exports `EFFECTS_WORKLET_SOURCE`, a self-contained source string registering 16 processors (`pp-delay`, `pp-dubdelay`, `pp-flanger`, `pp-tremolo`, `pp-distortion`, `pp-compressor`, `pp-reverb`, `pp-convolver`, `pp-pingpongdelay`, `pp-quadrafuzz`, `pp-stereopanner`, `pp-stonephaser`, `pp-ringmodulator`, `pp-lowpassfilter`, `pp-highpassfilter`, `pp-pitchshift`). `effects/worklet.ts` → `ensureEffectsWorklet(context)` registers the module once per AudioContext via a Blob URL (like the recorder) and `createWorkletEffectNode()` builds the node. Each effect class in `effects/*.ts` is now a thin adapter: `inputNode = outputNode = node`, setters write to `this.node.parameters.get(name)` keeping the same `setTargetAtTime`/ramp smoothing and `defaults`/`baseEffect` contract `Sound` relies on. `createEffect`/`AudioEngine.addEffect` are **async** (they await the worklet module); the engine preloads it in the `AudioEngine` constructor. The DSP has an offline regression test: `tests/verify-effects.mjs` (Node imports the `.ts` worklet source directly) drives every processor with real signals. Beware: the module string is a TS template literal — **no backticks or `${` may appear inside it**.
  - Transport methods use `soundForEach(id, fn)` instead of duplicated `if (id) … else forEach`.
  - **Models & presets live in the engine** (`lib/audio/model.ts`, `ModelManager`, instantiated as `this.modelManager` and delegated to by `AudioEngine`). It owns all model I/O — fetch/parse/save/download `.purple.zip`, destroy + repopulate sounds and their effects, and the per-model preset slots. Engine surface: `models`/`model`/`presets` getters, `loadModels`, `loadModel`, `loadModelFromFile`, `createModel`, `saveModel`, `downloadModel`, `downloadSound`, `download`, `savePreset`, `restorePreset`, `randomizePreset(index?)`, `hasPreset`, `clearPresets`; events `models`/`model`/`presets`/`notification`. React only builds grid state from the returned model (no JSZip/axios/sound internals in `PurplePurples.tsx`).
  - **Preset slots are key-addressed, not a FIFO**: `presets` is always `PRESET_SLOTS` (10) long, index 0 = key `1` … index 9 = key `0`, `null` = empty. Nothing is generated up front — pressing a number key (or a `PresetBar` button) calls `hasPreset`/`restorePreset`, and when the slot is empty it calls `randomizePreset(idx)` to create *and* play one, so the next press of that key replays the same settings. `randomizePreset()` with no index (the `b` key) writes the first empty slot, and only plays live when all 10 are taken (it no longer evicts the oldest). The key→slot mapping lives in `PresetBar.tsx` (`PRESET_KEYS`/`keyToSlot`) and is shared with `PurplePurples.tsx`. Loading a model whose `presets[]` has any filled slot reveals the bar.
  - `lib/audio/types.ts` is the typed `AudioEngine` facade components import through `Global.engine`. **Do not remove interface members the app calls — `tsc` will fail.**
  - Gained smoothing (anti-zipper-noise, must stay): `Sound.mute()` ramps a unified gain to `0` via `setTargetAtTime` — **it never disconnects/reconnects the audio graph** (previously it did, causing clicks/cuts while moving over the grid). `volume`/`gain`/`pan` also converge via `setTargetAtTime`; effect dry/wet `mix` gains use `setTargetAtTime`.
  - **Loop-boundary anti-click fades**: `Sound.ts` inserts a dedicated `fadeNode` (`node → fadeNode → panner`) and a look-ahead scheduler schedules ~6ms fades to silence at each loop wrap (and at loopStart on play). It re-anchors on `loop()`/`rate()` changes and cleans up on stop/pause/destroy. Don't remove fadeNode from `_connectChain`/`_disconnectChain`.
- **Workers** (`lib/audio/workers.ts`): standard ESM module workers via `new Worker(new URL('./encoders/worker', import.meta.url), { type: 'module' })`. The three worker files (`encoders`, `meter`, `record`) are `.ts`; `encoders/mp3.ts`/`wav.ts` are imported *by* workers, so keep them free of `require()`/bare `postMessage`.
- **Recorder uses an AudioWorkletNode**, but `record/worklet.ts` exports the processor as a **source string** loaded through a Blob URL (`audioWorklet.addModule` requires a JS MIME; raw `.ts` assets fail MIME checks). Don't switch back to `new URL('./worklet', import.meta.url)` or `createScriptProcessor`.
- Removed during the slimming (don't reintroduce): `utils/{copy,fill}.ts`, `Sequencer.js`/`Sequencer2.js` and the `waaclock` dep (unused by the app), `Sound.getState()`, `createGainNode()` polyfills, `kali.min.js`.

## Interactivity gotchas (hard-won — read before touching)

- **`Column` treats live sound state as engine-authoritative.** Live fields (`volume`, `rate`, `playing`, `locked`, …) arrive via `Global.engine` `'state'<id>` events; the Column prop-sync helper **explicitly skips `locked`** so a stale parent prop can't clobber it. Lock/unlock from UI always goes through `Global.engine.lock(id, on)` — never mutate parent `cols` directly.
- **`data-sound-point`** attribute: `PurplePurples.initModel` maps columns via `document.querySelectorAll('[data-sound-point]')` (module-hashed class names broke the old literal-class query — keep using the attribute).
- Mouse-move over a column drives per-move audio writes (volume/pan/rate/delay/mute). This is now *smooth* (fades are engine-side); `Column.onModify` only sends `rate()` when the 0.1-step value changes. Keep writes quantized/throttled — don't reintroduce per-move graph rewiring.
- **Waveform (`components/util/Waveform.tsx`)** — nothing is queried by CSS class from JS:
  - Canvas draws use the canvas backing store directly (`measure()` sets `canvas.width/height`), a `ResizeObserver` handles fullscreen sizing (a `window.resize` listener alone misses it), and the elapsed overlay is driven through `setTargetAtTime`-style updates.
  - Selection: drag to select a loop; on release the selection is **committed and stops tracking the mouse** (persist deactivated state via `updateSelection` before `newSelection`). Starting a drag in the left/right gutter anchors the selection to the start/end edge (`armFromEdge` in the window mouse handler). The edge handles are 16px-wide grab zones with a visible line; the red cursor line has `pointer-events: none` so it never steals handle clicks. Selections/clicks at `x=0` must not be dropped, and loop times are clamped to `[0, duration]` (negative loopStart crashes `AudioBufferSourceNode.start`).
  - The two canvases (waveform + elapsed) are full-size; the main canvas routes `mousemove` through `handleMouseEvents` (it stops propagation itself) so drags work even with no selection overlay present.

## Styling

- **No SCSS variables.** All design tokens are CSS custom properties in `:root` inside `styles/globals.scss` (also fonts, `@keyframes` spin/blinker/point-zoom-out, element styles like `input[type=range]`). Module files reference `var(--…)`.
- Component styles are co-located `X.module.scss` imported as `import s from './X.module.scss'`; conditional classes via `import cn from 'classnames'` → `cn(s.a, s.b)`.
- **There is deliberately no global `* { box-sizing: border-box }`** — the app is `content-box` based (the column tool icon buttons size off `1em` + padding; a border-box reset shrank them). Set `box-sizing` per-selector where a layout needs it.
- CSS Modules hashes class names → any JS DOM lookup by CSS class must use a data attribute or ref.

## Data & deployment

- `public/` holds static assets, fonts, drumkits, and **`public/models/`** (the `.zip` "models" loaded at startup; ~42MB, tracked in git — don't move them).
- **Model format (v2)**: each `.purple.zip` contains audio files + an `index.json` with `version: 2`, `cols`/`rows`, `files[]` (`filename`/`mimeType`/`params` = `Sound.getSaveState()`), and a `presets[]` array of 10 key-addressed slots (snapshots of every sound's settings, `null` for keys never pressed; effect `defaults` are stripped to keep presets small). Legacy files (no `version`/`presets`) load transparently as v1 with an empty preset list; saves still use `.purple.zip` + `STORE`. Types are in `lib/audio/model-types.ts`.
- Deploy target: Vercel. `vercel.json` pins the framework preset to `nextjs` (the project was a CRA app originally — without this Vercel looks for a `build` output directory instead of `.next`) and silences GitHub comments.
- **Git**: mainline branch is `zwei`, primary remote `origin` (github.com/bebejane/pplppls). Don't add large binaries; GitHub rejects >100MB. `legacy/` is committed (archive of the old CRA source). Root `audio/`, `utils/`, `icons/` are gitignored local scratch — never stage them.

## Deferred from the migration

- The 10 experimental mini-apps (`Wave`, `MultiMixer`, `PitchShifter`, `Spyders`, `Smokey`, `Effing`, `Bloody`, `InputTest`, `Test`, …) and the Electron shell were dropped. Originals live under `legacy/src/` if resurrecting.
- Possible next step (not done): timer-driven loop restarts with per-cycle fades for fully click-proof looping under rate scrubbing (native `source.loop` + the fadeNode envelope is currently near-perfect but approximate during continuous rate drags).