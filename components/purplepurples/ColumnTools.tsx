'use client';

import Global from '@/lib/Global';
import { useEffect, useRef, useState } from 'react';
import {
	IconPlay,
	IconStop,
	IconRecord,
	IconVolume,
	IconLoop,
	IconReverse,
	IconEffects,
	IconMidi,
	IconReset,
	IconSolo,
	IconFullscreen,
} from '@/components/icons/Icons';
import Slider from 'react-input-slider';
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
	volume = 0,
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
	onVolume,
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
	volume?: number;
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
	onVolume: (vol: number) => void;
}) {
	const [hoveringButtons, setHoveringButtons] = useState(false);
	const [samplingProgress, setSamplingProgress] = useState<Record<string, unknown>>({});
	const [colHeight, setColHeight] = useState(0);
	const toolsRef = useRef<HTMLDivElement>(null);

	// Slider is 50% of the column height → measure the column (the tools strip's
	// parent) and keep it in sync across window/column resizes. The tools strip
	// only renders while `hovering`, so (re)measure whenever it appears.
	useEffect(() => {
		if (!hovering) return;
		const el = toolsRef.current?.parentElement;
		if (!el) return;
		const measure = () => setColHeight(el.clientHeight);
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, [hovering]);

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
		//if (isSampling && !sampling) return;
		//if (sampling) return;
		onSampleRecord(on);
	};

	const midiMap = (on: boolean) => {
		const unmap = midiNote ? midiNote !== 0 && on === true : false;
		if (unmap) return Global.engine.unmapMidiNote(id, midiNote);
		onMidiMapMode(on);
	};

	return (
		<div
			ref={toolsRef}
			className={cn(s.tools, hoveringButtons && s.hovering)}
			onClick={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
			onMouseMove={(e) => e.stopPropagation()}
			onMouseEnter={() => setHoveringButtons(true)}
			onMouseLeave={() => setHoveringButtons(false)}
		>
			{playing ? <IconStop className={s.toggle} onClick={onStop} /> : <IconPlay onClick={onPlay} />}
			{!sampling ? (
				<IconRecord
					onClick={() => sampleRecord(true)}
					className={isSampling ? s.toggle : undefined}
				/>
			) : (
				<IconRecord
					className={
						(samplingProgress as any).processing && !(samplingProgress as any).recording
							? s.samplingProcessing
							: s.sampling
					}
					onClick={() => sampleRecord(false)}
				/>
			)}
			<div className={s.vol}>
				<div
					className={s.volSlider}
					style={{ height: Math.round(colHeight * 0.5) }}
					onMouseDown={(e) => e.stopPropagation()}
				>
					<Slider
						axis='y'
						y={Number.isFinite(volume) ? Math.round(volume * 100) : 0}
						ymin={0}
						ymax={100}
						ystep={1}
						yreverse
						onChange={({ y }) => onVolume(Math.min(1, Math.max(0, y / 100)) || 0)}
						styles={volSliderStyle}
					/>
				</div>
				<IconVolume className={!muted ? s.toggle : undefined} onClick={() => onMute(!muted)} />
			</div>
			<IconLoop onClick={() => onLoop(!loop)} className={loop ? s.toggle : undefined} />
			<IconReverse
				className={reversed ? s.toggle : undefined}
				onClick={() => onReverse(!reversed)}
			/>
			<IconEffects
				className={effectsEnabled ? s.toggle : undefined}
				onClick={() => onEffectsEnabled(!effectsEnabled)}
			/>
			<IconMidi
				className={cn(midiNote ? s.mapped : midiMapMode ? s.mapping : undefined)}
				onClick={() => midiMap(!midiMapMode)}
			/>
			<IconReset onClick={onReset} />
			<IconSolo className={solo ? s.toggle : undefined} onClick={() => onSolo(!solo)} />
			<IconFullscreen
				className={fullscreen ? s.toggle : undefined}
				onClick={() => onFullscreen(!fullscreen)}
			/>
			{/* <IconLock className={locked ? s.toggle : undefined} onClick={() => onLocked(!locked)} /> */}
		</div>
	);
}

const volSliderStyle = {
	track: {
		width: 6,
		height: '100px',
		backgroundColor: 'rgba(255, 255, 255, 0.25)',
		borderRadius: 3,
	},
	active: {
		backgroundColor: '#b354d6',
		borderRadius: 3,
	},
	thumb: {
		width: 16,
		height: 10,
		borderRadius: 2,
		backgroundColor: 'purple',
		boxShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
	},
	disabled: {
		opacity: 0.5,
	},
};
