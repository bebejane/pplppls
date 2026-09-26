'use client';

import Visualizer from './Visualizer';
import Global from '@/lib/Global';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Draws the locked-column gradient on a canvas along the CSS gradient line
 * (angle 0° = toward the top, clockwise; line length `w·|sinθ| + h·|cosθ|`),
 * as 4 identical sawtooth stripes: within each stripe the tone sweeps
 * `color` → `colorLeft` and hard-resets at the next stripe.
 *
 * The stripes pulse with the audio spectrum: the column's `frequency`
 * (FFT) data is averaged into 4 narrow bands — one per stripe — each chosen
 * at random (distinct) so every locked column reacts to a different set of
 * frequency ranges, and each stripe's brightness fades in/out with its band
 * (exponentially smoothed per frame). Audio never rotates the gradient — the
 * angle is the resting `deg` prop.
 *
 * On lock the component plays its own short "spin" (a random angle every 40ms
 * for 1s, then back to the resting angle), brightening the stripes for its
 * duration. It subscribes to the engine's `state<id>` event and restarts the
 * spin whenever `locked` flips true, so the column no longer re-renders per
 * animation frame.
 */
const STRIPES = 4;

// locked-column spin: random angle every STEP ms for ~DURATION ms, with the
// stripes brightened by SPIN_BRIGHTNESS for the duration of the spin
const SPIN_STEP = 70;
const SPIN_DURATION = 500;
const SPIN_BRIGHTNESS = 2;

// resting stripe brightness; band magnitude normalisation
const FLOOR = 0.65;
const BIAS = 0.12;
const GAIN = 1.1;
const SMOOTH = 0.2;

// frequency zones available for stripes; each stripe gets one distinct random
// narrow band so different columns (and different stripes) visibly react to
// different parts of the spectrum
const ZONES: Array<[number, number]> = [
	[40, 80],
	[80, 160],
	[160, 320],
	[320, 640],
	[640, 1280],
	[1280, 2560],
	[2560, 5120],
	[5120, 12000],
];

// random distinct narrow bands (one per stripe), picked without replacement
// then shuffled — each GradientVisualizer instance (per locked column) gets its
// own frequency split so different columns react to different ranges
function randomBands(): Array<[number, number]> {
	const pool = ZONES.map((_, i) => i);
	const chosen: Array<[number, number]> = [];
	while (chosen.length < STRIPES && pool.length) {
		const idx = Math.floor(Math.random() * pool.length);
		chosen.push(ZONES[pool.splice(idx, 1)[0]]);
	}
	for (let i = chosen.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[chosen[i], chosen[j]] = [chosen[j], chosen[i]];
	}
	return chosen;
}

// scale an rgb()/rgba() colour toward black by k (hue-preserving brightness)
// parse a css rgb()/rgba() colour once (the props are stable) so the per-frame
// stripe scaling never runs a regex in the paint loop
type Rgb = [number, number, number];
function parseRgb(value: string | undefined, fallback: Rgb): Rgb {
	if (!value) return fallback;
	const nums = value.match(/-?\d+(\.\d+)?/g);
	if (!nums || nums.length < 3) return fallback;
	return [Number(nums[0]), Number(nums[1]), Number(nums[2])];
}
// scale an rgb tuple toward black by k (hue-preserving brightness)
function scaleRgb(rgb: Rgb, k: number): string {
	const c = (i: number) => Math.max(0, Math.min(255, Math.round(rgb[i] * k)));
	return `rgb(${c(0)},${c(1)},${c(2)})`;
}

