'use client';

import s from './Elapsed.module.scss';
import Global from '@/lib/global';
import moment from 'moment';
import { useCallback, useEffect, useRef } from 'react';

/** elapsed-readout chip size, in CSS pixels */
const CHIP_W = 52;
const CHIP_H = 12;

/**
 * Small per-strip elapsed-time readout: a canvas that redraws the sound's
 * playhead (`elapsed<id>`) as `mm:ss:SSS` in a right-aligned chip.
 *
 * Extracted from `Waveform`, whose layout is two canvases (the waveform plus an
 * elapsed overlay). This is the elapsed canvas *alone* — the old copy still
 * measured `refCanvas`, which was never rendered here, so it never sized or
 * drew anything.
 */
export default function Elapsed({
	id,
	color = '#000',
	bgColor = '#fff',
	enableElapsed,
}: {
	id: string;
	color?: string;
	bgColor?: string;
	enableElapsed: boolean;
}) {
	const refContainer = useRef<HTMLDivElement>(null);
	const refCanvas = useRef<HTMLCanvasElement>(null);
	const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
	// last reported playhead, so a resize can repaint without waiting for the
	// next `elapsed` tick
	const elapsedRef = useRef(0);

	const formatDuration = (sec: number, rate?: number) => {
		const time = moment.utc(moment.duration(rate ? sec / rate : sec, 'seconds').asMilliseconds());
		return time.format((time.hours() > 0 ? 'HH:' : '') + 'mm:ss:SSS');
	};

	const draw = useCallback(
		(elapsed: number) => {
			const canvas = refCanvas.current;
			const ctx = ctxRef.current;
			if (!canvas || !ctx) return;
			const width = canvas.width;
			const height = canvas.height;
			if (!width || !height) return;

			ctx.clearRect(0, 0, width, height);
			const w = Math.min(CHIP_W, width);
			const h = CHIP_H;
			const x = Math.round((width - w) / 2);
			const y = Math.round((height - h) / 2);
			if (bgColor) {
				ctx.fillStyle = bgColor;
				ctx.fillRect(x, y, w, h);
			}
			// centre the glyphs' ink on the canvas/chip centre. `textBaseline =
			// 'middle'` centres the font em box, which sits digits noticeably
			// high (they have no descender), so use the measured ink extents.
			const text = formatDuration(elapsed);
			ctx.font = h + 'px Arial';
			const m = ctx.measureText(text);
			const asc = m.actualBoundingBoxAscent || h / 2;
			const desc = m.actualBoundingBoxDescent || 0;
			ctx.fillStyle = color || '#fff';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'alphabetic';
			ctx.fillText(text, width / 2, height / 2 + (asc - desc) / 2);
		},
		[color, bgColor],
	);

	/** Size the canvas backing store to the container (CSS pixels). */
	const measure = useCallback(() => {
		const container = refContainer.current;
		const canvas = refCanvas.current;
		if (!container || !canvas) return false;
		const width = Math.floor(container.clientWidth);
		const height = Math.floor(container.clientHeight);
		if (!width || !height) return false;
		if (canvas.width !== width) canvas.width = width;
		if (canvas.height !== height) canvas.height = height;
		return true;
	}, []);

	useEffect(() => {
		const canvas = refCanvas.current;
		if (canvas) ctxRef.current = canvas.getContext('2d');
		measure();
		draw(elapsedRef.current); // 00:00:000 until the first tick

		// the strip resizes with the window / mixer layout
		const ro = new ResizeObserver(() => {
			measure();
			draw(elapsedRef.current);
		});
		if (refContainer.current) ro.observe(refContainer.current);

		const onElapsed = (elapsed: number) => {
			elapsedRef.current = typeof elapsed === 'number' && elapsed > 0 ? elapsed : 0;
			draw(elapsedRef.current);
		};
		if (enableElapsed) Global.engine.on('elapsed' + id, onElapsed);

		return () => {
			ro.disconnect();
			if (enableElapsed) Global.engine.off('elapsed' + id, onElapsed);
			ctxRef.current = null;
		};
	}, [id, enableElapsed, measure, draw]);

	return (
		<div className={s.elapsed} ref={refContainer}>
			<canvas ref={refCanvas} className={s.canvas} />
		</div>
	);
}
