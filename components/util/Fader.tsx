'use client';

import Slider from 'react-input-slider';
import { useEffect, useRef } from 'react';
import cn from 'classnames';
import useWheelNudge from '@/hooks/useWheelNudge';
import s from './Fader.module.scss';

/** Shared shape for both faders: a value, its range, and an onChange. */
export interface FaderProps {
	/** Current value, in `min`…`max` units (not a 0–100 position). */
	value: number;
	min: number;
	max: number;
	/** Called with the next clamped value. */
	onChange: (next: number) => void;
	/** Step in `value` units. Defaults to 1/100th of the range. */
	step?: number;
	/** Units moved per pixel of scroll/swipe. Lower = more sensitive. */
	perPixel?: number;
	/**
	 * Minimum ms between wheel/swipe updates (default 50, i.e. at most 20/s).
	 * Trackpads emit up to ~120 events/s; deltas inside the window are
	 * accumulated and applied on a trailing edge, so nothing is dropped.
	 */
	throttleMs?: number;
	className?: string;
	/** Optional label for assistive tech. */
	label?: string;
	disabled?: boolean;
	/**
	 * `react-input-slider` style overrides (`track`/`active`/`thumb`/`disabled`).
	 * Optional — omit to use the component's default styling; never pass
	 * `undefined` explicitly, which would override the library's own default and
	 * crash (see DEFAULT_STYLES).
	 */
	styles?: Record<string, unknown>;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Shared double-click-to-reset for both faders, fired only when the *thumb*
 * itself is double-clicked (not the track — clicking the track to jump position
 * is a common gesture and resetting from it would be surprising).
 *
 * The reset target is the **first value the fader ever saw**, captured on mount.
 * That is the sound's/preset's value at the time the control appeared, which is
 * what "reset to initial" means to the user; no explicit default is needed.
 *
 * `react-input-slider` renders `<track><active/><handle><thumb/></handle></track>`
 * using emotion `css`, so there are no stable class names to select. The thumb
 * is therefore identified structurally — the innermost childless `div` under the
 * wrapper — on each event, because those nodes are re-created on every render.
 * The listener lives on the wrapper (which React keeps) and checks the event
 * target, so it survives re-renders.
 *
 * `onChange` goes through a ref: call sites pass inline arrows, so depending on
 * it directly would re-subscribe on every render (constant churn on a control
 * that updates while dragging).
 */
function useResetGesture(
	ref: React.RefObject<HTMLDivElement | null>,
	value: number,
	onChange: (next: number) => void,
) {
	//const onChangeRef = useRef(onChange);
	//onChangeRef.current = onChange;
	// the reset target: whatever the value was when this fader mounted. A ref
	// (not state) so it never triggers a render, and never updates afterwards.
	const initialRef = useRef(value);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		/**
		 * The thumb: the slider renders `<track><active/><handle><thumb/></handle>`,
		 * so it is the innermost childless div. Located per event because those
		 * nodes are re-created on every render.
		 */
		const findThumb = (): HTMLElement | null => {
			let node: HTMLElement | null = el;
			while (node?.firstElementChild) {
				node = node.firstElementChild as HTMLElement;
			}
			return node !== el && node.childElementCount === 0 ? node : null;
		};

		// Double-click is detected from `mousedown`, not the native `dblclick`
		// event: the slider calls `preventDefault()` in its own mousedown handler,
		// and a prevented mousedown suppresses the browser's `dblclick` entirely
		// (which is why the gesture never fired). Counting two presses on the
		// thumb inside the platform's double-click window reproduces it.
		const DOUBLE_CLICK_MS = 400;
		let lastDown = 0;
		let lastTarget: EventTarget | null = null;

		const onMouseDown = (e: MouseEvent) => {
			const thumb = ref.current?.querySelector('div:last-child');
			const target = e.target as Node | null;
			// only the thumb resets; clicking the track (to jump position) must not
			if (!thumb || !target || !thumb.contains(target)) {
				lastDown = 0;
				lastTarget = null;
				return;
			}
			const now = performance.now();
			const isDouble = now - lastDown < DOUBLE_CLICK_MS && lastTarget === target;
			lastDown = isDouble ? 0 : now;
			lastTarget = isDouble ? null : target;
			if (isDouble) {
				console.log(initialRef.current);
				e.stopPropagation();
				console.log('ret');
				onChange?.(initialRef.current);
			}
		};

		el.addEventListener('mousedown', onMouseDown);
		return () => el.removeEventListener('mousedown', onMouseDown);
	}, [ref]);
}

