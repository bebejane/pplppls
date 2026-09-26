'use client';

import Global from '@/lib/Global';
import { useEffect, useRef, useState } from 'react';
import Slider from 'react-input-slider';
import cn from 'classnames';
import VolumeVisualizer from '@/components/visualizers/VolumeVisualizer';
import {
	IconPlay,
	IconStop,
	IconRecord,
	IconVolume,
	IconSolo,
	IconReverse,
	IconLoop,
	IconEffects,
} from '@/components/icons/Icons';
import s from './MixerChannelStrip.module.scss';

/**
 * One channel strip of the Mixer view. Live values are engine-authoritative:
 * the strip mirrors the sound's `state<id>` events (same contract as Column),
 * seeded from the model params so nothing pops in before the first event.
 * The strip only ever calls back into the parent, which owns the shared
 * sampling state and the engine calls.
 */
export default function MixerChannelStrip({
	id,
	label,
	filename,
	params,
	init,
	sampling,
	isSampling,
	onVolume,
	onMute,
	onSolo,
	onSampleRecord,
	onPan,
	onRate,
	onReverse,
	onLoop,
	onEffects,
	onPlay,
	onStop,
}: MixerChannelStripProps) {
	const [st, setSt] = useState<Record<string, any>>(() => ({
		playing: false,
		muted: !!params?.muted,
		solo: !!params?.solo,
		loop: !!params?.loop,
		reversed: !!params?.reversed,
		effects: Array.isArray(params?.effects) ? params.effects : [],
		volume: typeof params?.volume === 'number' ? params.volume : 0.5,
		pan: typeof params?.pan === 'number' ? params.pan : 0,
		rate: typeof params?.rate === 'number' ? params.rate : 1,
		filename: params?.filename || filename || '',
	}));
	const [samplingProgress, setSamplingProgress] = useState<Record<string, any>>({});

	useEffect(() => {
		const onState = (state: Record<string, any>) => setSt((prev) => ({ ...prev, ...state }));
		Global.engine.on('state' + id, onState);
		return () => {
			Global.engine.off('state' + id, onState);
		};
	}, [id]);

	// only the channel that is sampling needs the progress feed (avoids piling
	// up N global listeners, like ColumnTools)
	useEffect(() => {
		if (!sampling) return;
		const onProgress = (sid: string, prog: unknown) => {
			if (sid !== id) return;
			setSamplingProgress({ ...(prog as object) });
		};
		Global.engine.on('samplingprogress', onProgress);
		return () => {
			Global.engine.off('samplingprogress', onProgress);
		};
	}, [sampling, id]);

	// the sound is usable when the app is initialized or its own state event
	// said so — the mixer can open long after the last `state` event, so we
	// can't wait for one to enable the strip
	const ready = init || !!st.ready;
	const { volume = 0, pan = 0, rate = 1, muted, solo, loop, reversed, playing } = st;
	const processing = sampling && samplingProgress.processing && !samplingProgress.recording;
	const fxCount = Array.isArray(st.effects) ? st.effects.length : 0;

	// the fader has no intrinsic wheel handling, and the mixer's horizontal
	// scroller would otherwise eat the wheel — scroll over the fader to nudge
	// the level (refs keep the native listener subscribed across renders)
	const faderRef = useRef<HTMLDivElement>(null);
	const volumeRef = useRef(volume);
	const onVolumeRef = useRef(onVolume);
	volumeRef.current = volume;
	onVolumeRef.current = onVolume;
	useEffect(() => {
		const el = faderRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			// normalise line/page deltas to pixels (~100px per mouse notch)
			const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1;
			const step = Math.max(-0.1, Math.min(0.1, (e.deltaY * unit) / 2500));
			const next = Math.min(1, Math.max(0, volumeRef.current + step));
			volumeRef.current = next;
			onVolumeRef.current(next);
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	}, []);

	return (
		<div className={cn(s.strip, !ready && s.dim)}>
			<div className={s.label} title={label}>
				{label}
			</div>

			<div className={s.faderRow}>
				<div className={s.meter} data-tip data-for={'tt-mixer-meter'}>
					{sampling ? (
						// while sampling, the meter monitors the input being recorded
						<VolumeVisualizer id={'input'} color={'#ff3b30'} ready={ready} />
					) : (
						<VolumeVisualizer id={id} color={'#ddace2'} ready={ready} />
					)}
				</div>
				<div ref={faderRef} className={s.fader} data-tip data-for={'tt-mixer-volume'}>
					<Slider
						axis='y'
						y={Math.round(Math.min(1, Math.max(0, volume)) * 100)}
						ymin={0}
						ymax={100}
						ystep={1}
						yreverse
						onChange={({ y }) => onVolume(Math.min(1, Math.max(0, y / 100)) || 0)}
						styles={faderStyle}
					/>
				</div>
			</div>

			<button
				type='button'
				className={cn(s.btn, muted && s.on)}
				data-tip
				data-for={'tt-mixer-mute'}
				onClick={() => onMute(!muted)}
			>
				<IconVolume />
				MUTE
			</button>
			<button
				type='button'
				className={cn(s.btn, solo && s.on)}
				data-tip
				data-for={'tt-mixer-solo'}
				onClick={() => onSolo(!solo)}
			>
				<IconSolo />
				SOLO
			</button>
			<button
				type='button'
				className={cn(s.btn, sampling && (processing ? s.processing : s.recOn))}
				// one input recorder: only the channel that is sampling can be
				// pressed (start/stop) — the rest are disabled, not lit
				disabled={!sampling && isSampling}
				data-tip
				data-for={'tt-mixer-rec'}
				onClick={() => onSampleRecord(!sampling)}
			>
				<IconRecord />
				REC
			</button>

			<div className={s.toggles}>
				<button
					type='button'
					className={cn(s.btn, reversed && s.on)}
					data-tip
					data-for={'tt-mixer-reverse'}
					onClick={() => onReverse(!reversed)}
				>
					<IconReverse />
				</button>
				<button
					type='button'
					className={cn(s.btn, loop && s.on)}
					data-tip
					data-for={'tt-mixer-loop'}
					onClick={() => onLoop(!loop)}
				>
					<IconLoop />
				</button>
				<button
					type='button'
					className={cn(s.btn, fxCount > 0 && s.on)}
					data-tip
					data-for={'tt-mixer-effects'}
					onClick={onEffects}
				>
					<IconEffects />
					{fxCount > 0 && <span className={s.badge}>{fxCount}</span>}
				</button>
			</div>

			<div className={s.panRow} data-tip data-for={'tt-mixer-pan'}>
				<span className={s.panMark}>L</span>
				<div className={s.panSlider}>
					<Slider
						axis='x'
						x={Math.round(((Math.min(90, Math.max(-90, pan)) + 90) / 180) * 100)}
						xmin={0}
						xmax={100}
						xstep={1}
						onChange={({ x }) => onPan(Math.round((x / 100) * 180 - 90))}
						styles={panStyle}
					/>
				</div>
				<span className={s.panMark}>R</span>
			</div>

			{/* rate: 0x … 1x (default) … 2x; shares the horizontal-slider styles */}
			<div className={s.panRow} data-tip data-for={'tt-mixer-rate'}>
				<span className={s.panMark}>0</span>
				<div className={s.panSlider}>
					<Slider
						axis='x'
						x={Math.round((Math.min(2, Math.max(0, rate)) / 2) * 100)}
						xmin={0}
						xmax={100}
						xstep={1}
						onChange={({ x }) => onRate(Math.round((x / 50) * 100) / 100)}
						styles={panStyle}
					/>
				</div>
				<span className={s.panMark}>2</span>
			</div>

			<button
				type='button'
				className={cn(s.btn, s.play, playing && s.on)}
				data-tip
				data-for={'tt-mixer-play'}
				onClick={() => (playing ? onStop() : onPlay())}
			>
				{playing ? <IconStop /> : <IconPlay />}
				{playing ? 'STOP' : 'PLAY'}
			</button>
		</div>
	);
}