export default function GradientVisualizer({
	id,
	deg = 0,
	color,
	colorLeft,
	colorRight,
	floor = FLOOR,
	ready,
}: {
	id: string;
	deg?: number;
	color?: string;
	colorLeft?: string;
	colorRight?: string;
	floor?: number;
	ready?: boolean;
}) {
	// per-stripe smoothed brightness (one per random frequency band)
	const bandsRef = useRef<number[]>(new Array(STRIPES).fill(floor));
	// this instance's random band split — generated once per locked column
	const [freqBands] = useState<Array<[number, number]>>(() => randomBands());
	// colours parsed once per prop change (not per frame)
	const colorRgb = useMemo(() => parseRgb(color, [88, 0, 150]), [color]);
	const colorLeftRgb = useMemo(() => parseRgb(colorLeft, [104, 0, 255]), [colorLeft]);

	// current spin angle (null while resting); `paint` reads it directly so the
	// animation never re-renders the component
	const spinRef = useRef<number | null>(null);
	const spinTimer = useRef<ReturnType<typeof setInterval> | null>(null);

	const startSpin = useCallback(() => {
		if (spinTimer.current !== null) clearInterval(spinTimer.current);
		let elapsed = 0;
		spinTimer.current = setInterval(() => {
			spinRef.current = Math.floor(Math.random() * 360);
			elapsed += SPIN_STEP;
			if (elapsed > SPIN_DURATION) {
				if (spinTimer.current !== null) clearInterval(spinTimer.current);
				spinTimer.current = null;
				spinRef.current = null;
			}
		}, SPIN_STEP);
	}, []);

	// spin on mount (the visualizer is only rendered while locked) and again on
	// every fresh `locked` update the engine reports for this column
	useEffect(() => {
		if (!Global.engine || !id) return;
		startSpin();
		const onState = (_state: unknown, updated: Record<string, any>) => {
			if (updated && updated.locked) startSpin();
		};
		Global.engine.on('state' + id, onState);
		return () => {
			Global.engine.off('state' + id, onState);
			if (spinTimer.current !== null) clearInterval(spinTimer.current);
			spinTimer.current = null;
			spinRef.current = null;
		};
	}, [id, startSpin]);

	return (
		<Visualizer
			id={id}
			type='frequency'
			// 1024 bins (~43Hz resolution) is plenty for the 4 band peaks and
			// roughly halves the FFT cost of the 2048 default
			options={{ fftSize: 1024 }}
			color={color}
			colorLeft={colorLeft}
			colorRight={colorRight}
			ready={ready}
			paint={(ctx, data, _opt, { width, height }) => {
				if (!width || !height) return;
				const bins = data as unknown as ArrayLike<number>;
				const n = bins && bins.length ? bins.length : 0;
				const sampleRate = Global.engine ? Global.engine.sampleRate : 44100;
				const binHz = n ? sampleRate / 2 / n : 0;
				const bands = bandsRef.current;

				// per-band target brightness from the strongest bin in the band
				// (byte frequency data is peaky — a mean sits near the floor)
				for (let b = 0; b < STRIPES; b++) {
					const [lo, hi] = freqBands[b];
					const k0 = binHz ? Math.max(0, Math.floor(lo / binHz)) : 0;
					const k1 = binHz ? Math.min(n - 1, Math.ceil(hi / binHz)) : 0;
					let peak = 0;
					for (let k = k0; k <= k1; k++) {
						if (bins[k] > peak) peak = bins[k];
					}
					const energy = peak / 255;
					const target = Math.max(floor, Math.min(1, (energy - BIAS) * GAIN + floor));
					bands[b] += (target - bands[b]) * SMOOTH;
				}

				// gradient line through the box centre at the CSS angle; the
				// locked spin overrides the resting angle while it's running
				const rad = (((spinRef.current ?? deg) % 360) * Math.PI) / 180;
				const dx = Math.sin(rad);
				const dy = -Math.cos(rad);
				const L = width * Math.abs(dx) + height * Math.abs(dy);
				const cx = width / 2;
				const cy = height / 2;
				const grad = ctx.createLinearGradient(
					cx - (dx * L) / 2,
					cy - (dy * L) / 2,
					cx + (dx * L) / 2,
					cy + (dy * L) / 2,
				);
				// sawtooth stripes, each scaled by its own band brightness; the
				// whole gradient is brightened while the lock spin is running
				const bright = spinRef.current !== null ? SPIN_BRIGHTNESS : 1;
				for (let i = 0; i < STRIPES; i++) {
					grad.addColorStop(i / STRIPES, scaleRgb(colorRgb, bands[i] * bright));
					grad.addColorStop((i + 1) / STRIPES, scaleRgb(colorLeftRgb, bands[i] * bright));
				}
				grad.addColorStop(1, scaleRgb(colorLeftRgb, bands[STRIPES - 1] * bright));

				ctx.fillStyle = grad;
				ctx.fillRect(0, 0, width, height);
			}}
		/>
	);
}
