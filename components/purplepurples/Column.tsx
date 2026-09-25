'use client';

import Global from '@/lib/Global';
import { useEffect, useRef, useState } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';
import moment from 'moment';
import cn from 'classnames';
import ColumnRecord from './ColumnRecord';
import ColumnTools from './ColumnTools';
import Waveform from '@/components/util/Waveform';
import type { UploadedFile as ImportedUploadedFile } from '@/components/util/FileUploader';
import s from './Column.module.scss';

export default function Column(props: ColumnProps) {
	const { id } = props;
	const ref = useRef<HTMLDivElement>(null);
	const pointRef = useRef<{ x: number; y: number } | null>(null);
	const lastRateRef = useRef<Record<string, number>>({});

	// merged audio state: props are the base, engine 'state'+id events update live
	const [st, setSt] = useState<Record<string, any>>(() => ({ ...props, locked: false }));

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
			if (updated.locked) lock();
		};
		Global.engine.on('loopend' + id, onLoopEnd);
		Global.engine.on('state' + id, onState);
		return () => {
			Global.engine.off('loopend' + id, onLoopEnd);
			Global.engine.off('state' + id, onState);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [id]);

	const lock = () => {
		const it = setInterval(() => {
			setSt((prev) => ({ ...prev, randDeg: Math.floor(Math.random() * 360) + 0 }));
		}, 10);
		setTimeout(() => {
			clearInterval(it);
			set({ randDeg: 0 });
		}, 300);
	};

	const triggerClick = () => {
		set({ click: true });
		setTimeout(() => set({ click: false }), 200);
	};

	const onClick = (e: React.MouseEvent) => {
		if (st.fullscreen) return;
		if (new Date().getTime() - lastClickRef.current < 200 && e.metaKey) {
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
		pointRef.current = { x: percX, y: percY };
		set({ point: pointRef.current });

		set({ click: true });
		setTimeout(() => set({ click: false }), 100);

		if (!e.altKey && !e.metaKey && !e.ctrlKey) {
			props.onPlay({ rate: Math.ceil(percX * 12) / 10 });
		} else if (e.altKey) {
			pointRef.current = null;
			return props.onStop();
		} else if (e.ctrlKey) {
			return props.onLocked(!st.locked);
		} else if (e.metaKey) {
			props.onFullscreen(!st.fullscreen);
		}
		lastClickRef.current = new Date().getTime();
	};

	const lastClickRef = useRef(0);

	const onDoubleClick = () => {};

	const onModify = (e: React.MouseEvent) => {
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
			const nextRate = parseFloat((percX * 2.0).toFixed(1));
			// only ship to the engine when the (0.1-step) value actually changes
			if (lastRateRef.current[id] !== nextRate) {
				lastRateRef.current[id] = nextRate;
				Global.engine.rate(id, nextRate);
			}
		}
	};

	const onLoopSelection = (selection: { start: number; end: number }) => {
		const loop = !(selection.start === 0 && selection.end === 0);
		Global.engine.loop(id, loop, selection);
		if (loop) Global.engine.play(id, { enableElapsed: true });
		else Global.engine.stop(id);
	};

	const onSwipe = (e: React.TouchEvent) => {
		const myLocation = e.changedTouches[0];
		const realTarget = document.elementFromPoint(myLocation.clientX, myLocation.clientY);
		if (realTarget) {
			const targetId = realTarget.id.replace('p-', '');
			onMove(e.touches[0], targetId);
		}
		e.preventDefault();
	};

	const onMove = (touch: React.Touch | Touch, targetId: string) => {
		// column-local move event (legacy path)
	};

	const onActive = (active: boolean) => {
		if (!active) set({ showGain: false, showPitch: false });
		props.onActive(active);
	};

	const formatDuration = (secs: number) => {
		const tempTime = moment.duration(secs * 1000);
		return (
			(tempTime.hours() ? tempTime.hours() + ':' : '') +
			tempTime.minutes() +
			':' +
			tempTime.seconds() +
			':' +
			tempTime.milliseconds().toFixed(0)
		);
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
		randDeg,
	} = st;

	const controls = props.controls;
	const rgba =
		'rgb(' + (playing ? '88' : '68') + ', 0, ' + (playing ? 150 : volume * 80 + 30) + ')';
	const rgba2 = 'rgb(' + (playing ? '104' : '68') + ', 0, ' + volume * 100 + ')';
	const rgba3 = 'rgb(104,158,205)';
	const deg = randDeg || volume * 100 * 3.6;

	const style: React.CSSProperties = {
		backgroundColor: click ? rgba3 : rgba,
		backgroundImage: locked
			? 'linear-gradient(' +
				deg +
				'deg, ' +
				rgba +
				' 25%, ' +
				rgba2 +
				' 25%, ' +
				rgba +
				' 50%, ' +
				rgba2 +
				' 50%, ' +
				rgba +
				' 75%,' +
				rgba2 +
				' 75%, ' +
				rgba +
				' 100%)'
			: undefined,
		backgroundSize: 'cover',
		boxSizing: 'border-box',
		opacity: click ? 0.4 : 0.7,
	};

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
			data-sound-point
			ref={ref}
			className={s.wrap}
			style={style}
			onMouseMove={(e) => onModify(e)}
			onMouseEnter={() => set({ hovering: true })}
			onMouseLeave={() => set({ hovering: false })}
			onMouseDown={(e) => !e.ctrlKey && onClick(e)}
			onContextMenu={(e) => {
				e.preventDefault();
				e.ctrlKey = true;
				onClick(e);
			}}
		>
			{pointRef.current && (
				<div
					key={JSON.stringify(pointRef.current)}
					className={cn(s.clickPoint, playing && !loopEndTrigger && s.clickPointPlaying)}
					style={{
						left: pointRef.current.x * 100 + '%',
						top: pointRef.current.y * 100 + '%',
					}}
					onMouseDown={(e) => {
						//e.stopPropagation();
						//props.onLocked(!locked);
					}}
				></div>
			)}
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
					onPlay={() => props.onPlay({ enableElapsed: fullscreen })}
					onStop={() => props.onStop()}
					onSampleRecord={(on) => props.onSampleRecord(on)}
					onMute={(on) => props.onMute(on)}
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

			<div className={s.loading}>{!ready && <AiOutlineLoading />}</div>
		</div>
	);
}

export interface ColumnProps {
	id: string;
	controls: boolean;
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
