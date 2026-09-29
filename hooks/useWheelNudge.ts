'use client';

import { useEffect, useRef } from 'react';

/**
 * Scroll-to-nudge for a slider/fader, in the axis matching the control.
 *
 * A vertical fader responds to the mouse wheel (`deltaY`); a horizontal fader
 * responds to a *horizontal swipe* — a trackpad two-finger swipe (`deltaX`) or
 * shift+wheel, which browsers report as `deltaX` too. Vertical wheel input is
 * deliberately ignored on horizontal faders so a surrounding horizontal
 * scroller keeps working and a plain wheel doesn't yank a pan/rate value
 * sideways.
 *
 * The listener is attached natively (not via React's `onWheel`) because it has
 * to `preventDefault()`, which React's passive wheel listener cannot do.
 *
 * Updates are **throttled**: a trackpad emits wheel events at up to ~120 Hz, and
 * each `onChange` writes an engine parameter (and re-renders), so firing on
 * every event floods the audio param and the React tree. Deltas that arrive
 * inside the throttle window are *accumulated* and applied on a trailing edge,
 * so a fast flick still moves the full distance and nothing is dropped.
 *
 * Direction: the value moves the *opposite* way to the scroll delta, matching
 * how the control reads when you scroll over it — scrolling/swiping right
 * lowers a horizontal value, scrolling down lowers a vertical one.
 *
 * @param value    current value (the displayed one, not a normalised position)
 * @param onChange called with the next clamped value
 * @param opts     `axis`, `min`/`max` bounds, units moved per pixel, and the
 *                 minimum ms between updates (default 50 — i.e. at most 20/s)
 */
export default function useWheelNudge(
	value: number,
	onChange: (next: number) => void,
	{
		axis = 'y',
		min,
		max,
		perPixel = 100,
		throttleMs = 10,
	}: { axis?: 'x' | 'y'; min: number; max: number; perPixel?: number; throttleMs?: number },
) {
	const elRef = useRef<HTMLDivElement>(null);
	// refs keep the native listener's closure current across renders without
	// re-subscribing on every value change
	const valueRef = useRef(value);
	const onChangeRef = useRef(onChange);
	valueRef.current = value;
	onChangeRef.current = onChange;

	useEffect(() => {
		const el = elRef.current;
		if (!el) return;

		let lastRun = 0;
		let trailing = 0; // pending timer for the accumulated delta
		let pending = 0; // unapplied delta (fraction of the full range)

		const apply = (step: number) => {
			const span = max - min;
			const next = Math.min(max, Math.max(min, valueRef.current + step * span));
			if (next === valueRef.current) return;
			valueRef.current = next;
			onChangeRef.current(next);
		};

		const onWheel = (e: WheelEvent) => {
			let raw: number;
			if (axis === 'x') {
				// take whichever axis actually carries the gesture; shift+wheel is
				// reported as deltaY by some browsers but means "scroll sideways"
				raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
			} else {
				raw = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : 0;
			}
			if (!raw) return;
			e.preventDefault();
			// normalise line/page deltas to pixels
			const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1;
			// clamp per event so a flick can't jump the whole range
			const magnitude = Math.max(-1, Math.min(1, (raw * unit) / perPixel));
			// Horizontal is negated (swipe right lowers the value); vertical is
			// not — scrolling down raises the fader, which is the direction that
			// reads as "up the scale" on a vertical control.
			pending += axis === 'x' ? -magnitude : magnitude;

			const now = performance.now();
			const elapsed = now - lastRun;
			if (elapsed >= throttleMs) {
				lastRun = now;
				const step = pending;
				pending = 0;
				apply(step);
				return;
			}
			// still inside the window: accumulate and schedule a trailing apply so
			// the tail of the gesture is not swallowed
			if (trailing) return;
			trailing = window.setTimeout(() => {
				trailing = 0;
				lastRun = performance.now();
				const step = pending;
				pending = 0;
				if (step) apply(step);
			}, throttleMs - elapsed);
		};

		el.addEventListener('wheel', onWheel, { passive: false });
		return () => {
			el.removeEventListener('wheel', onWheel);
			if (trailing) clearTimeout(trailing);
		};
	}, [axis, min, max, perPixel, throttleMs]);

	return elRef;
}
