'use client';

import Global from '@/lib/global';
import s from './Mixer.module.scss';
import { useCallback, useEffect, useState } from 'react';
import ReactTooltip from 'react-tooltip';
import type { Model } from 'audio-engine';
import Select from '@/components/util/Select';
import ChannelStrip from './ChannelStrip';
import EffectChain from './EffectChain';
import EqEditor from './EqEditor';
import MasterStrip from './MasterStrip';

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
	const [cols, setCols] = useState<
		Record<string, { filename?: string; params: Record<string, any> }>
	>({});
	/** bumped on every 'model' event — keys strips so meters rebind to new sounds */
	const [version, setVersion] = useState(0);
	const [model, setModel] = useState<string>('');
	const [models, setModels] = useState<{ name: string }[]>([]);
	const [masterstate, setMasterstate] = useState<Record<string, any>>(
		Global.engine?.master?.state ?? {},
	);
	const [sampling, setSampling] = useState<string | null>(() => {
		const live = (Global.engine?.sounds || []).find((s: any) => s.sound._sampling);
		return live ? live.id : null;
	});

	const applyModel = useCallback((m: Model) => {
		// the channel list is the engine's live truth, not `model.files`: a fresh
		// (unsaved) model's files[] is never updated when a sound is added to a
		// cell, so seeding from it would miss sounds added while the mixer was
		// closed. `engine.sounds` is in add order (row-major after a populate).
		const nextIds: string[] = [];
		const nextCols: Record<string, { filename?: string; params: Record<string, any> }> = {};
		(Global.engine?.sounds || []).forEach((item: any) => {
			const snd = item.sound;
			nextIds.push(item.id);
			nextCols[item.id] = {
				filename: snd?._filename ?? item.filename,
				params: snd?.getSaveState ? snd.getSaveState() : {},
			};
		});
		setIds(nextIds);
		setCols(nextCols);
		setModel(m.name);
		setVersion((v) => v + 1);
		setSampling(null); // old ids don't survive a model swap
	}, []);

	const startSample = useCallback((id: string, on: boolean) => {
		const engine = Global.engine;
		if (on) {
			engine
				.sample(id, true)
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
		if (!init) return;
		const engine = Global.engine;
		if (!engine) return;
		console.log('init mixer');
		// seed: the mixer opens long after the first 'model' fired
		if (engine.model) applyModel(engine.model);
		if (Array.isArray(engine.models) && engine.models.length) setModels(engine.models as any);

		const onModel = (m: Model) => {
			applyModel(m);
			setFxId(null);
			setEqId(null);
		};
		const onModelsEvent = (list: unknown) => setModels(Array.isArray(list) ? list : []);
		const onMasterState = (st: unknown) => setMasterstate(st as Record<string, any>);
		const onSampling = (id: string, on: boolean) =>
			setSampling((cur) => (on ? id : cur === id ? null : cur));
		// sounds added/removed AFTER a model populated (uploads/sample recordings
		// into a fresh model's empty cells) keep the mixer in sync: the strips
		// keep their version key, only the channel list grows/shrinks
		const onAdd = (id: string, sound: any) => {
			if (!id) return;
			// the payload may be a Sound or a SoundItem wrapper ({id, sound}) —
			// normalize so both emitters work
			const snd = sound && sound.sound && sound.id !== undefined ? sound.sound : sound;
			setIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
			setCols((prev) => {
				if (prev[id]) return prev;
				const params = snd && snd.getSaveState ? snd.getSaveState() : {};
				return { ...prev, [id]: { filename: snd && snd._filename, params: params || {} } };
			});
		};
		const onRemove = (id: string) => {
			setIds((prev) => prev.filter((p) => p !== id));
			setCols((prev) => {
				if (!prev[id]) return prev;
				const next = { ...prev };
				delete next[id];
				return next;
			});
		};

		engine.on('model', onModel);
		engine.on('models', onModelsEvent);
		engine.on('masterstate', onMasterState);
		engine.on('sampling', onSampling);
		engine.on('add', onAdd);
		engine.on('replace', onAdd);
		engine.on('create', onAdd);
		engine.on('remove', onRemove);
		return () => {
			engine.off('model', onModel);
			engine.off('models', onModelsEvent);
			engine.off('masterstate', onMasterState);
			engine.off('sampling', onSampling);
			engine.off('add', onAdd);
			engine.off('replace', onAdd);
			engine.off('create', onAdd);
			engine.off('remove', onRemove);
		};
	}, [init, applyModel]);

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
					<ChannelStrip
						key={version + ':' + id}
						id={id}
						label={`${idx + 1}`}
						filename={cols[id]?.filename}
						params={cols[id]?.params}
						init={init}
						sampling={sampling === id}
						isSampling={!!sampling && sampling !== id}
						onVolume={(vol) => Global.engine.volume(id, vol)}
						onGain={(db) => Global.engine.gain(id, db)}
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
				<MasterStrip
					key={'master:' + version}
					init={init}
					masterstate={masterstate}
					onRecord={onRecord}
				/>
			</div>

			<ReactTooltip id='tt-mixer-gain' type='dark' place='top' effect='float' delayShow={600}>
				Gain (dB)
			</ReactTooltip>
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

export interface MixerProps {
	/** Engine/model ready — gates meters and controls. */
	init: boolean;
	/** Shared master-record flow (recordings list + persistence live in the app layer). */
	onRecord: (on: boolean) => void;
	onClose: () => void;
}
