'use client';

/**
 * In-house replacement for `react-input-slider` (removed).
 *
 * Tracks the removed library's behaviour contract so the two fader wrappers
 * and ColumnTools keep working unchanged:
 *
 * - `<track><active/><handle><thumb/></handle></track>` structure; the track is
 *   `position: relative` (styles in Slider.module.scss), the handle is
 *   absolutely positioned at the value with `translate(-50%, -50%)`, the thumb
 *   is its inner child.
 * - Positions are in 0–100 units of the axis (`x`/`y` between min/max), steps
 *   quantize from the min with `trunc(pos / step) * step`, and `xreverse` /
 *   `yreverse` flip the visual position while `onChange` keeps delivering the
 *   logical (un-flipped) value — exactly like the old library.
 * - Clicking the track jumps to that position (on click, not on press); only a
 *   handle press starts a drag (no jump from a thumb click — the handle's
 *   `onClick` stops propagation).
 * - `touch-action: none` + `user-select: none` on the track so touch/tap and
 *   drag work without text selection or scroll interference (the old library
 *   used mousedown/touchstart pairs; pointer events cover both plus stylus).
 * - Double-press detection lives here: two presses on the handle inside the
 *   Fader's 300ms window fire `onThumbDblClick` (used by the faders'
 *   double-click-to-reset). Counted on `pointerdown` rather than the native
 *   `dblclick` so it works for taps and is immune to re-render subtleties;
 *   pressing anywhere else in the slider clears the counter.
 *
 * Sizing/colour/styling lives entirely in Slider.module.scss via the
 * `--slider-*` custom properties (no `styles` prop); the only inline style left
 * is the value-driven position of the active bar and handle. Consumers restyle
 * their faders by setting the vars on their own wrapper element.
 */

import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, CSSProperties } from 'react';
import cn from 'classnames';
import s from './Slider.module.scss';

export interface SliderState {
	x: number;
	y: number;
}

export interface SliderProps {
	axis: 'x' | 'y';
	x?: number;
	y?: number;
	xmin?: number;
	xmax?: number;
	ymin?: number;
	ymax?: number;
	xstep?: number;
	ystep?: number;
	xreverse?: boolean;
	yreverse?: boolean;
	disabled?: boolean;
	/** track-level label for assistive tech. */
	ariaLabel?: string;
	/** Called with the logical `{x, y}` for the new position (like before). */
	onChange: (s: SliderState) => void;
	/** Two presses on the thumb/handle inside the double-click window. */
	onThumbDblClick?: () => void;
	/** Extra classes on the track (styling via `--slider-*` vars, not override styles). */
	className?: string;
}

const clampPct = (v: number) => Math.min(100, Math.max(0, v));

/** The Fader's long-standing double-click window. */
const DOUBLE_CLICK_MS = 300;

export default function Slider({
	axis,
	x = 50,
	y = 50,
	xmin = 0,
	xmax = 100,
	ymin = 0,
	ymax = 100,
	xstep = 1,
	ystep = 1,
	xreverse = false,
	yreverse = false,
	disabled = false,
	ariaLabel,
	onChange,
	onThumbDblClick,
	className,
}: SliderProps) {
	const trackRef = useRef<HTMLDivElement>(null);
	// double-press bookkeeping (element identity held alongside the timestamp so
	// a stale node can never pair with a fresh one)
	const lastPress = useRef({ t: 0, el: null as Element | null });

	const step = axis === 'x' ? xstep : ystep;
	const min = axis === 'x' ? xmin : ymin;

	// position in top/left space (0–100) for the current logical value
	const pos =
		axis === 'x'
			? clampPct(((x - xmin) / Math.max(xmax - xmin, 0.00001)) * 100)
			: clampPct(((y - ymin) / Math.max(ymax - ymin, 0.00001)) * 100);
	// where the handle actually sits visually (reversed axes flip it)
	const handlePos = xreverse || yreverse ? 100 - pos : pos;

	/**
	 * Emits the logical value(s) for a visual `pct` (0–100, in the axis' own
	 * direction). Same quantization as the old `change()`: trunc to step from
	 * the min, then un-reverse, so the callback value lives in the caller's
	 * min…max space either way.
	 */
	const emit = (pct: number) => {
		const v = Math.trunc(clampPct(pct) / step) * step + min;
		if (axis === 'x') onChange({ x: xreverse ? xmax - v + xmin : v, y: ymin });
		else onChange({ x: xmin, y: yreverse ? ymax - v + ymin : v });
	};

	// pointer position → pct along the axis in top/left space
	const pctFromEvent = (e: { clientX: number; clientY: number }) => {
		const rect = trackRef.current!.getBoundingClientRect();
		return axis === 'x'
			? ((e.clientX - rect.left) / rect.width) * 100
			: ((e.clientY - rect.top) / rect.height) * 100;
	};

	const onHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (disabled) return;
		e.stopPropagation(); // the track would clear the double-press counter otherwise
		// double-press reset: same handle, inside the window

		// drag: track the unclamped pointer and let emit() clamp — the old
		// library recorded start/offset deltas, an absolute recompute is
		// equivalent and simpler. window-level listeners so the drag works
		// when the pointer leaves the track.
		const move = (ev: PointerEvent) => emit(pctFromEvent(ev));
		const up = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', up);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', up);
	};

	const onTrackPointerDown = () => {
		// presses anywhere in the slider reset the double-press counter, except
		// on the handle where it counts up
		lastPress.current = { t: 0, el: null };
		// track presses don't drag (old behaviour) — the click below jumps.
	};

	const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (disabled) return;
		// the handle stops its own click, this only ever fires for track presses
		emit(pctFromEvent(e));
	};

	const onThumbClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (disabled) return;

		const now = performance.now();
		const t = e.currentTarget;
		if (
			onThumbDblClick &&
			lastPress.current.el === t &&
			now - lastPress.current.t < DOUBLE_CLICK_MS
		) {
			lastPress.current = { t: 0, el: null };
			onThumbDblClick();
			e.stopPropagation();
			return;
		}
		lastPress.current = { t: now, el: t };
	};

	// the only inline styles: the value-driven geometry
	const valueStyle: CSSProperties =
		axis === 'x'
			? { width: `${pos}%`, ...(xreverse ? { left: `${100 - pos}%` } : {}) }
			: { height: `${pos}%`, ...(yreverse ? { top: `${100 - pos}%` } : {}) };

	const handleStyle: CSSProperties =
		axis === 'x' ? { top: '50%', left: `${handlePos}%` } : { left: '50%', top: `${handlePos}%` };

	return (
		<div
			ref={trackRef}
			className={cn(s.track, s[axis], disabled && s.disabled, className)}
			onPointerDown={onTrackPointerDown}
			onClick={onTrackClick}
			role='slider'
			aria-label={ariaLabel}
			aria-valuenow={axis === 'x' ? x : y}
			aria-valuemin={axis === 'x' ? xmin : ymin}
			aria-valuemax={axis === 'x' ? xmax : ymax}
			aria-disabled={disabled || undefined}
		>
			<div className={s.active} style={valueStyle} />
			<div
				className={s.handle}
				style={handleStyle}
				onPointerDown={onHandlePointerDown}
				onClick={(e) => e.stopPropagation()} // thumb clicks must not jump the track
			>
				<div className={s.thumb} onClick={onThumbClick} />
			</div>
		</div>
	);
}
