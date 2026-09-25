'use client';

import Visualizer from './Visualizer';
import { useRef } from 'react';

/**
 * Draws the locked-column gradient on a canvas along the CSS gradient line
 * (angle 0° = toward the top, clockwise; line length `w·|sinθ| + h·|cosθ|`),
 * as a run of identical stripes (same count as before) where each stripe
 * contains its own internal gradient — the tone sweeps A → B → A inside every
 * stripe, like the old CSS felt.
 *
 * The incoming audio level (analyser type 'volume') crossfades the gradient's
 * brightness smoothly (exponential smoothing per frame) — like a light fading
 * in/out — starting from the old CSS look when loud. The stripe angle comes
 * only from the `deg` prop: audio never rotates the gradient.
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
				// repeating identical stripes, each holding its own internal
				// gradient: A at every stripe boundary, ramping up to colorLeft
				// at the stripe middle and back down to A — a smooth triangle
				// wave, no hard edges, same stripe count as the original CSS
				const stripes = 4;
				for (let i = 0; i <= stripes; i++) {
					grad.addColorStop(i / stripes, color);
				}
				for (let i = 0; i < stripes; i++) {
					grad.addColorStop((i + 0.5) / stripes, colorLeft);
				}

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