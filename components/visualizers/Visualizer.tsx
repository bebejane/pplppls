'use client';

import Global from '@/lib/Global';
import { useCallback, useEffect, useRef, useState } from 'react';
import s from './Visualizer.module.scss';

export interface PaintSizes {
	width: number;
	height: number;
	color?: string;
	colorLeft?: string;
	colorRight?: string;
}

export default function Visualizer({
	id,
	type,
	color = 'rgba(0,0,0,1.0)',
	colorBackground,
	colorLeft,
	colorRight,
	options = {},
	ready,
	clear = true,
	paint,
}: {
	id: string;
	type: string;
	color?: string;
	colorBackground?: string;
	colorLeft?: string;
	colorRight?: string;
	options?: Record<string, unknown>;
	ready?: boolean;
	clear?: boolean;
	paint: (ctx: CanvasRenderingContext2D, data: unknown, opt: unknown, sizes: PaintSizes) => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const analyserRef = useRef<any>(null);
	const [size, setSize] = useState({ width: 0, height: 0 });
	const sizeRef = useRef({ width: 0, height: 0 });

	const draw = useCallback(
		(data: unknown, opt: unknown) => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const ctx = canvas.getContext('2d');
			if (!ctx) return;
			const { width, height } = sizeRef.current;
			if (clear) ctx.clearRect(0, 0, width, height);
			if (colorBackground) {
				ctx.fillStyle = colorBackground;
				ctx.fillRect(0, 0, width, height);
			}
			paint(ctx, data, opt, { width, height, color, colorLeft, colorRight });
		},
		[clear, colorBackground, color, colorLeft, colorRight, paint],
	);

	// Keep the latest draw/options behind refs so the analyser subscription
	// below stays stable: `paint` is an inline arrow function in the wrapper
	// components (new identity every render), so depending on `draw` here would
	// tear down and rebuild the analyser connection on every re-render (e.g.
	// every mouse-move across the grid), spamming console + restarting the
	// analysis interval.
	const drawRef = useRef(draw);
	const optionsRef = useRef(options);
	useEffect(() => {
		drawRef.current = draw;
	});
	useEffect(() => {
		optionsRef.current = options;
	});

	// subscribe to the analyser
	useEffect(() => {
		if (!Global.engine || !ready) return;
		const analyser = Global.engine.analyse(id, type, optionsRef.current);
		analyserRef.current = analyser;
		if (!analyser) return;
		const listener = (data: unknown, opt: unknown) => drawRef.current(data, opt);
		analyser.addEventListener(type, optionsRef.current, listener);
		return () => {
			analyser.removeEventListener(type, listener);
			// release the per-sound analyser the engine created for this
			// subscription (shared input/output analysers are left alone)
			Global.engine.removeAnalyser(analyser);
			analyserRef.current = null;
		};
	}, [id, type, ready]);

	// measure and track resize
	useEffect(() => {
		const updateSize = () => {
			const el = containerRef.current;
			if (!el) return;
			const width = el.clientWidth;
			const height = el.clientHeight;
			sizeRef.current = { width, height };
			setSize({ width, height });
		};
		updateSize();
		window.addEventListener('resize', updateSize);
		return () => window.removeEventListener('resize', updateSize);
	}, []);

	return (
		<div className={s.container} ref={containerRef}>
			<canvas
				ref={canvasRef}
				width={size.width}
				height={size.height}
				className={s.canvas}
			/>
		</div>
	);
}