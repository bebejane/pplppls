'use client';

import { useRef } from 'react';
import cn from 'classnames';
import useWheelNudge from '@/hooks/useWheelNudge';
import Slider from './Slider';
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
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * The reset target is the **first value the fader ever saw**, captured on
 * mount. That is the sound's/preset's value at the time the control appeared,
 * which is what "reset to initial" means to the user; no explicit default is
 * needed.
 *
 * The actual double-click detection lives in the Slider (two presses inside the
 * window on the handle fire `onThumbDblClick`) — the Fader only supplies the
 * target value. The shared reset semantics live here so they stay in one
 * place.
 */
function useThumbReset(value: number, onChange: (next: number) => void) {
	// call sites pass inline arrows — keep the latest through a ref
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const initialRef = useRef(value);
	return () => onChangeRef.current(initialRef.current);
}

/**
 * A horizontal fader: drag to set, click the track to jump, or swipe
 * horizontally (trackpad two-finger / shift+wheel) to nudge. Double-click the
 * thumb to reset to the value the fader first appeared with. Use this anywhere
 * the app needs a horizontal slider so the scroll behaviour is consistent —
 * see the mixer, EQ and effect editor.
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
}: FaderProps) {
	const toPos = (v: number) => ((clamp(v, min, max) - min) / (max - min)) * 100;
	const fromPos = (pos: number) => min + (clamp(pos, 0, 100) / 100) * (max - min);
	const stepPos = step ? (step / (max - min)) * 100 : 1;

	const ref = useWheelNudge(value, onChange, { axis: 'x', min, max, perPixel, throttleMs });
	const reset = useThumbReset(value, onChange);

	return (
		<div className={cn(s.horizontal, className)} ref={ref}>
			<Slider
				axis='x'
				x={toPos(value)}
				xmin={0}
				xmax={100}
				xstep={stepPos}
				disabled={disabled}
				ariaLabel={label}
				onChange={({ x }: { x: number }) => {
					const next = fromPos(x);
					onChange(step ? Math.round(next / step) * step : next);
				}}
				onThumbDblClick={reset}
			/>
		</div>
	);
}

/**
 * A vertical fader: drag to set, click the track to jump, or scroll the wheel
 * to nudge. The counterpart to {@link HorizontalFader}, used by the mixer's
 * channel/master strips.
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
}: FaderProps) {
	const toPos = (v: number) => ((clamp(v, min, max) - min) / (max - min)) * 100;
	const fromPos = (pos: number) => min + (clamp(pos, 0, 100) / 100) * (max - min);
	const stepPos = step ? (step / (max - min)) * 100 : 1;

	const ref = useWheelNudge(value, onChange, { axis: 'y', min, max, perPixel, throttleMs });
	const reset = useThumbReset(value, onChange);

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
				ariaLabel={label}
				onChange={({ y }: { y: number }) => {
					const next = fromPos(y);
					onChange(step ? Math.round(next / step) * step : next);
				}}
				onThumbDblClick={reset}
			/>
		</div>
	);
}

export default HorizontalFader;
