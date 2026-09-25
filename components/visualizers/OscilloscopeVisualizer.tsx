'use client';

import Visualizer from './Visualizer';

export default function OscilloscopeVisualizer(
	props: Omit<React.ComponentProps<typeof Visualizer>, 'type' | 'paint'>,
) {
	return (
		<Visualizer
			{...props}
			type='timedomain'
			paint={(ctx, data, _opt, { width, height, color }) => {
				const arr = data as unknown as ArrayLike<number>;
				const sliceWidth = (width * 1.0) / (arr.length || 1);
				let x = 0;
				ctx.lineWidth = 2;
				ctx.strokeStyle = color || '#fff';
				ctx.beginPath();
				for (let i = 0; i < arr.length; i++) {
					const v = (arr[i] as number) / 128.0;
					const y = (v * height) / 2;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
					x += sliceWidth;
				}
				ctx.lineTo(width, height / 2);
				ctx.stroke();
			}}
		/>
	);
}