'use client';

import Global from '@/lib/Global';
import { useEffect, useState } from 'react';
import {
	MdPlayArrow,
	MdStop,
	MdRepeat,
	MdVolumeUp,
	MdFiberManualRecord,
	MdSettingsBackupRestore,
} from 'react-icons/md';
import { IoMdLock } from 'react-icons/io';
import { AiOutlineLink, AiFillPhone } from 'react-icons/ai';
import { RiArrowGoBackLine } from 'react-icons/ri';
import { GiMagicLamp } from 'react-icons/gi';
import { TiWaves } from 'react-icons/ti';
import cn from 'classnames';
import s from './ColumnTools.module.scss';

export default function ColumnTools({
	id,
	playing,
	sampling,
	isSampling,
	muted,
	loop,
	locked,
	fullscreen,
	midiMapMode,
	effectsEnabled,
	midiNote,
	reversed,
	solo,
	hovering,
	onPlay,
	onStop,
	onSampleRecord,
	onMute,
	onLoop,
	onReverse,
	onEffectsEnabled,
	onMidiMapMode,
	onReset,
	onSolo,
	onFullscreen,
	onLocked,
}: {
	id: string;
	playing?: boolean;
	sampling?: boolean;
	isSampling?: boolean;
	muted?: boolean;
	loop?: boolean;
	locked?: boolean;
	fullscreen?: boolean;
	midiMapMode?: boolean;
	effectsEnabled?: boolean;
	midiNote?: number;
	reversed?: boolean;
	solo?: boolean;
	hovering?: boolean;
	onPlay: () => void;
	onStop: () => void;
	onSampleRecord: (on: boolean) => void;
	onMute: (on: boolean) => void;
	onLoop: (on: boolean) => void;
	onReverse: (on: boolean) => void;
	onEffectsEnabled: (on: boolean) => void;
	onMidiMapMode: (on: boolean) => void;
	onReset: () => void;
	onSolo: (on: boolean) => void;
	onFullscreen: (on: boolean) => void;
	onLocked: (on: boolean) => void;
}) {
	const [hoveringButtons, setHoveringButtons] = useState(false);
	const [samplingProgress, setSamplingProgress] = useState<Record<string, unknown>>({});

	useEffect(() => {
		// Only the column that is actively sampling needs the progress feed;
		// subscribing unconditionally in every ColumnTools instance piled up
		// N global `samplingprogress` listeners (EventEmitter max-listeners
		// warning). The other two engine events were no-ops here.
		if (!sampling) return;
		const onSamplingProgress = (sid: string, prog: unknown) => {
			if (sid !== id) return;
			setSamplingProgress({ ...(prog as object) });
		};
		Global.engine.on('samplingprogress', onSamplingProgress);
		return () => {
			Global.engine.off('samplingprogress', onSamplingProgress);
		};
	}, [sampling, id]);

	if (!hovering) return null;

	const sampleRecord = (on: boolean) => {
		if (isSampling && !sampling) return;
		if (sampling) return;
		onSampleRecord(on);
	};

	const midiMap = (on: boolean) => {
		const unmap = midiNote ? midiNote !== 0 && on === true : false;
		if (unmap) return Global.engine.unmapMidiNote(id, midiNote);
		onMidiMapMode(on);
	};

	return (
		<div
			className={cn(s.tools, hoveringButtons && s.hovering)}
			onClick={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
			onMouseMove={(e) => e.stopPropagation()}
			onMouseEnter={() => setHoveringButtons(true)}
			onMouseLeave={() => setHoveringButtons(false)}
		>
			{playing ? <MdStop className={s.toggle} onClick={onStop} /> : <MdPlayArrow onClick={onPlay} />}
			{!sampling ? (
				<MdFiberManualRecord
					onClick={() => sampleRecord(true)}
					className={isSampling ? s.toggle : undefined}
				/>
			) : (
				<MdFiberManualRecord
					className={
						(samplingProgress as any).processing && !(samplingProgress as any).recording
							? s.samplingProcessing
							: s.sampling
					}
					onClick={() => sampleRecord(false)}
				/>
			)}
			<MdVolumeUp
				className={!muted ? s.toggle : undefined}
				onClick={() => onMute(!muted)}
			/>
			<MdRepeat onClick={() => onLoop(!loop)} className={loop ? s.toggle : undefined} />
			<RiArrowGoBackLine
				className={reversed ? s.toggle : undefined}
				onClick={() => onReverse(!reversed)}
			/>
			<GiMagicLamp
				className={effectsEnabled ? s.toggle : undefined}
				onClick={() => onEffectsEnabled(!effectsEnabled)}
			/>
			<AiOutlineLink
				className={cn(
					midiNote ? s.mapped : midiMapMode ? s.mapping : undefined,
				)}
				onClick={() => midiMap(!midiMapMode)}
			/>
			<MdSettingsBackupRestore onClick={onReset} />
			<AiFillPhone className={solo ? s.toggle : undefined} onClick={() => onSolo(!solo)} />
			<TiWaves
				className={fullscreen ? s.toggle : undefined}
				onClick={() => onFullscreen(!fullscreen)}
			/>
			<IoMdLock className={locked ? s.toggle : undefined} onClick={() => onLocked(!locked)} />
		</div>
	);
}