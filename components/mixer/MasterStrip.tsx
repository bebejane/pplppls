'use client';

import Global from '@/lib/global';
import s from './Mixer.module.scss';
import cs from './ChannelStrip.module.scss';
import ms from './MasterStrip.module.scss';
import cn from 'classnames';
import { VerticalFader } from '@/components/util/Fader';
import VolumeVisualizer from '@/components/visualizers/VolumeVisualizer';
import { IconStop, IconLoop, IconReverse, IconPause, IconPlay } from '@/components/icons/Icons';
import Elapsed from '@/components/mixer/Elapsed';

/**
 * The master bus channel. It carries label, level, fader, mute, master-output
 * record and play/stop + reverse/loop all — no solo or pan (the engine has
 * neither for the master bus). Values come from Mixer's own `masterstate`
 * subscription.
 */
export default function MasterStrip({
	init,
	masterstate,
	onRecord,
}: {
	init: boolean;
	masterstate: Record<string, any>;
	onRecord: (on: boolean) => void;
}) {
	const { volume = 0, muted, playing, recording, looping, reversed, paused } = masterstate;
	// a loop keeps `playing` true while paused — see ChannelStrip
	const isPlaying = playing && !paused;
	return (
		// see ChannelStrip: keep mouse presses from leaving a button focused
		<div
			className={cn(cs.strip, s.master, !init && cs.dim)}
			onMouseDown={(e) => e.preventDefault()}
		>
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
				MUTE
			</button>

			<button
				type='button'
				className={cn(cs.btn, cs.rec, recording && cs.recOn)}
				data-tip
				data-for={'tt-mixer-mrec'}
				onClick={() => onRecord(!recording)}
			>
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
			<div className={ms.elapsed}>
				<Elapsed id={'master'} enableElapsed={true} />
			</div>
			<button
				type='button'
				className={cn(cs.btn, cs.stopBtn)}
				aria-label='Stop all'
				title='Stop all'
				onClick={() => Global.engine.master.stop()}
			>
				<IconStop />
			</button>
			<button
				type='button'
				className={cn(cs.btn, cs.play, isPlaying && cs.on)}
				data-tip
				data-for={'tt-mixer-play'}
				aria-label={isPlaying ? 'Pause' : 'Play'}
				onClick={() => (isPlaying ? Global.engine.master.pause(true) : Global.engine.master.play())}
			>
				{isPlaying ? <IconPause /> : <IconPlay />}
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