/**
 * `react-input-slider` dereferences `styles[axis]` unconditionally. Its
 * `defaultProps` supplies `styles: {}`, but an *explicitly passed* `undefined`
 * overrides that default and crashes — so callers without their own style map
 * (the EQ and effect editor) get this instead.
 *
 * Styled to match the mixer's horizontal sliders (`panStyle`) so every fader in
 * the app reads the same.
 */
const DEFAULT_STYLES: Record<string, unknown> = {
	track: {
		width: '100%',
		height: 16,
		backgroundColor: 'rgba(255, 255, 255, 0.25)',
		borderRadius: 0,
	},
	active: {
		backgroundColor: 'rgba(255, 255, 255, 0.25)',
		borderRadius: 0,
	},
	thumb: {
		width: 8,
		height: 16,
		borderRadius: 2,
		backgroundColor: 'purple',
	},
	disabled: {
		opacity: 0.5,
	},
};

/**
 * A horizontal fader: drag to set, or swipe horizontally (trackpad two-finger /
 * shift+wheel) to nudge. Use this anywhere the app needs a horizontal slider so
 * the scroll behaviour is consistent — see the mixer, EQ and effect editor.
 */
export function HorizontalFader({
	value,
	min,
	max,
	step,
	perPixel,
	throttleMs,
	onChange,
	className,
	label,
	disabled,
	styles,
}: FaderProps) {
	const toPos = (v: number) => ((clamp(v, min, max) - min) / (max - min)) * 100;
	const fromPos = (pos: number) => min + (clamp(pos, 0, 100) / 100) * (max - min);
	const stepPos = step ? (step / (max - min)) * 100 : 1;

	const ref = useWheelNudge(value, onChange, { axis: 'x', min, max, perPixel, throttleMs });
	useResetGesture(ref, value, onChange);

	return (
		<div className={cn(s.horizontal, className)} ref={ref}>
			<Slider
				//ref={sliderRef}
				axis='x'
				x={toPos(value)}
				xmin={0}
				xmax={100}
				xstep={stepPos}
				disabled={disabled}
				aria-label={label}
				onChange={({ x }: { x: number }) => {
					const next = fromPos(x);
					onChange(step ? Math.round(next / step) * step : next);
				}}
				styles={styles ?? DEFAULT_STYLES}
			/>
		</div>
	);
}

/**
 * A vertical fader: drag to set, or scroll the wheel to nudge. The counterpart
 * to {@link HorizontalFader}, used by the mixer's channel/master strips.
 */
export function VerticalFader({
	value,
	min,
	max,
	step,
	perPixel,
	throttleMs,
	onChange,
	className,
	label,
	disabled,
	styles,
}: FaderProps) {
	const toPos = (v: number) => ((clamp(v, min, max) - min) / (max - min)) * 100;
	const fromPos = (pos: number) => min + (clamp(pos, 0, 100) / 100) * (max - min);
	const stepPos = step ? (step / (max - min)) * 100 : 1;

	const ref = useWheelNudge(value, onChange, { axis: 'y', min, max, perPixel, throttleMs });
	useResetGesture(ref, value, onChange);

	return (
		<div className={cn(s.vertical, className)} ref={ref}>
			<Slider
				axis='y'
				y={toPos(value)}
				ymin={0}
				ymax={100}
				ystep={stepPos}
				yreverse
				disabled={disabled}
				aria-label={label}
				onChange={({ y }: { y: number }) => {
					const next = fromPos(y);
					onChange(step ? Math.round(next / step) * step : next);
				}}
				styles={styles ?? DEFAULT_STYLES}
			/>
		</div>
	);
}

export default HorizontalFader;
