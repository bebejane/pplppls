import type { SVGProps } from 'react';

/**
 * Custom solid/filled icon set for the ColumnTools tool strip (24x24 grid).
 * Styling rides on `currentColor` + `1em` sizing — same contract as react-icons,
 * so className/onClick/state classes keep working exactly as before.
 */

function Svg({ children, ...props }: SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 24 24"
			width="1em"
			height="1em"
			fill="currentColor"
			aria-hidden="true"
			focusable="false"
			{...props}
		>
			{children}
		</svg>
	);
}

export function IconPlay(props: SVGProps<SVGSVGElement>) {
	return (
		<Svg {...props}>
			<path d="M8 5v14l11-7z" />
		</Svg>
	);
}

export function IconStop(props: SVGProps<SVGSVGElement>) {
	return (
		<Svg {...props}>
			<rect x="6" y="6" width="12" height="12" rx="2" />
		</Svg>
	);
}

export function IconRecord(props: SVGProps<SVGSVGElement>) {
	return (
		<Svg {...props}>
			<circle cx="12" cy="12" r="6" />
		</Svg>
	);
}

export function IconVolume(props: SVGProps<SVGSVGElement>) {
	return (
		<Svg {...props}>
			<path d="M3 9v6h4l5 5V4L7 9H3z" />
			<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
			<path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
		</Svg>
	);
}

export function IconLoop(props: SVGProps<SVGSVGElement>) {
	return (
		<Svg {...props}>
			<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
		</Svg>
	);
}

export function IconReverse(props: SVGProps<SVGSVGElement>) {
	return (
		<Svg {...props}>
			<path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
		</Svg>
	);
}

export function IconEffects(props: SVGProps<SVGSVGElement>) {
	return (
		<Svg {...props}>
			<path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z" />
		</Svg>
	);
}

export function IconMidi(props: SVGProps<SVGSVGElement>) {
	return (
		<Svg {...props}>
			<path
				fillRule="evenodd"
				d="M5 3.5 H19 A2 2 0 0 1 21 5.5 V19 A2 2 0 0 1 19 21 H5 A2 2 0 0 1 3 19 V5.5 A2 2 0 0 1 5 3.5 Z M5.4 4.6 H18.6 A1 1 0 0 1 19.6 5.6 V8.4 A1 1 0 0 1 18.6 9.4 H5.4 A1 1 0 0 1 4.4 8.4 V5.6 A1 1 0 0 1 5.4 4.6 Z M6.68 15.5 H7.18 V21 H6.68 Z M9.22 15.5 H9.72 V21 H9.22 Z M11.75 13.2 H12.25 V21 H11.75 Z M14.28 15.5 H14.78 V21 H14.28 Z M16.82 15.5 H17.32 V21 H16.82 Z"
			/>
			<circle cx="6.5" cy="6.9" r="1.5" />
			<circle cx="17.5" cy="6.9" r="1.5" />
		</Svg>
	);
}

export function IconReset(props: SVGProps<SVGSVGElement>) {
	return (
		<Svg {...props}>
			<path d="M14 12c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2zm-2-9c-4.97 0-9 4.03-9 9H1l4 4 4-4H5c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.51 0-2.91-.49-4.06-1.3l-1.42 1.44C8.04 20.3 9.94 21 12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z" />
		</Svg>
	);
}

export function IconSolo(props: SVGProps<SVGSVGElement>) {
	return (
		<Svg {...props}>
			<path d="M12 1a9 9 0 0 0-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7a9 9 0 0 0-9-9z" />
		</Svg>
	);
}

export function IconFullscreen(props: SVGProps<SVGSVGElement>) {
	return (
		<Svg {...props}>
			<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
		</Svg>
	);
}

export function IconLock(props: SVGProps<SVGSVGElement>) {
	return (
		<Svg {...props}>
			<path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
		</Svg>
	);
}