export interface MixerChannelStripProps {
	id: string;
	label: string;
	/** Model file name */
	filename?: string;
	/** The model params for this cell (Sound.getSaveState()) — seeds the strip. */
	params?: Record<string, any>;
	/** App/model initialized — enables the strip and its meter. */
	init?: boolean;
	/** This channel is the one currently sampling. */
	sampling?: boolean;
	/** Some channel is sampling (this one is not). */
	isSampling?: boolean;
	onVolume: (vol: number) => void;
	onMute: (on: boolean) => void;
	onSolo: (on: boolean) => void;
	onSampleRecord: (on: boolean) => void;
	onPan: (deg: number) => void;
	/** Playback rate, 0x…2x (1x = original). */
	onRate: (rate: number) => void;
	onReverse: (on: boolean) => void;
	onLoop: (on: boolean) => void;
	/** Open the effect-chain editor for this channel. */
	onEffects: () => void;
	onPlay: () => void;
	onStop: () => void;
}

const faderStyle = {
	track: {
		width: 20,
		height: '100%',
		backgroundColor: 'rgba(255, 255, 255, 0.25)',
		borderRadius: 3,
	},
	active: {
		backgroundColor: '#b354d6',
		borderRadius: 3,
	},
	thumb: {
		width: 20,
		height: 30,
		borderRadius: 2,
		backgroundColor: 'purple',
		boxShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
	},
	disabled: {
		opacity: 0.5,
	},
};

const panStyle = {
	track: {
		width: '100%',
		height: 4,
		backgroundColor: 'rgba(255, 255, 255, 0.25)',
		borderRadius: 2,
	},
	active: {
		backgroundColor: '#b354d6',
		borderRadius: 2,
	},
	thumb: {
		width: 8,
		height: 16,
		borderRadius: 2,
		backgroundColor: 'purple',
		boxShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
	},
	disabled: {
		opacity: 0.5,
	},
};
