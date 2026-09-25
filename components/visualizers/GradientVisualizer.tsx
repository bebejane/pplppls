'use client';

import Visualizer from './Visualizer';
import { useRef } from 'react';

/**
 * Draws the locked-column gradient on a canvas along the CSS gradient line
 * (angle 0° = toward the top, clockwise; line length `w·|sinθ| + h·|cosθ|`),
 * as a run of identical stripes (4 per gradient line). Each stripe holds its
 * own internal gradient — the tone sweeps `color` → `colorLeft` across the
 * stripe and hard-resets at the next one (a sawtooth, matching the original
 * CSS gradient look).
 *
 * The incoming audio level (analyser type 'volume') crossfades the gradient's
 * brightness smoothly (exponential smoothing per frame) — like a light fading
 * in/out. The stripe angle comes only from the `deg` prop: audio never rotates
 * the gradient.
 */
export default function GradientVisualizer({
	id,
	deg = 0,
	color,
	colorLeft,
	colorRight,
	minOpacity = 0.55,
	ready,
}: {
	id: string;
	deg?: number;
	color?: string;
	colorLeft?: string;
	colorRight?: string;
	minOpacity?: number;
	ready?: boolean;
}) {
	// exponentially-smoothed brightness so the pulse is a fade, not a snap
	const intensityRef = useRef(0.6);

	return (
		<Visualizer
			id={id}
			type='volume'
			color={color}
			colorLeft={colorLeft}
			colorRight={colorRight}
			ready={ready}
			paint={(
				ctx,
				data,
				_opt,
				{ width, height, color = 'rgb(88,0,150)', colorLeft = 'rgb(104,0,255)' },
			) => {
				if (!width || !height) return;

				// volume is 0..100; target brightness with a floor so the resting
				// gradient still looks like the old CSS gradient
				const volume = typeof data === 'number' ? data : 0;
				const target = Math.max(minOpacity, Math.min(1, volume / 45));
				intensityRef.current += (target - intensityRef.current) * 0.18;
				const intensity = intensityRef.current;

				// CSS linear-gradient angle measured clockwise from the top
				const rad = ((deg % 360) * Math.PI) / 180;
				const dx = Math.sin(rad); // right
				const dy = -Math.cos(rad); // up (canvas y grows downward)
				// gradient-line length: projection of the box onto the direction
				const L = width * Math.abs(dx) + height * Math.abs(dy);
				const cx = width / 2;
				const cy = height / 2;
				const grad = ctx.createLinearGradient(
					cx - (dx * L) / 2,
					cy - (dy * L) / 2,
					cx + (dx * L) / 2,
					cy + (dy * L) / 2,
				);
				// 4 identical stripes that each hold their own internal gradient:
				// the tone sweeps from `color` (light) to `colorLeft` (dark)
				// across the stripe, then hard-resets to `color` at the next one
				// (sawtooth, same as the original CSS look)
				const stripes = 4;
				for (let i = 0; i < stripes; i++) {
					grad.addColorStop(i / stripes, color);
					grad.addColorStop((i + 1) / stripes, colorLeft);
				}
				grad.addColorStop(1, colorLeft);

				ctx.fillStyle = grad;
				ctx.fillRect(0, 0, width, height);

				// brightness crossfade: hue-preserving dim toward black by the
				// smoothed inverse intensity (opaque, so no background bleed)
				const dim = 1 - intensity;
				if (dim > 0.005) {
					ctx.fillStyle = 'rgba(0,0,0,' + dim.toFixed(3) + ')';
					ctx.fillRect(0, 0, width, height);
				}
			}}
		/>
	);
}