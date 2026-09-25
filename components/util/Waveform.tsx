'use client';

import Global from '@/lib/Global';
import moment from 'moment';
import { useCallback, useEffect, useRef, useState } from 'react';
import cn from 'classnames';
import s from './Waveform.module.scss';

type Selection = {
	start?: number;
	end?: number;
	width?: number;
	x?: number;
	active?: boolean;
	handleActive?: string | boolean;
	movingActive?: boolean;
	moveActive?: boolean;
	zoomInActive?: boolean;
	zoomOutActive?: boolean;
	movingX?: number;
	leaveLeft?: boolean;
	leaveRight?: boolean;
	handleLeave?: boolean;
};

const HANDLES = ['left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

export default function Waveform({
	id,
	color,
	bgcolor,
	markerColor,
	selectColor,
	loopStart,
	loopEnd,
	duration: durationProp = 0,
	enableElapsed,
	disabled,
	bits = 8,
	sampleRate = 44100,
	onSelection,
	onSelectionChange,
	onSelectionStart,
}: {
	id: string;
	spp?: number;
	color?: string;
	bgcolor?: string;
	markerColor?: string;
	selectColor?: string;
	loopStart?: number;
	loopEnd?: number;
	duration?: number;
	enableElapsed?: boolean;
	disabled?: boolean;
	bits?: number;
	sampleRate?: number;
	onSelection?: (sel: { start: number; end: number; time: number }) => void;
	onSelectionChange?: (sel: { start: number; end: number }) => void;
	onSelectionStart?: () => void;
}) {
	const waveformId = useRef(id + Date.now() + Math.floor(Math.random() * 1000)).current;

	const refContainer = useRef<HTMLDivElement>(null);
	const refCanvas = useRef<HTMLCanvasElement>(null);
	const refCanvasElapsed = useRef<HTMLCanvasElement>(null);
	const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
	const elapsedCtxRef = useRef<CanvasRenderingContext2D | null>(null);

	const [size, setSize] = useState({ width: 0, height: 0 });
	const [selection, setSelection] = useState<Selection>({});
	const [hover, setHover] = useState(false);
	const [position, setPosition] = useState(0);

	// mutable, non-render state
	const stateRef = useRef({
		duration: durationProp,
		loopStart,
		loopEnd,
		bits,
		sampleRate,
		color,
		bgcolor,
		markerColor: markerColor || color,
		init: false,
		disabled,
		enableElapsed,
		width: 0,
		height: 0,
		selection: {} as Selection,
	});
	const st = stateRef.current;
	st.duration = durationProp;
	st.loopStart = loopStart;
	st.loopEnd = loopEnd;
	st.bits = bits;
	st.sampleRate = sampleRate;
	st.color = color;
	st.bgcolor = bgcolor;
	st.markerColor = markerColor || color;
	st.enableElapsed = enableElapsed;
	st.disabled = disabled;

	const zoomRef = useRef<{ viewStart?: number; viewEnd?: number }>({});
	const waveformDataRef = useRef<any>(null);

	const setSel = (next: Selection) => {
		st.selection = next;
		setSelection(next);
	};

	const formatDuration = (sec: number, rate?: number) => {
		const time = moment.utc(moment.duration(rate ? sec / rate : sec, 'seconds').asMilliseconds());
		return time.format((time.hours() > 0 ? 'HH:' : '') + 'mm:ss:SSS');
	};

	/**
	 * Measure the container and set the canvas backing store to its pixel size
	 * directly (setting `.width`/`.height` on the canvas clears it, which is
	 * exactly what we want before a redraw). Returns false if not measurable.
	 */
	const measure = useCallback(() => {
		const container = refContainer.current;
		const canvas = refCanvas.current;
		if (!container || !canvas) return false;
		const width = Math.floor(container.clientWidth);
		const height = Math.floor(container.clientHeight);
		if (!width || !height) return false;
		if (canvas.width !== width) canvas.width = width;
		if (canvas.height !== height) canvas.height = height;
		st.width = width;
		st.height = height;
		setSize({ width, height });
		return true;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	/**
	 * Draw the waveform. Always operates on the canvas backing store that is
	 * already sized by `measure`, so it is safe to call right after measuring
	 * or from engine event callbacks.
	 */
	const updateWaveform = useCallback(
		(update: boolean, opt: { start?: number; end?: number } = {}) => {
			const canvas = refCanvas.current;
			const ctx = ctxRef.current;
			if (!canvas || !ctx) return;
			const width = canvas.width;
			const height = canvas.height;
			if (!width || !height) return;

			const duration = opt.start || opt.end ? opt.end! - opt.start! : st.duration;
			if (!duration) return;

			if (update) {
				const perSpp = Math.max(1, Math.floor((duration * st.sampleRate) / width));
				waveformDataRef.current = Global.engine
					? Global.engine.extractPeaks(id, perSpp, { bits: st.bits, ...opt })
					: null;
			}
			const data = waveformDataRef.current?.data;
			if (!data || !data.length) return;

			const center = height / 2;
			const left = data[0];
			const max = Math.max(...data[0]) || 1;
			const blockSize = Math.max(1, Math.floor(left.length / width));

			ctx.clearRect(0, 0, width, height);
			if (st.bgcolor) {
				ctx.fillStyle = st.bgcolor;
				ctx.fillRect(0, 0, width, height);
			}
			ctx.fillStyle = st.color || '#fff';
			for (let i = 0, x = 0; i < left.length + blockSize; i += blockSize, x++) {
				const end = Math.min(i + blockSize, left.length);
				const chunk = left.slice(i, Math.max(i + 1, end));
				const avg = Math.max(...chunk);
				if (avg === 0 || avg === -0) {
					ctx.fillRect(x, center, 1, 1);
				} else {
					const h = Math.max(1, Math.floor((Math.abs(avg) / max) * height));
					ctx.fillRect(x, center - h / 2, 1, h);
				}
			}
		},
		[id],
	);

	const onElapsed = useCallback((elapsed: number) => {
		const canvas = refCanvas.current;
		const elapsedCanvas = refCanvasElapsed.current;
		const ctx = ctxRef.current;
		const ectx = elapsedCtxRef.current;
		if (!canvas || !elapsedCanvas || !ctx || !ectx) return;
		const width = canvas.width;
		const height = canvas.height;
		// map the playhead through the visible (possibly zoomed) window; hide it
		// when the play position is outside that view
		let mk = 0;
		if (elapsed > 0 && st.duration > 0) {
			const px = timeToPx(elapsed);
			if (px >= 0 && px <= width) mk = px;
		}
		const mkw = 1;
		const m = 3;
		const w = 50;
		const h = 10;
		const x = width - w - m;
		const y = 0 + m;

		ectx.clearRect(0, 0, width, height);
		if (mk) {
			ectx.fillStyle = st.markerColor || st.color || '#fff';
			ectx.fillRect(mk, 0, mkw, height);
		}
		ctx.clearRect(x, y, w, h);
		if (st.bgcolor) {
			ctx.fillStyle = st.bgcolor;
			ctx.fillRect(x, y, w, h);
		}
		ctx.font = h + 'px Arial';
		ctx.fillStyle = st.color || '#fff';
		ctx.textAlign = 'right';
		ctx.textBaseline = 'bottom';
		ctx.fillText(formatDuration(elapsed), width - m, y + h);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const resetSelection = useCallback(() => {
		setSel({});
		setSelection({});
	}, []);

	const updateSelection = useCallback(
		(next: Selection, noCallback?: boolean) => {
			const { start, end } = next;
			// a selection may legitimately begin or end at 0 — only bail when
			// nothing is defined at all
			if (!st.duration || (start === undefined && end === undefined)) return;
			next.width = (end ?? 0) > (start ?? 0) ? (end ?? 0) - (start ?? 0) : (start ?? 0) - (end ?? 0);
			next.x = (end ?? 0) < (start ?? 0) ? (end ?? 0) : (start ?? 0);
			setSel(next);
			if (onSelectionChange && !noCallback)
				onSelectionChange({
					start: pxToTime(next.x!),
					end: pxToTime(next.x! + next.width!),
				});
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[onSelectionChange],
	);

	const resetWaveform = useCallback(() => {
		const canvas = refCanvas.current;
		const ctx = ctxRef.current;
		if (canvas && ctx) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		}
	}, []);

	// wire canvas contexts; measure + draw once layout is settled; observe resizes
	useEffect(() => {
		const canvas = refCanvas.current;
		const elapsedCanvas = refCanvasElapsed.current;
		if (canvas) ctxRef.current = canvas.getContext('2d');
		if (elapsedCanvas) elapsedCtxRef.current = elapsedCanvas.getContext('2d');

		const onChange = (dur: number) => {
			st.duration = dur;
			// new duration invalidates the zoom window — reset to full view
			zoomRef.current.viewStart = undefined;
			zoomRef.current.viewEnd = undefined;
			resetSelection();
			if (!measure()) return;
			updateWaveform(true);
		};
		const onState = (state: unknown, updated: any) => {
			if (updated.loop !== undefined && !updated.loop) resetSelection();
		};

		// modifier-state (Alt/⌘) toggles move/zoom modes; both keydown and keyup
		// must re-evaluate, exactly like the original
		const onKey = (e: KeyboardEvent) => {
			const sel = { ...st.selection };
			sel.moveActive = e.altKey && !e.ctrlKey;
			sel.zoomInActive = !e.altKey && e.ctrlKey;
			sel.zoomOutActive = e.altKey && e.ctrlKey;
			setSel(sel);
		};

		// starting a press outside the waveform (left/right gutter) anchors the
		// new selection at the near edge — drag over the waveform to extend it
		const armFromEdge = (edge: number) => {
			const sel = { ...st.selection };
			sel.start = edge;
			sel.end = edge;
			sel.active = true;
			sel.handleActive = false;
			sel.movingActive = false;
			sel.leaveLeft = false;
			sel.leaveRight = false;
			setSel(sel);
		};

		// selection dragged outside the container still completes on release
		const onMouseOutside = (e: MouseEvent) => {
			const sel = st.selection;

			if (e.type === 'mousedown') {
				const container = refContainer.current;
				if (!container || st.disabled || !st.duration) return;
				const rect = container.getBoundingClientRect();
				// only when the press is vertically within the waveform band and
				// horizontally outside it
				if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
					if (e.clientX < rect.left) armFromEdge(0);
					else if (e.clientX > rect.right) armFromEdge(st.width);
				}
				return;
			}

			if (!sel.leaveLeft && !sel.leaveRight) {
				// an armed press that never became a drag would stay "active"
				// forever — clear it on release
				if (e.type === 'mouseup' && sel.active && sel.start === sel.end)
					resetSelection();
				return;
			}
			if (sel.active || sel.handleActive || sel.movingActive) {
				if (e.type === 'mouseup') {
					if (sel.leaveLeft) sel.start = 0;
					else if (sel.leaveRight) sel.end = st.width;
					sel.handleActive = false;
					sel.active = false;
					sel.movingActive = false;
					setSel(sel); // persist + re-render so it stops tracking
					newSelection(sel);
				}
			}
		};

		Global.engine.on('change' + id, onChange);
		if (enableElapsed) {
			Global.engine.on('elapsed' + id, onElapsed);
			Global.engine.on('state' + id, onState);
		}
		window.addEventListener('keydown', onKey);
		window.addEventListener('keyup', onKey);
		window.addEventListener('mousedown', onMouseOutside);
		window.addEventListener('mouseup', onMouseOutside);

		let raf = 0;
		const firstDraw = () => {
			raf = 0;
			if (!measure()) return;
			// restore current loop selection after sizing
			if (st.loopStart || st.loopEnd) {
				updateSelection({
					start: timeToPx(st.loopStart || 0),
					end: timeToPx(st.loopEnd || 0),
				});
			}
			updateWaveform(true);
		};
		raf = window.requestAnimationFrame(firstDraw);

		// resize handling: observe the element (covers enter/leave fullscreen)
		let observer: ResizeObserver | undefined;
		let observerTimeout: ReturnType<typeof setTimeout> | null = null;
		if (typeof ResizeObserver !== 'undefined') {
			observer = new ResizeObserver(() => {
				if (observerTimeout) clearTimeout(observerTimeout);
				observerTimeout = setTimeout(() => {
					if (st.duration) {
						const win = viewWindow();
						measure();
						updateWaveform(true, { start: win.start, end: win.end });
					}
				}, 200);
			});
			if (refContainer.current) observer.observe(refContainer.current);
		}

		return () => {
			if (raf) cancelAnimationFrame(raf);
			if (observerTimeout) clearTimeout(observerTimeout);
			observer?.disconnect();
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('keyup', onKey);
			window.removeEventListener('mousedown', onMouseOutside);
			window.removeEventListener('mouseup', onMouseOutside);
			Global.engine.off('change' + id, onChange);
			if (enableElapsed) {
				Global.engine.off('elapsed' + id, onElapsed);
				Global.engine.off('state' + id, onState);
			}
			ctxRef.current = null;
			elapsedCtxRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [id, enableElapsed]);

	// visible time-window in seconds — [0, duration] unless zoomed
	const viewWindow = () => {
		const z = zoomRef.current;
		const full = st.duration || 0;
		if (
			z.viewStart === undefined ||
			z.viewEnd === undefined ||
			z.viewEnd <= z.viewStart ||
			z.viewEnd > full + 0.0001
		)
			return { start: 0, end: full };
		return { start: z.viewStart, end: z.viewEnd };
	};
	const timeToPx = (t: number) => {
		const { start, end } = viewWindow();
		const width = st.width || 1;
		const len = end - start || 1;
		return Math.floor(((t - start) / len) * width);
	};
	const pxToTime = (px: number) => {
		const { start, end } = viewWindow();
		const width = st.width || 1;
		const len = end - start || 1;
		return start + (px / width) * len;
	};

	const zoom = useCallback(
		(zoomIn: boolean, x: number) => {
			const full = st.duration || 0;
			if (!full) return;
			const width = st.width || 1;
			const p = Math.max(0, Math.min(1, x / width));
			const z = zoomRef.current;
			const win = viewWindow();
			const len = win.end - win.start || full;
			const step = zoomIn ? 0.75 : 1.25;
			// center the new view on the click point, clamped to [0, full]
			const center = win.start + len * p;
			const half = (len * step) / 2;
			let start = center - half;
			let end = center + half;
			if (start < 0) {
				end -= start;
				start = 0;
			}
			if (end > full) {
				start -= end - full;
				end = full;
			}
			if (start < 0) start = 0;
			if (end - start < 0.002) {
				start = 0;
				end = full;
			}
			z.viewStart = start;
			z.viewEnd = end;
			updateWaveform(true, { start, end });
			// re-project an existing loop selection into the new view
			if (st.loopStart || st.loopEnd) {
				updateSelection({
					start: timeToPx(st.loopStart || 0),
					end: timeToPx(st.loopEnd || 0),
				});
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	const newSelection = useCallback(
		(next: Selection) => {
			const clampTime = (v: number) =>
				Math.max(0, Math.min(v, st.duration || v));
			if (next.start !== next.end) {
				if (onSelection)
					onSelection({
						start: clampTime(pxToTime(next.x || 0)),
						end: clampTime(pxToTime((next.x || 0) + (next.width || 0))),
						time: clampTime(pxToTime(next.x || 0)),
					});
			} else {
				resetSelection();
				if (onSelection)
					onSelection({
						start: 0,
						end: 0,
						time: clampTime(pxToTime(next.x || 0)),
					});
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[onSelection, resetSelection],
	);

	const handleMouseEvents = useCallback(
		(e: React.MouseEvent) => {
			if (!st.duration || st.disabled) return;
			e.stopPropagation();
			const container = refContainer.current;
			if (!container) return;
			const width = st.width || container.clientWidth;
			// coordinates relative to the container itself (the old
			// `clientX - parent.offsetLeft` was wrong once the container is
			// offset/translated, e.g. inside the absolute fullscreen column);
			// clamp to the container so a drag that starts a few px outside
			// cannot produce a negative loop start (which crashes
			// AudioBufferSourceNode.start with a negative offset)
			const x = Math.max(0, Math.min(e.clientX - container.getBoundingClientRect().left, width));
			const type = e.type;
			// snapshot for change detection + a separate working copy to mutate
			// (aliasing them made the "nothing changed" guard always return)
			const prevSelection = { ...st.selection };
			const sel = { ...st.selection };

			if (type === 'mousemove') setPosition(x);
			if (type === 'mouseenter') {
				sel.leaveRight = false;
				sel.leaveLeft = false;
				setHover(true);
				updateSelection(sel);
			} else if (type === 'mouseleave') {
				if (sel.active || sel.handleActive || sel.movingActive) {
					if (x < width / 2) {
						sel.start = 0;
						sel.leaveLeft = true;
					} else {
						sel.end = width;
						sel.leaveRight = true;
					}
				}
				setHover(false);
				updateSelection(sel);
			}

			if (sel.moveActive) {
				if (type === 'mousedown') {
					sel.movingActive = true;
					sel.movingX = ((sel.x || 0) + (sel.width || 0)) / 2;
					e.stopPropagation();
				} else if (type === 'mouseup') {
					sel.movingActive = false;
					updateSelection(sel); // persist: stop tracking the mouse
					newSelection(sel);
				} else if (type === 'mousemove' && sel.movingActive) {
					const nx = x - (sel.movingX || 0) / 2;
					if (nx + (sel.width || 0) > width) {
						sel.start = width - (sel.width || 0);
						sel.end = width;
					} else if (nx > 0) {
						sel.start = nx;
						sel.end = (sel.start || 0) + (sel.width || 0);
					} else {
						sel.start = 0;
						sel.end = sel.width;
					}
				}
				updateSelection(sel);
				return;
			}
			if (sel.zoomInActive || sel.zoomOutActive) {
				if (type === 'mousedown') {
					e.preventDefault();
					zoom(sel.zoomInActive!, x);
				}
				return;
			}

			if (type === 'mousedown') {
				sel.start = x;
				sel.end = x;
				sel.active = true;
				if (onSelectionStart) onSelectionStart();
			} else if (type === 'mouseup') {
				sel.active = false;
				sel.handleActive = false;
				// persist the deactivated selection so the loopEND stops tracking
				// the mouse after release, then commit the loop points
				updateSelection(sel);
				newSelection(sel);
				return;
			} else if (type === 'mousemove') {
				if (sel.active && !sel.handleActive) sel.end = x;
				else if (!sel.active && sel.handleActive === 'right') sel.end = x;
				else if (!sel.active && sel.handleActive === 'left') sel.start = x;
			} else return;

			if (prevSelection.start === sel.start && prevSelection.end === sel.end) return;
			updateSelection(sel);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[newSelection, updateSelection, zoom, onSelectionStart],
	);

	const handleSelectionHandle = useCallback(
		(e: React.MouseEvent, dir: string) => {
			const container = refContainer.current;
			if (!container) return;
			const type = e.type;
			const sel = { ...st.selection };
			const x = Math.max(
				0,
				Math.min(e.clientX - container.getBoundingClientRect().left, container.clientWidth),
			);

			if (type === 'mousedown') {
				sel.active = false;
				sel.handleActive = dir;
				e.stopPropagation();
			} else if (type === 'mouseup') {
				sel.active = false;
				sel.handleActive = false;
			} else if (type === 'mouseleave') {
				sel.handleLeave = true;
			}
			updateSelection(sel);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[updateSelection],
	);

	const sel = selection;
	const selectionStyle = {
		width: (sel.width || 0) + 'px',
		left: (sel.x || 0) + 'px',
		backgroundColor: selectColor || undefined,
		cursor: sel.moveActive ? (sel.movingActive ? 'grabbing' : 'grab') : undefined,
	};
	const leftHandleStyle = { left: (sel.x || 0) + 'px' };
	const rightHandleStyle = { left: (sel.x || 0) + (sel.width || 0) + 'px' };
	const containerStyle = {
		cursor: sel.zoomInActive
			? 'zoom-in'
			: sel.zoomOutActive
				? 'zoom-out'
				: sel.handleActive
					? 'ew-resize'
					: 'default',
	};
	const cursorPosition = { left: position + 'px' };

	return (
		<div
			className={s.container}
			ref={refContainer}
			style={containerStyle}
			onMouseMove={handleMouseEvents}
			onMouseDown={handleMouseEvents}
			onMouseUp={handleMouseEvents}
			onMouseEnter={handleMouseEvents}
			onMouseLeave={handleMouseEvents}
			onContextMenu={(e) => {
				e.preventDefault();
				e.stopPropagation();
				const x =
					e.clientX -
					(refContainer.current?.getBoundingClientRect().left || 0);
				zoom(sel.zoomInActive!, x);
			}}
		>
			<canvas
				id={waveformId}
				width={size.width}
				height={size.height}
				ref={refCanvas}
				className={s.canvas}
				// route moves through the same handler instead of swallowing them:
				// otherwise the (full-size) canvas blocks drags whenever no
				// selection overlay exists yet, so release sees start===end and
				// the loop is never committed. handleMouseEvents stops
				// propagation itself, so the column still gets no rate changes.
				onMouseMove={handleMouseEvents}
			/>
			<canvas
				id={waveformId + 'elapsed'}
				width={size.width}
				height={size.height}
				ref={refCanvasElapsed}
				className={s.canvas}
			/>
			{hover && <div className={s.position} style={cursorPosition}></div>}
			{sel.start !== undefined || sel.end !== undefined ? (
				<div className={s.selectionContainer}>
					<div className={s.selection} style={selectionStyle}></div>
					{HANDLES.map((pos, idx) => (
						<div
							key={idx}
							className={cn(
								pos.includes('left')
									? pos === 'top-left'
										? s.handleTopLeft
										: pos === 'bottom-left'
											? s.handleBottomLeft
											: s.handleLeft
									: pos === 'top-right'
										? s.handleTopRight
										: pos === 'bottom-right'
											? s.handleBottomRight
											: s.handleRight,
							)}
							style={pos.includes('left') ? leftHandleStyle : rightHandleStyle}
							onMouseMove={(e) =>
								handleSelectionHandle(e, pos.includes('left') ? 'left' : 'right')
							}
							onMouseDown={(e) =>
								handleSelectionHandle(e, pos.includes('left') ? 'left' : 'right')
							}
							onMouseUp={(e) =>
								handleSelectionHandle(e, pos.includes('left') ? 'left' : 'right')
							}
						></div>
					))}
				</div>
			) : null}
		</div>
	);
}