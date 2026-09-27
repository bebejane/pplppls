/**
 * Pure geometry for the Waveform editor.
 *
 * Everything here is free of React, the engine and the DOM so the fiddly
 * time-to-pixel math lives in one place, is easy to reason about, and can be
 * exercised in isolation. Every function is defensive: a zero/NaN duration or
 * width can never produce `NaN`/`Infinity` coordinates. That matters because a
 * negative loop time crashes `AudioBufferSourceNode.start()`, so clamping is
 * load-bearing rather than cosmetic.
 */

/** A visible slice of the sound on the time axis, in seconds. */
export type ViewWindow = { start: number; end: number };

/** The live metrics the math is derived from (mirrors the component's `st` ref). */
export type WaveformMetrics = { duration: number; width: number };

/** Shortest zoom window (seconds); below this a zoom step snaps back to full. */
const MIN_VIEW = 0.002;

/** Clamp `v` into `[min, max]`. */
export const clamp = (v: number, min: number, max: number): number =>
	v < min ? min : v > max ? max : v;

/**
 * Clamp a time to `[0, duration]`. When `duration` is not positive the value is
 * only floored at 0 (matching the original `duration || v` guard).
 */
export const clampTime = (v: number, duration: number): number =>
	Math.max(0, Math.min(v, duration > 0 ? duration : v));

/**
 * Resolve a possibly-null/out-of-range zoom window to a valid one. An absent,
 * non-finite, inverted or out-of-bounds window falls back to the full
 * `[0, duration]` view.
 */
export const resolveView = (
	zoom: ViewWindow | null | undefined,
	duration: number,
): ViewWindow => {
	const full = duration > 0 ? duration : 0;
	if (
		!zoom ||
		!Number.isFinite(zoom.start) ||
		!Number.isFinite(zoom.end) ||
		zoom.end <= zoom.start ||
		zoom.end > full + 0.0001
	)
		return { start: 0, end: full };
	return { start: zoom.start, end: zoom.end };
};

/** Map a time to a (floored) pixel column within `view`. */
export const timeToPx = (t: number, view: ViewWindow, width: number): number => {
	const w = width > 0 ? width : 1;
	const len = view.end - view.start || 1;
	return Math.floor(((t - view.start) / len) * w);
};

/** Map a pixel column back to a time within `view`. */
export const pxToTime = (px: number, view: ViewWindow, width: number): number => {
	const w = width > 0 ? width : 1;
	const len = view.end - view.start || 1;
	return view.start + (px / w) * len;
};

/**
 * Compute the next zoom window, keeping the instant under pixel `x` pinned to
 * that same pixel (so repeated zooming in place stays anchored on the cursor),
 * clamped to `[0, duration]`. Returns `null` when there is nothing to zoom.
 */
export const zoomView = (
	view: ViewWindow,
	duration: number,
	zoomIn: boolean,
	x: number,
	width: number,
): ViewWindow | null => {
	if (!(duration > 0)) return null;
	const w = width > 0 ? width : 1;
	// fraction of the view under the cursor; the anchor keeps this constant
	const ratio = clamp(x / w, 0, 1);
	const len = view.end - view.start || duration;
	const step = zoomIn ? 0.75 : 1.25;
	const nextLen = len * step;
	// zooming far enough out (or into a sliver) snaps back to the full view
	if (nextLen >= duration || nextLen < MIN_VIEW) return { start: 0, end: duration };

	// the time under the cursor, which must land on the same pixel afterwards
	const anchor = view.start + ratio * len;
	let start = anchor - ratio * nextLen;
	let end = start + nextLen;
	// clamp to [0, duration] without changing the (already valid) window length
	if (start < 0) {
		start = 0;
		end = nextLen;
	}
	if (end > duration) {
		end = duration;
		start = duration - nextLen;
	}
	return { start, end };
};

/** A left-anchored selection box in pixels. */
export type SelectionBox = { x: number; width: number };

/**
 * Normalize a start/end pair (either may be undefined or in either order) into
 * a left-anchored box.
 */
export const selectionBox = (start?: number, end?: number): SelectionBox => {
	const s = start ?? 0;
	const e = end ?? 0;
	return { x: Math.min(s, e), width: Math.abs(e - s) };
};
