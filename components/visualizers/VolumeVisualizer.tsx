'use client';

import Visualizer from './Visualizer';

export default function VolumeVisualizer(
	props: Omit<React.ComponentProps<typeof Visualizer>, 'type' | 'paint'>,
) {
	return (
		<Visualizer
			{...props}
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