'use client';

import Global from '@/lib/global';
import { useEffect, useState } from 'react';
import cn from 'classnames';
import { HorizontalFader, VerticalFader } from '@/components/util/Fader';
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
	onPitch,
	onReverse,
	onLoop,
	onEffects,
	onEq,
	onPlay,
	onStop,
}: MixerChannelStripProps) {
	const [st, setSt] = useState<Record<string, any>>(() => ({
		playing: false,
		muted: !!params?.muted,
		solo: !!params?.solo,
		loop: !!params?.loop,
		reversed: !!params?.reversed,
		// seed from the live engine, not just the model params — the engine may
		// have added the legacy default delay after the grid was built, and
		// `effects` is no longer carried on every state event
		effects: (() => {
			const live = Global.engine?.get?.(id)?.sound?.effectParams?.();
			if (Array.isArray(live) && live.length) return live;
			return Array.isArray(params?.effects) ? params.effects : [];
		})(),
		volume: typeof params?.volume === 'number' ? params.volume : 0.5,
		pan: typeof params?.pan === 'number' ? params.pan : 0,
		rate: typeof params?.rate === 'number' ? params.rate : 1,
		pitch: typeof params?.pitch === 'number' ? params.pitch : 0,
		filename: params?.filename || filename || '',
	}));
	const [samplingProgress, setSamplingProgress] = useState<Record<string, any>>({});

	// is any EQ band active? (lights the EQ button)
	const [eqOn, setEqOn] = useState<boolean>(() => {
		const b = Global.engine?.eq?.(id);
		return Array.isArray(b) && b.some((x: any) => x.on);
	});
	useEffect(() => {
		const sync = () => {
			const b = Global.engine?.eq?.(id);
			setEqOn(Array.isArray(b) && b.some((x: any) => x.on));
		};
		sync();
		Global.engine.on('eq' + id, sync);
		return () => {
			Global.engine.off('eq' + id, sync);
		};
	}, [id]);

	useEffect(() => {
		const onState = (state: Record<string, any>) => {
			setSt((prev) => ({ ...prev, ...state }));
		};
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
	const { volume = 0, pan = 0, rate = 1, pitch = 0, muted, solo, loop, reversed, playing } = st;
	const processing = sampling && samplingProgress.processing && !samplingProgress.recording;
	const fxCount = Array.isArray(st.effects) ? st.effects.length : 0;

	// the fader's wheel-nudge and the horizontal sliders' swipe-nudge now live in
	// the shared Fader components (components/util/Fader.tsx)

	return (
		// Mixer controls are mouse-driven: a pressed button must not keep focus —
		// a focused button shows a lingering ring and re-fires on Space/Enter,
		// fighting the global shortcuts. preventDefault on mousedown stops the
		// click from focusing it while Tab/keyboard focus still works.
		<div className={cn(s.strip, !ready && s.dim)} onMouseDown={(e) => e.preventDefault()}>
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
				<div className={s.fader} data-tip data-for={'tt-mixer-volume'}>
					<VerticalFader
						label={`${label} volume`}
						value={volume}
						min={0}
						max={1}
						perPixel={2500}
						onChange={(v) => onVolume(v || 0)}
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
				MUTE
			</button>
			<button
				type='button'
				className={cn(s.btn, solo && s.on)}
				data-tip
				data-for={'tt-mixer-solo'}
				onClick={() => onSolo(!solo)}
			>
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
			</div>

			<div className={s.toggles}>
				<button
					type='button'
					className={cn(s.btn, eqOn && s.on)}
					data-tip
					data-for={'tt-mixer-eq'}
					onClick={onEq}
				>
					EQ
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
				<HorizontalFader
					label={`${label} pan`}
					className={s.panSlider}
					value={pan}
					min={-90}
					max={90}
					onChange={(v) => onPan(Math.round(v))}
				/>
				<span className={s.panMark}>R</span>
			</div>

			{/* rate: 0x … 1x (default) … 2x; shares the horizontal-slider styles */}
			<div className={s.panRow} data-tip data-for={'tt-mixer-rate'}>
				<span className={s.panMark}>0</span>
				<HorizontalFader
					label={`${label} rate`}
					className={s.panSlider}
					value={rate}
					min={0}
					max={2}
					step={0.01}
					onChange={onRate}
				/>
				<span className={s.panMark}>2</span>
			</div>

			{/* pitch: tempo-preserving, in semitones (-2 … +2 octaves) */}
			<div className={s.panRow} data-tip data-for={'tt-mixer-pitch'}>
				<span className={s.panMark}>-</span>
				<HorizontalFader
					label={`${label} pitch`}
					className={s.panSlider}
					value={pitch}
					min={-24}
					max={24}
					step={1}
					onChange={onPitch}
				/>
				<span className={s.panMark}>+</span>
			</div>

			<button
				type='button'
				className={cn(s.btn, s.play, playing && s.on)}
				data-tip
				data-for={'tt-mixer-play'}
				aria-label={playing ? 'Stop' : 'Play'}
				onClick={() => (playing ? onStop() : onPlay())}
			>
				{playing ? <IconStop /> : <IconPlay />}
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
	/** Tempo-preserving pitch shift in semitones (0 = original). */
	onPitch: (semitones: number) => void;
	onReverse: (on: boolean) => void;
	onLoop: (on: boolean) => void;
	/** Open the channel EQ editor for this channel. */
	onEq: () => void;
	/** Open the effect-chain editor for this channel. */
	onEffects: () => void;
	onPlay: () => void;
	onStop: () => void;
}

