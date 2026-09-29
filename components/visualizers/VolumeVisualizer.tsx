'use client';

import Visualizer from './Visualizer';

// Ballistics for the meter. The engine tweens the raw level with an exponential
// moving average; larger values converge more slowly. The engine defaults
// (1.618 / 4.854) still let frame-to-frame amplitude noise flicker the bar, so
// the visualizer asks for a calmer attack and a longer release — the meter now
// glides instead of jumping. Callers can still override via `options`.
const SMOOTHING = { tweenIn: 4, tweenOut: 14 } as const;

export default function VolumeVisualizer({
	options,
	...props
}: Omit<React.ComponentProps<typeof Visualizer>, 'type' | 'paint'>) {
	return (
		<Visualizer
			{...props}
			options={{ ...SMOOTHING, ...options }}
			type='volume'
			paint={(ctx, data, _opt, { width, height, color, colorLeft, colorRight }) => {
				const volume = data as number;
				const meterPerc = Math.min(1, Math.max(0, volume / 100));
				const meterHeight = Math.round(meterPerc * height);
				const x1 = 0;
				const y1 = height - meterHeight;
				ctx.fillStyle = colorLeft || color || '#fff';
				ctx.fillRect(x1, y1, width / 2, meterHeight);
				ctx.fillStyle = colorRight || color || '#fff';
				ctx.fillRect(width / 2, y1, width / 2, meterHeight);
			}}
		/>
	);
}
