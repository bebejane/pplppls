'use client';

import { useRef } from 'react';
import {
	pxToTime as geometryPxToTime,
	resolveView,
	timeToPx as geometryTimeToPx,
	zoomView,
	type ViewWindow,
	type WaveformMetrics,
} from './waveform-geometry';

/**
 * Owns the Waveform's visible time-window (zoom) and the time-to-pixel mapping
 * derived from it.
 *
 * The returned functions read the live metrics/zoom refs on every call, so they
 * stay correct even when a long-lived event handler (the component memoizes
 * several with empty dependency arrays) captures an early instance.
 */
export function useWaveformView(metrics: { current: WaveformMetrics }) {
	const zoomRef = useRef<ViewWindow | null>(null);

	/** The visible window: `[0, duration]` unless zoomed. */
	const view = (): ViewWindow => resolveView(zoomRef.current, metrics.current.duration);

	const timeToPx = (t: number): number =>
		geometryTimeToPx(t, view(), metrics.current.width);

	const pxToTime = (px: number): number =>
		geometryPxToTime(px, view(), metrics.current.width);

	/**
	 * Apply a zoom step centered on pixel `x`, persisting the new window.
	 * Returns the new window, or `null` when there is nothing to zoom.
	 */
	const zoom = (zoomIn: boolean, x: number): ViewWindow | null => {
		const { duration, width } = metrics.current;
		const next = zoomView(view(), duration, zoomIn, x, width);
		if (next) zoomRef.current = next;
		return next;
	};

	/** Drop any zoom, returning to the full `[0, duration]` view. */
	const reset = () => {
		zoomRef.current = null;
	};

	return { view, timeToPx, pxToTime, zoom, reset };
}
