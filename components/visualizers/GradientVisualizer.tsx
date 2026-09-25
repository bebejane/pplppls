'use client';

import Visualizer from './Visualizer';

/**
 * Draws the locked-column striped gradient on a canvas, reproducing the old
 * `linear-gradient(deg, A 25%, B 25%, A 50%, B 50%, A 75%, B 75%, A 100%)`
 * background exactly: gradient line through the box center at the CSS angle
 * (0° = toward the top, clockwise), stripe thickness = 25% of the gradient
 * line length (`w·|sinθ| + h·|cosθ|`), opaque colors.
 *
 * The incoming audio level (analyser type 'volume') pulses the gradient by
 * dimming it toward black (hue-preserving) — never by rotating it. The stripe
 * angle comes only from the `deg` prop, so audio never moves the degree.
 */
export default function GradientVisualizer({
	id,
	deg = 0,
	color,
	colorLeft,
	colorRight,
	minOpacity = 0.35,
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
				// volume is 0..100; floor the pulse so the gradient never fully
				// disappears while the analyser is idle/quiet
				const volume = typeof data === 'number' ? data : 0;
				const intensity = Math.max(minOpacity, Math.min(1, volume / 60));

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
				// stops mirror the original CSS gradient 1:1
				grad.addColorStop(0, color);
				grad.addColorStop(0.25, color);
				grad.addColorStop(0.25, colorLeft);
				grad.addColorStop(0.5, colorLeft);
				grad.addColorStop(0.5, color);
				grad.addColorStop(0.75, color);
				grad.addColorStop(0.75, colorLeft);
				grad.addColorStop(1, colorLeft);
				grad.addColorStop(1, color);

				ctx.fillStyle = grad;
				ctx.fillRect(0, 0, width, height);

				// pulse: overlay black at the inverse intensity — keeps the
				// gradient opaque (same look as the CSS) while its brightness
				// breathes with the audio
				const dim = 1 - intensity;
				if (dim > 0.01) {
					ctx.fillStyle = 'rgba(0,0,0,' + dim.toFixed(3) + ')';
					ctx.fillRect(0, 0, width, height);
				}
			}}
		/>
	);
}