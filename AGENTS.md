# AGENTS.md

In-browser **DAW** built with **Next.js 16.3 (App Router) + TypeScript**. The WebAudio engine was ported from the old Create React App build (still in `legacy/` for reference). No testing framework; no TypeScript strictness on the engine.

## Commands

- **Package manager is pnpm.** Use `pnpm install` / `pnpm add`. `pnpm-workspace.yaml` whitelists postinstall build scripts (core-js/fsevents/@parcel/watcher/unrs-resolver) — leave it.
- `pnpm dev` → Next dev server (:3000). `pnpm build` → production build; `pnpm start` → serve it. `pnpm lint` (ESLint, 0 errors gated) and `pnpm typecheck` (`tsc --noEmit`) are the verification gates.
- The app is **browser-only**: it requests microphone access at startup (`engine.init()` rejects without permission), so verify changes in a real browser. `Home` is the intro screen; click `PURPLE` → mic prompt → model loads.
- The old `App.test.js` is gone (it was broken CRA boilerplate). Don't add Jest; there's no test runner wired up.

## Architecture

- Routing is a single route: `app/page.tsx` → `components/studio/Studio.tsx` (`'use client'`). **Studio builds the engine lazily in a `useEffect`** (`new AudioEngine(...)` on the `Global` singleton) — the engine must never be constructed during render/SSR (it creates an `AudioContext` and touches `window`). `Studio` renders `null` until the engine exists.
- `components/purplepurples/PurplePurples.tsx` is the product (the grid DAW). It was split from one giant class component into:
  - hooks: `useEngineListeners.ts` (engine events → state), `useKeyboardShortcuts.ts` (global keys via a mutable handlers ref)
  - subcomponents: `Column` (`ColumnTools`, `ColumnRecord`, `Waveform`), `Controls` (`MasterFader`), `Home`, dialogs (`Save/New/Help/Recordings`), `NotSupported`, overlays
  - types in `types.ts` (Model/ColState/MoveData)
- **Engine**: everything under `lib/audio/` is **TypeScript** (`.ts`) now. The ported CRA-era DSP keeps its behavior; `lib/audio` is excluded from ESLint, and the files marked `// @ts-nocheck` (Sound, AudioEngine, Analyser, Recorder, Master, the WebAudio-heavy effects, mp3 encoder, paulstretch/timestretcher/stretch, recorder worklet) are type-unchecked so `tsc` stays green — treat them as "keep behavior intact":
  - `AudioEngine.ts` (an `EventEmitter`), `Sound.ts`, `Recorder.ts` (uses an `AudioWorkletNode` loaded from a Blob URL — `record/worklet.ts` exports the processor source string; `audioWorklet.addModule` needs JS MIME), `Analyser.ts`, effects, `utils`, encoders.
  - The transport/loop/effects logic was slimmed: `master` lives in `Master.ts`, effect classes share `createEffectBase` + an id→class registry in `effects/index.ts` (shared primitives in `effects/core.ts` — no circular imports), transport methods use `soundForEach`, `lib/audio/types.ts` gives components a typed `AudioEngine` facade (do **not** remove interface members the app calls — `tsc` will fail).
  - DSP algorithms (`utils/`, `paulstretch`, `timestretcher`, encoders) and the worker message contract should not change.
- The engine is a singleton: `import Global from '@/lib/Global'` → `Global.engine` (also `Global.bpm`, `Global.fileToMimeType`). The old `global.Global`/`global.bpm` references were converted to this module.
- **Workers**: `lib/audio/workers.ts` constructs standard ESM module workers via `new Worker(new URL('./encoders/worker', import.meta.url), { type: 'module' })`. The three worker files (`encoders`, `meter`, `record`) are `.ts` (`self.onmessage`, `import`, `self.postMessage`). `encoders/mp3.ts`/`wav.ts` are imported by workers, so keep them free of `require()`/bare `postMessage`.

## Styling

- **No SCSS variables.** Design tokens are CSS custom properties in `:root` inside `styles/globals.scss` (also holds fonts, `@keyframes` spin/blinker/point-zoom-out, and element styles like `input[type=range]`).
- Every component has a co-located `X.module.scss` imported as `import s from './X.module.scss'`; conditional classes via `import cn from 'classnames'` → `cn(s.a, s.b)`.
- Gotchas inherited from the port:
  - Column roots carry `data-sound-point`; `PurplePurples.initModel` maps them via `document.querySelectorAll('[data-sound-point]')` (the old code queried a literal class name that is now module-hashed — keep using the data attribute).
  - CSS Modules hashes class names, so anything that matches elements by CSS class in JS must use a data attribute or ref instead.
  - **`Column` treats live sound state as engine-authoritative.** Engine-driven fields (`volume`, `rate`, `playing`, `locked`, …) arrive via `Global.engine` `'state'<id>` events, and the Column prop-sync helper explicitly skips `locked` so a stale parent prop can't clobber it. When locking/unlocking from UI, always go through `Global.engine.lock(id, on)` (never mutate parent `cols` directly).

## Deferred from this migration

- The 10 experimental mini-apps (`Wave`, `MultiMixer`, `PitchShifter`, `Spyders`, `Smokey`, `Effing`, `Bloody`, `InputTest`, `Test`…) and the Electron shell (`public/electron.js`, `TitleBar`, `is-electron` fs model loading) were dropped. Their code lives in `legacy/src/` (gitignored) if you need to resurrect anything.
- `legacy/`, and root-level `audio/`, `utils/`, `icons/` are gitignored local scratch dirs, not repo content.