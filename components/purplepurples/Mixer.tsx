'use client';

import Global from '@/lib/global';
import { useCallback, useEffect, useState } from 'react';
import ReactTooltip from 'react-tooltip';
import cn from 'classnames';
import type { Model } from './types';
import { VerticalFader } from '@/components/util/Fader';
import VolumeVisualizer from '@/components/visualizers/VolumeVisualizer';
import Select from '@/components/util/Select';
import { IconPlay, IconStop, IconRecord, IconVolume, IconLoop, IconReverse } from '@/components/icons/Icons';
import MixerChannelStrip from './MixerChannelStrip';
import EffectChain from './EffectChain';
import EqEditor from './EqEditor';
import s from './Mixer.module.scss';
import cs from './MixerChannelStrip.module.scss';

/**
 * Standalone Mixer view (no grid state via props): the Mixer itself subscribes
 * to the engine's events — `model` (channel list), `masterstate`, `sampling`
 * and `models` (the selector) — and keeps its own state mirror. A model
 * selector at the top switches the loaded model (`engine.loadModel`).
 *
 * It overlays the grid (which stays mounted and keeps playing); the overlay
 * swallows mouse events so the grid's heat writes don't fire through.
 *
 * Kept as props (app-level orchestration, not engine data):
 * - `init` — the app's engine-ready gate for meters.
 * - `onRecord` — the shared master-record flow (recordings list + persistence
 *   live in the app layer).
 * - `onClose`.
 */
export default function Mixer({ init, onRecord, onClose }: MixerProps) {
	const stop = (e: React.SyntheticEvent) => e.stopPropagation();
	const [fxId, setFxId] = useState<string | null>(null);
	const [eqId, setEqId] = useState<string | null>(null);
	const [ids, setIds] = useState<string[]>([]);
	const [cols, setCols] = useState<Record<string, { filename?: string; params: Record<string, any> }>>({});
	/** bumped on every 'model' event — keys strips so meters rebind to new sounds */
	const [version, setVersion] = useState(0);
	const [model, setModel] = useState<string>('');
	const [models, setModels] = useState<{ name: string }[]>([]);
	const [masterstate, setMasterstate] = useState<Record<string, any>>(Global.engine?.master?.state ?? {});
	const [sampling, setSampling] = useState<string | null>(() => {
		const live = (Global.engine?.sounds || []).find((s: any) => s.sound._sampling);
		return live ? live.id : null;
	});

	const applyModel = useCallback((m: Model) => {
		// row-major, mirroring the grid build: only cells that actually carry a
		// file are mixable
		const nextIds: string[] = [];
		const nextCols: Record<string, { filename?: string; params: Record<string, any> }> = {};
		let fileIdx = 0;
		for (let row = 0; row < m.rows; row++) {
			for (let col = 0; col < m.cols; col++) {
				const id = row + '-' + col;
				const file = m.files[fileIdx++];
				if (!file) continue;
				nextCols[id] = {
					filename: file.filename,
					params: file.params ? { ...file.params } : {},
				};
				nextIds.push(id);
			}
		}
		setIds(nextIds);
		setCols(nextCols);
		setModel(m.name);
		setVersion((v) => v + 1);
		setSampling(null); // old ids don't survive a model swap
	}, []);

	const startSample = useCallback((id: string, on: boolean) => {
		const engine = Global.engine;
		if (on) {
			engine.sample(id, true)
				.then(() => {
					// lock the channel while its re-recorded sample settles
					engine.lock(id, true);
				})
				.catch((err: unknown) => {
					if (err === 'CANCELLED') return;
					console.warn('sample failed', err);
				});
		} else {
			engine.sample(id, false);
		}
	}, []);

	useEffect(() => {
		const engine = Global.engine;
		if (!engine) return;

		// seed: the mixer opens long after the first 'model' fired
		if (engine.model) applyModel(engine.model);
		if (Array.isArray(engine.models) && engine.models.length) setModels(engine.models as any);

		const onModel = (m: Model) => {
			applyModel(m);
			setFxId(null);
			setEqId(null);
		};
		const onModelsEvent = (list: unknown) =>
			setModels(Array.isArray(list) ? list : []);
		const onMasterState = (st: unknown) => setMasterstate(st as Record<string, any>);
		const onSampling = (id: string, on: boolean) =>
			setSampling((cur) => (on ? id : cur === id ? null : cur));

		engine.on('model', onModel);
		engine.on('models', onModelsEvent);
		engine.on('masterstate', onMasterState);
		engine.on('sampling', onSampling);
		return () => {
			engine.off('model', onModel);
			engine.off('models', onModelsEvent);
			engine.off('masterstate', onMasterState);
			engine.off('sampling', onSampling);
		};
	}, [applyModel]);

	const channelIds = ids.filter((id) => Global.engine.exist(id));

	return (
		<div className={s.overlay} onMouseMove={stop} onMouseDown={stop} onTouchStart={stop}>
			<div className={s.header}>
				<Select
					direction='down'
					value={model}
					options={models.map((m) => ({ value: m.name, label: m.name }))}
					onChange={(name) => {
						if (name !== model) Global.engine.loadModel(String(name));
					}}
					onClick={() => {
						if (!models.length) Global.engine.loadModels();
					}}
				/>
				<button
					type='button'
					className={s.close}
					onMouseDown={(e) => e.preventDefault()}
					onClick={onClose}
				>
					Close
				</button>
			</div>

			<div className={s.channels}>
				{channelIds.map((id, idx) => (
					<MixerChannelStrip
						key={version + ':' + id}
						id={id}
						label={`${idx + 1}`}
						filename={cols[id]?.filename}
						params={cols[id]?.params}
						init={init}
						sampling={sampling === id}
						isSampling={!!sampling && sampling !== id}
						onVolume={(vol) => Global.engine.volume(id, vol)}
						onMute={(on) => Global.engine.mute(id, on)}
						onSolo={(on) => Global.engine.solo(id, on, false)}
						onSampleRecord={(on) => startSample(id, on)}
						onPan={(deg) => Global.engine.pan(id, deg)}
						onRate={(rate) => Global.engine.rate(id, rate)}
						onPitch={(semitones) => Global.engine.pitch(id, semitones)}
						onReverse={(on) => Global.engine.reverse(id, on)}
						onLoop={(on) => Global.engine.loop(id, on)}
						onEq={() => setEqId(id)}
						onEffects={() => setFxId(id)}
						onPlay={() => Global.engine.play(id)}
						onStop={() => Global.engine.stop(id)}
					/>
				))}

				<div className={s.spacer} aria-hidden='true' />

				<MasterStrip key={'master:' + version} init={init} masterstate={masterstate} onRecord={onRecord} />
			</div>

			<ReactTooltip id='tt-mixer-pan' type='dark' place='top' effect='float' delayShow={600}>
				Pan
			</ReactTooltip>
			<ReactTooltip id='tt-mixer-rate' type='dark' place='top' effect='float' delayShow={600}>
				Rate
			</ReactTooltip>
			<ReactTooltip id='tt-mixer-pitch' type='dark' place='top' effect='float' delayShow={600}>
				Pitch (semitones)
			</ReactTooltip>
			<ReactTooltip id='tt-mixer-reverse' type='dark' place='top' effect='float' delayShow={600}>
				Reverse
			</ReactTooltip>
			<ReactTooltip id='tt-mixer-loop' type='dark' place='top' effect='float' delayShow={600}>
				Loop
			</ReactTooltip>
			<ReactTooltip id='tt-mixer-eq' type='dark' place='top' effect='float' delayShow={600}>
				EQ
			</ReactTooltip>
			<ReactTooltip id='tt-mixer-effects' type='dark' place='top' effect='float' delayShow={600}>
				Effects
			</ReactTooltip>

			{fxId && (
				<EffectChain
					key={version + ':' + fxId}
					id={fxId}
					filename={cols[fxId]?.filename}
					onClose={() => setFxId(null)}
				/>
			)}

			{eqId && (
				<EqEditor
					key={version + ':' + eqId}
					id={eqId}
					filename={cols[eqId]?.filename}
					onClose={() => setEqId(null)}
				/>
			)}
		</div>
	);
}

