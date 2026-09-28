'use client';

import s from './Column.module.scss';
import Global from '@/lib/global';
import { useEffect, useRef, useState } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';
import cn from 'classnames';
import ColumnRecord from './ColumnRecord';
import ColumnTools from './ColumnTools';
import Waveform from '@/components/util/Waveform';
import GradientVisualizer from '@/components/visualizers/GradientVisualizer';
import type { UploadedFile as ImportedUploadedFile } from '@/components/util/FileUploader';

export default function Column(props: ColumnProps) {
	const { id } = props;
	const ref = useRef<HTMLDivElement>(null);
	const lastPitchRef = useRef<Record<string, number>>({});

	// merged audio state: props are the base, engine 'state'+id events update live
	const [st, setSt] = useState<Record<string, any>>(() => ({
		...props,
		locked: false,
		soloId: null,
	}));

	const set = (patch: Record<string, any>) => setSt((prev) => ({ ...prev, ...patch }));

	// prop sync: apply only keys the parent actually passes, keep engine-driven
	// values (volume/rate/playing/... arrive via engine 'state'+id events) and
	// local UI fields intact — wiping them made every column render identically.
	// `locked` is excluded too: lock is owned by the engine (toggled from the
	// tools/point/onReset without the parent knowing), so the parent's stale
	// `locked` prop must not clobber the live engine state on re-renders.
	useEffect(() => {
		setSt((prev) => {
			const next = { ...prev };
			for (const k of Object.keys(props)) {
				if (k === 'locked') continue;
				const v = (props as unknown as Record<string, unknown>)[k];
				if (v !== undefined) next[k] = v;
			}
			return next;
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props]);

	// measure + engine subscriptions
	useEffect(() => {
		if (ref.current) set({ height: ref.current.clientHeight, width: ref.current.clientWidth });

		const onLoopEnd = () => {
			set({ loopEndTrigger: true });
			setTimeout(() => set({ loopEndTrigger: false }), 50);
		};
		const onState = (state: Record<string, any>, updated: Record<string, any>) => {
			set({ ...state });
			if (updated.playing) triggerClick();
		};
		const onSolo = (id: string | number, solo: boolean) => {
			//console.log(id, solo);
			set({ soloId: id && solo ? id : null });
		};
		Global.engine.on('loopend' + id, onLoopEnd);
		Global.engine.on('state' + id, onState);
		Global.engine.on('solo', onSolo);
		return () => {
			Global.engine.off('loopend' + id, onLoopEnd);
			Global.engine.off('state' + id, onState);
			Global.engine.off('solo', onSolo);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [id]);

	useEffect(() => {
		if (!st.hovering) return;
		const to = setTimeout(() => set({ hovering: false }), 2000);
		return () => clearTimeout(to);
	}, [st.hovering]);

	const triggerClick = () => {
		set({ click: true });
		setTimeout(() => set({ click: false }), 200);
	};

	const onDoubleClick = () => {
		//Global.engine.lock(id, !st.locked);
	};

	const onClick = (e: React.MouseEvent) => {
		if (st.fullscreen) return;
		if (new Date().getTime() - lastClickRef.current < 200) {
			return onDoubleClick();
		}
		const el = ref.current;
		if (!el) return;
		const l = el.offsetLeft;
		const t = el.offsetTop;
		const height = el.clientHeight;
		const width = el.clientWidth;
		const percX = Math.abs((e.pageX - l) / width);
		const percY = Math.abs((e.pageY - t) / height);
		// keep the last 4 click spots so the column shows a click history
		if (!st.locked) {
			const last4 = [{ x: percX, y: percY }, ...(st.points || [])].slice(0, 4);
			set({ points: last4 });
		}
		set({ click: true });
		setTimeout(() => set({ click: false }), 100);

		if (!e.altKey && !e.metaKey && !e.ctrlKey) {
			props.onPlay({ rate: Math.ceil(percX * 12) / 10 });
		} else if (e.altKey) {
			set({ points: [] });
			return props.onStop();
		} else if (e.ctrlKey) {
			return props.onLocked(!st.locked);
		} else if (e.metaKey) {
			props.onFullscreen(!st.fullscreen);
		}
		lastClickRef.current = new Date().getTime();
	};

	const lastClickRef = useRef(0);

	const onModify = (e: React.MouseEvent) => {
		// while the automation take is playing back, live mouse-move writes are
		// ignored so they don't fight the recording
		if (Global.engine.automation.playing) return;
		if (st.fullscreen) return;
		const el = ref.current;
		if (!el) return;
		if (e.ctrlKey && !st.locked) {
			const percY = 100 - ((e.pageY - el.offsetTop) / el.clientHeight) * 100;
			const percX = Math.abs((e.pageX - el.offsetLeft) / el.clientWidth);
			const loopStart = percX * st.duration;
			let loopEnd = (percY / 100) * st.duration;
			loopEnd = loopEnd < loopStart ? loopStart : loopEnd;
			return props.onLoop(st.loop, { start: loopStart, end: loopEnd });
		} else if (!st.locked) {
			const percX = Math.abs((e.pageX - el.offsetLeft) / el.clientWidth);
			const nextPitch = parseFloat((percX * 24 * 2 - 24).toFixed(1));

			if (lastPitchRef.current[id] !== nextPitch) {
				lastPitchRef.current[id] = nextPitch;
				Global.engine.pitch(id, nextPitch);
			}
		}
	};

	const onLock = (e: React.MouseEvent) => {
		if (st.fullscreen) return;
		Global.engine.lock(id, !st.locked);
	};

	const onLoopSelection = (selection: { start: number; end: number }) => {
		const loop = selection.start && selection.end ? true : false;
		console.log(loop, selection);

		Global.engine.loop(id, loop, selection);
		Global.engine.play(id);
	};

	const activePointers = useRef<Set<number>>(new Set());

	const handlePointer = (e: React.PointerEvent) => {
		const type = e.type;
		console.log(type, e.pointerType);
		if (type === 'pointerdown') {
			activePointers.current?.add(e.pointerId);

			// Check if exactly two fingers are down simultaneously
			if (activePointers.current?.size === 2) {
				console.log('Two-finger tap/gesture initiated!');
				// Trigger your two-finger logic here
			}
		} else if (type === 'pointerup') {
			activePointers.current?.delete(e.pointerId);
		} else if (type === 'pointercancel') {
			activePointers.current?.clear();
		}
	};

	const {
		rate = 1.0,
		volume = 0,
		playing,
		filename,
		loading,
		loaded,
		ready,
		error,
		sampling,
		isSampling,
		muted,
		loop,
		loopStart,
		loopEnd,
		duration,
		click,
		locked,
		loopEndTrigger,
		fullscreen,
		points,
		soloId,
	} = st;

	const controls = props.controls;
	const rgba = [
		'rgb(' + (playing ? '88' : '68') + ', 0, ' + (playing ? 150 : volume * 80 + 30) + ')',
		'rgb(' + (playing ? '104' : '68') + ', 0, ' + volume * 100 + ')',
		'rgb(104,158,205)',
	];
	const deg = volume * 100 * 3.6;
	const style: React.CSSProperties = {
		backgroundColor: click ? rgba[2] : rgba[0],
		boxSizing: 'border-box',
		opacity: click || (soloId && soloId !== id) ? 0.4 : 0.7,
	};
	//console.log(solo);
	if (fullscreen) {
		style.position = 'absolute';
		style.opacity = 1.0;
		style.zIndex = 10;
		style.padding = '30px';
		style.backgroundColor = 'rgb(0,0,0)';
	}

	return (
		<div
			id={id}
			className={s.wrap}
			data-sound-point
			ref={ref}
			style={style}
			// onPointerDown={handlePointer}
			// onPointerUp={handlePointer}
			// onPointerCancel={handlePointer}
			onMouseMove={(e) => {
				onModify(e);
				// only re-render on the first move of a hover
				if (!st.hovering) set({ hovering: true });
			}}
			onMouseEnter={() => set({ hovering: true })}
			onMouseLeave={() => set({ hovering: false })}
			onMouseDown={(e) => !e.ctrlKey && onClick(e)}
			onContextMenu={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onLock(e);
			}}
		>
			{locked && (
				<div className={s.gradientVisualizer} data-gradient-visualizer>
					<GradientVisualizer
						id={id}
						deg={deg}
						color={rgba[0]}
						colorLeft={rgba[1]}
						ready={ready && !props.hidden}
					/>
				</div>
			)}
			{(points || []).map((pt: { x: number; y: number }, i: number) => (
				<div
					key={`${i}:${pt.x}:${pt.y}`}
					data-click-point
					className={cn(
						i === 0 ? s.clickPoint : s.clickPointPrev,
						i === 0 && playing && !loopEndTrigger && s.clickPointPlaying,
					)}
					style={{
						left: pt.x * 100 + '%',
						top: pt.y * 100 + '%',
					}}
				></div>
			))}
			<div className={s.point}>
				<ColumnRecord
					id={id}
					sampling={sampling}
					isSampling={isSampling}
					loaded={loaded}
					loading={loading}
					error={error}
					onUpload={(buffer, filename) => props.onUpload(buffer, filename)}
					onMultiUpload={(files) => props.onMultiUpload(files)}
					onSampleRecord={(on) => props.onSampleRecord(on)}
					onCancelSampleRecord={() => props.onCancelSampleRecord()}
				/>
				{fullscreen && !sampling && (
					<Waveform
						id={id}
						spp={20}
						color={'#d77ab8'}
						duration={duration}
						loopStart={loop ? loopStart : undefined}
						loopEnd={loop ? loopEnd : undefined}
						enableElapsed={true}
						selectColor={'rgba(255,255,255,0.2)'}
						onSelection={(selection) => onLoopSelection(selection)}
					/>
				)}
			</div>

			{controls && ready && (
				<ColumnTools
					id={id}
					playing={playing}
					sampling={sampling}
					isSampling={isSampling}
					loop={loop}
					muted={muted}
					locked={locked}
					fullscreen={fullscreen}
					midiMapMode={st.midiMapMode}
					effectsEnabled={st.effectsEnabled}
					midiNote={st.midiNote}
					reversed={st.reversed}
					solo={st.solo}
					hovering={st.hovering}
					volume={volume}
					onPlay={() => props.onPlay({ enableElapsed: fullscreen })}
					onStop={() => props.onStop()}
					onSampleRecord={(on) => props.onSampleRecord(on)}
					onMute={(on) => props.onMute(on)}
					onVolume={(vol) => props.onVolume(vol)}
					onLoop={(on) => props.onLoop(on)}
					onReverse={(on) => props.onReverse(on)}
					onEffectsEnabled={(on) => props.onEffectsEnabled(on)}
					onMidiMapMode={(on) => props.onMidiMapMode(on)}
					onReset={() => {
						Global.engine.reset(id);
						Global.engine.lock(id, true);
					}}
					onSolo={(on) => props.onSolo(on)}
					onFullscreen={(on) => {
						set({ fullscreen: on });
						props.onFullscreen(on);
					}}
					onLocked={(on) => props.onLocked(on)}
				/>
			)}
			{/* <div className={s.visualizer}>
				<VolumeVisualizer id={id} color={'#b750e7'} ready={ready} />
			</div> */}
			<div className={s.loading}>{!ready && <AiOutlineLoading />}</div>
		</div>
	);
}

export interface ColumnProps {
	id: string;
	controls: boolean;
	/** True while another view (the mixer) fully covers the grid — its audio
	 *  visuals don't need to keep analysing. */
	hidden?: boolean;
	midiSupported?: boolean;
	fullscreen?: boolean;
	locked?: boolean;
	sampling?: boolean;
	isSampling?: boolean | string | null;
	heat?: number;
	ready?: boolean;
	loaded?: boolean;
	loading?: boolean;
	error?: boolean | string;
	playing?: boolean;
	muted?: boolean;
	loop?: boolean;
	loopStart?: number;
	loopEnd?: number;
	duration?: number;
	volume?: number;
	rate?: number;
	reversed?: boolean;
	midiMapMode?: boolean;
	midiNote?: number;
	effectsEnabled?: boolean;
	solo?: boolean;
	filename?: string;
	onActive: (active: boolean) => void;
	onPlay: (opt?: Record<string, unknown>) => void;
	onStop: () => void;
	onPause: () => void;
	onUpload: (buffer: ArrayBuffer, filename: string) => void;
	onMultiUpload: (files: ImportedUploadedFile[]) => void;
	onSolo: (on: boolean) => void;
	onVolume: (vol: number) => void;
	onRate: (rate: number) => void;
	onLoop: (on: boolean, offset?: Record<string, number>) => void;
	onMute: (on: boolean) => void;
	onSampleRecord: (on: boolean) => void;
	onCancelSampleRecord: () => void;
	onEffectBypass: (type: string, active: boolean) => void;
	onEffectParams: (type: string, params: unknown) => void;
	onDownload: () => void;
	onLocked: (on: boolean) => void;
	onMidiMapMode: (on: boolean, unmap?: boolean) => void;
	onReverse: (on: boolean) => void;
	onEffectsEnabled: (on: boolean) => void;
	onFullscreen: (on: boolean) => void;
}
