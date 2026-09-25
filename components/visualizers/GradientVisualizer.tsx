'use client';

import Visualizer from './Visualizer';

/**
 * Draws the locked-column striped gradient on a canvas (the look previously
 * produced by the Column background-image linear-gradient) and pulses its
 * brightness with the column's live audio level (analyser type 'volume').
 *
 * The stripe angle comes only from the `deg` prop: the incoming audio data
 * never rotates the gradient — it only modulates intensity (the whole striped
 * layer dims/brightens with the signal).
 */
export default function GradientVisualizer({
	id,
	deg = 0,
	color,
	colorLeft,
	colorRight,
	minOpacity = 0.15,
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
				// volume is 0..100; floor the intensity so the gradient never
				// fully vanishes while the analyser is idle or quiet
				const volume = typeof data === 'number' ? data : 0;
				const intensity = Math.max(minOpacity, Math.min(1, volume / 60));

				const cx = width / 2;
				const cy = height / 2;
				const diag = Math.hypot(width, height);
				const stripe = 26;

				ctx.save();
				ctx.globalAlpha = intensity;
				// base fill, then angled stripes at the prop-driven degree
				ctx.fillStyle = color;
				ctx.fillRect(0, 0, width, height);
				ctx.translate(cx, cy);
				ctx.rotate((deg * Math.PI) / 180);
				for (let i = 0, x = -diag; x < diag; i++, x += stripe) {
					if (i % 2 === 0) continue;
					ctx.fillStyle = colorLeft;
					ctx.fillRect(x, -diag, stripe, diag * 2);
				}
				ctx.restore();
			}}
		/>
	);
}