/**
 * The master bus channel. It carries label, level, fader, mute, master-output
 * record and play/stop + reverse/loop all — no solo or pan (the engine has
 * neither for the master bus). Values come from Mixer's own `masterstate`
 * subscription.
 */
function MasterStrip({
	init,
	masterstate,
	onRecord,
}: {
	init: boolean;
	masterstate: Record<string, any>;
	onRecord: (on: boolean) => void;
}) {
	const { volume = 0, muted, playing, recording, looping, reversed } = masterstate;
	return (
		// see MixerChannelStrip: keep mouse presses from leaving a button focused
		<div className={cn(cs.strip, s.master, !init && cs.dim)} onMouseDown={(e) => e.preventDefault()}>
			<div className={cs.label}>MASTER</div>

			<div className={cs.faderRow}>
				<div className={cs.meter} data-tip data-for={'tt-mixer-meter'}>
					<VolumeVisualizer id={'master'} color={recording ? '#ff3b30' : '#ffffff'} ready={init} />
				</div>
				<div className={cs.fader} data-tip data-for={'tt-mixer-volume'}>
					<VerticalFader
						label='Master volume'
						value={volume}
						min={0}
						max={1}
						perPixel={2500}
						onChange={(v) => {
							Global.engine.master.volume(Math.min(1, Math.max(0, v)));
						}}
					/>
				</div>
			</div>

			<button
				type='button'
				className={cn(cs.btn, muted && cs.on)}
				data-tip
				data-for={'tt-mixer-mute'}
				onClick={() => Global.engine.master.mute(!muted)}
			>
				<IconVolume />
				MUTE
			</button>

			<button
				type='button'
				className={cn(cs.btn, cs.rec, recording && cs.recOn)}
				data-tip
				data-for={'tt-mixer-mrec'}
				onClick={() => onRecord(!recording)}
			>
				<IconRecord />
				REC
			</button>

			<div className={cs.toggles}>
				<button
					type='button'
					className={cn(cs.btn, reversed && cs.on)}
					aria-label='Reverse all'
					title='Reverse all'
					onClick={() => Global.engine.master.reverse(!reversed)}
				>
					<IconReverse />
				</button>
				<button
					type='button'
					className={cn(cs.btn, looping && cs.on)}
					aria-label='Loop all'
					title='Loop all'
					onClick={() => Global.engine.master.loop(!looping)}
				>
					<IconLoop />
				</button>
			</div>

			<button
				type='button'
				className={cn(cs.btn, cs.play, playing && cs.on)}
				data-tip
				data-for={'tt-mixer-play'}
				aria-label={playing ? 'Stop' : 'Play'}
				onClick={() => (playing ? Global.engine.master.stop() : Global.engine.master.play())}
			>
				{playing ? <IconStop /> : <IconPlay />}
			</button>
		</div>
	);
}

export interface MixerProps {
	/** Engine/model ready — gates meters and controls. */
	init: boolean;
	/** Shared master-record flow (recordings list + persistence live in the app layer). */
	onRecord: (on: boolean) => void;
	onClose: () => void;
}
