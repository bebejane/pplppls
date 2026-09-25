'use client';

import Visualizer from './Visualizer';
import Global from '@/lib/Global';
import { useRef } from 'react';

/**
 * Draws the locked-column gradient on a canvas along the CSS gradient line
 * (angle 0° = toward the top, clockwise; line length `w·|sinθ| + h·|cosθ|`),
 * as 4 identical sawtooth stripes: within each stripe the tone sweeps
 * `color` → `colorLeft` and hard-resets at the next stripe.
 *
 * The stripes pulse with the audio spectrum: the column's `frequency`
 * (FFT) data is averaged into 4 log-spaced bands (low → high, one per
 * stripe) and each stripe's brightness fades in/out with its own band
 * (exponentially smoothed per frame). The stripe angle still comes only from
 * the `deg` prop — audio never rotates the gradient.
 */
const STRIPES = 4;

// one frequency band per stripe (Hz, low -> high)
const BANDS: Array<[number, number]> = [
	[20, 250],
	[250, 1000],
	[1000, 4000],
	[4000, 16000],
];

// resting stripe brightness; band magnitude normalisation
const FLOOR = 0.65;
const BIAS = 0.25;
const GAIN = 2.2;
const SMOOTH = 0.2;

// scale an rgb()/rgba() colour toward black by k (hue-preserving brightness)
function scaleRgb(value: string, k: number): string {
	if (!value) return value;
	const nums = value.match(/-?\d+(\.\d+)?/g);
	if (!nums || nums.length < 3) return value;
	const c = (i: number) => Math.max(0, Math.min(255, Math.round(Number(nums[i]) * k)));
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
	// per-stripe smoothed brightness (one per frequency band)
	const bandsRef = useRef<number[]>(new Array(STRIPES).fill(floor));

	return (
		<Visualizer
			id={id}
			type='frequency'
			color={color}
			colorLeft={colorLeft}
			colorRight={colorRight}
			ready={ready}
			paint={(
				ctx,
				data,
				_opt,
				{ width, height, color: c = 'rgb(88,0,150)', colorLeft: cl = 'rgb(104,0,255)' },
			) => {
				if (!width || !height) return;
				const bins = data as unknown as ArrayLike<number>;
				const n = bins && bins.length ? bins.length : 0;
				const sampleRate = Global.engine ? Global.engine.sampleRate : 44100;
				const binHz = n ? sampleRate / 2 / n : 0;
				const bands = bandsRef.current;

				// per-band target brightness from the averaged FFT magnitudes
				for (let b = 0; b < STRIPES; b++) {
					const [lo, hi] = BANDS[b];
					const k0 = binHz ? Math.max(0, Math.floor(lo / binHz)) : 0;
					const k1 = binHz ? Math.min(n - 1, Math.ceil(hi / binHz)) : 0;
					let sum = 0;
					let count = 0;
					for (let k = k0; k <= k1; k++) {
						sum += bins[k];
						count++;
					}
					const avg = count ? sum / count / 255 : 0;
					const target = Math.max(floor, Math.min(1, (avg - BIAS) * GAIN + floor));
					bands[b] += (target - bands[b]) * SMOOTH;
				}

				// gradient line through the box centre at the CSS angle
				const rad = ((deg % 360) * Math.PI) / 180;
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
				// sawtooth stripes, each scaled by its own band brightness
				for (let i = 0; i < STRIPES; i++) {
					grad.addColorStop(i / STRIPES, scaleRgb(c, bands[i]));
					grad.addColorStop((i + 1) / STRIPES, scaleRgb(cl, bands[i]));
				}
				grad.addColorStop(1, scaleRgb(cl, bands[STRIPES - 1]));

				ctx.fillStyle = grad;
				ctx.fillRect(0, 0, width, height);
			}}
		/>
	);
}