'use client';

import { useEffect, useState } from 'react';
import Global from '@/lib/global';
import ReactTooltip from 'react-tooltip';
import cn from 'classnames';
import { VerticalFader } from '@/components/util/Fader';
import VolumeVisualizer from '@/components/visualizers/VolumeVisualizer';
import { IconPlay, IconStop, IconRecord, IconVolume } from '@/components/icons/Icons';
import MixerChannelStrip from './MixerChannelStrip';
import EffectChain from './EffectChain';
import EqEditor from './EqEditor';
import s from './Mixer.module.scss';
import cs from './MixerChannelStrip.module.scss';

/**
 * Mixer view: the current model as a multi-track mixer. One channel strip per
 * sound (row-major, same order as the grid) and a master strip at the far
 * right. It overlays the grid (which stays mounted and keeps playing) — the
 * overlay swallows mouse events so the grid's heat writes don't fire through.
 *
 * Every control is a direct engine call; only sample-record is delegated to the
 * parent, which owns the shared "one channel sampling at a time" state.
 */
export default function Mixer({
	init,
	model,
	version,
	ids,
	cols,
	sampling,
	masterstate,
	onSampleRecord,
	onRecord,
	onClose,
}: MixerProps) {
	const stop = (e: React.SyntheticEvent) => e.stopPropagation();
	const [fxId, setFxId] = useState<string | null>(null);
	const [eqId, setEqId] = useState<string | null>(null);

	// one strip per actual sound — a model's grid can have more cells than
	// files (empty cells have no sound and nothing to show)
	const channelIds = ids.filter((id) => Global.engine.exist(id));

	return (
		<div className={s.overlay} onMouseMove={stop} onMouseDown={stop} onTouchStart={stop}>
			<div className={s.header}>
				<div className={s.title}>
					MIXER <span className={s.model}>{model}</span>
				</div>
				<button type='button' className={s.close} onClick={onClose}>
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
						params={cols[id]}
						init={init}
						sampling={sampling === id}
						isSampling={!!sampling && sampling !== id}
						onVolume={(vol) => {
							console.log('vol', vol);
							Global.engine.volume(id, vol);
						}}
						onMute={(on) => Global.engine.mute(id, on)}
						onSolo={(on) => Global.engine.solo(id, on, false)}
						onSampleRecord={(on) => onSampleRecord(id, on)}
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
 * record and play/stop — no solo or pan (the engine has neither for the master
 * bus). Values come from the `masterstate` the app already mirrors.
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
	const { volume = 0, muted, playing, recording } = masterstate;

	// wheel-nudge now lives in the shared VerticalFader (components/util/Fader)

	return (
		<div className={cn(cs.strip, s.master, !init && cs.dim)}>
			<div className={cs.label}>MASTER</div>

			<div className={cs.faderRow}>
				<div className={cs.meter} data-tip data-for={'tt-mixer-meter'}>
					{/* the master recorder captures the master bus, so this keeps
					    metering the recorded signal — red marks it as recording */}
					<VolumeVisualizer id={'master'} color={recording ? '#ff3b30' : '#ffffff'} ready={init} />
				</div>
				<div className={cs.fader} data-tip data-for={'tt-mixer-volume'}>
					<VerticalFader
						label='Master volume'
						value={volume}
						min={0}
						max={1}
						perPixel={2500}
						onChange={(v) => Global.engine.master.volume(Math.min(1, Math.max(0, v)))}
						styles={faderStyle}
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
	model: string;
	/** Bumped on every model load; keys the strips so meters rebind to the new sounds. */
	version: number;
	/** Channel ids in row-major order (the same order as the grid). */
	ids: string[];
	cols: Record<string, any>;
	/** Id of the sound currently sampling, if any. */
	sampling: string | boolean | null;
	masterstate: Record<string, any>;
	onSampleRecord: (id: string, on: boolean) => void;
	onRecord: (on: boolean) => void;
	onClose: () => void;
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
