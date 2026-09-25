'use client';

import Visualizer from './Visualizer';

export default function FrequencyVisualizer(props: Omit<React.ComponentProps<typeof Visualizer>, 'type' | 'paint'>) {
	return (
		<Visualizer
			{...props}
			type='frequency'
			paint={(ctx, data, _opt, { width, height, color }) => {
				const arr = data as unknown as ArrayLike<number>;
				const margin = 2;
				const barWidth = width / arr.length + margin;
				for (let i = 0, x = 0; i < arr.length; i++, x += margin) {
					ctx.fillStyle = color || '#fff';
					ctx.fillRect(
						parseInt((i * barWidth + x).toString(), 10),
						height - parseInt((arr[i] as number) * 2.55 + '', 10),
						barWidth,
						parseInt((arr[i] as number) * 2.55 + '', 10),
					);
				}
			}}
		/>
	);
}