'use client';

import Global from '@/lib/Global';
import { useEffect, useRef, useState } from 'react';
import {
	MdPlayArrow,
	MdStop,
	MdRepeat,
	MdFiberManualRecord,
	MdFullscreen,
	MdSettingsBackupRestore,
	MdQueueMusic,
	MdVolumeUp,
} from 'react-icons/md';
import { IoMdLock, IoMdHelp } from 'react-icons/io';
import { FiPlus } from 'react-icons/fi';
import { GoGear } from 'react-icons/go';
import { RiDownload2Line, RiUpload2Line } from 'react-icons/ri';
import ReactTooltip from 'react-tooltip';
import moment from 'moment';
import cn from 'classnames';
import Select from '@/components/util/Select';
import MasterFader from './MasterFader';
import type { Recording } from './RecordingsDialog';
import s from './Controls.module.scss';

export default function Controls(props: ControlsProps) {
	const {
		init,
		show,
		recordings,
		models,
		volume,
		model,
		looping,
		muted,
		locked,
		recording,
		fullscreen,
		controls,
		recordingProgress,
		showRecordings,
		showHelp,
		midiSupported,
		midiDevices,
		midiDeviceId,
		inputDevices,
		inputDeviceId,
	} = props;

	const [hovering, setHovering] = useState(false);
	const [playId, setPlayId] = useState<number | undefined>(undefined);
	const [elapsed, setElapsed] = useState(0);
	const soundRef = useRef<any>(null);

	useEffect(() => {
		const onRecordingProgress = (id: unknown, prog: any) => {
			if (!id) setElapsed(prog.elapsed);
		};
		Global.engine.on('recordingprogress', onRecordingProgress);
		return () => {
			Global.engine.off('recordingprogress', onRecordingProgress);
			if (soundRef.current) soundRef.current.destroy();
		};
	}, []);

	if (!show) return null;

	const onPlay = () => {
		if (!recordings.length) return;
		const rec = recordings[0];
		Global.engine.stop();
		if (soundRef.current) soundRef.current.destroy();
		const sound = Global.engine.playSound(rec.url, { enableElapsed: true, volume: 1.0 });
		soundRef.current = sound;
		sound.on('ready', () => {
			sound.volume(1.0);
			sound.play();
			setPlayId(rec.id);
		});
		sound.on('elapsed', (el: number) => {
			setElapsed(el);
			setPlayId(rec.id);
		});
		sound.on('ended', () => {
			setPlayId(undefined);
			setElapsed(0);
		});
		sound.load();
		setPlayId(rec.id);
	};

	const onStop = () => {
		if (soundRef.current) soundRef.current.stop();
		setPlayId(undefined);
	};

	const formatDuration = (sec?: number, rate?: number) => {
		const time = moment.utc(moment.duration(rate ? sec! / rate : sec, 'seconds').asMilliseconds());
		return time.format((time.hours() > 0 ? 'HH:' : '') + 'mm:ss:SSS');
	};

	return (
		<div className={s.container}>
			<div
				className={s.buttons}
				onMouseEnter={() => setHovering(true)}
				onMouseLeave={() => setHovering(false)}
			>
				<MdFiberManualRecord
					onClick={() => props.onRecord(!recording)}
					className={cn(
						(recordingProgress && (recordingProgress as any).recording && s.recording) ||
							((recordingProgress && (recordingProgress as any).processing && s.processing) ||
								undefined),
					)}
				/>
				{playId !== undefined ? (
					<MdStop onClick={onStop} />
				) : (
					<MdPlayArrow
						className={recordings.length ? s.toggle : ''}
						onClick={onPlay}
					/>
				)}
				<div className={s.recordingProgress}>
					{formatDuration(elapsed || (recordingProgress && (recordingProgress as any).elapsed))}
				</div>
				<div className={s.recordings} data-tip data-for={'tt-recordings'}>
					<MdQueueMusic
						data-tip
						data-for={'tt-recordings'}
						onClick={() => props.onToggleRecordings(!showRecordings)}
					/>
					{recordings.length ? <div className={s.badge}>{recordings.length}</div> : null}
				</div>

				<MdRepeat
					data-tip
					data-for={'tt-loop'}
					onClick={() => props.onLoop(!looping)}
					className={looping ? s.toggle : ''}
				/>
				<IoMdLock
					data-tip
					data-for={'tt-lock'}
					onClick={() => props.onLocked(!locked)}
					className={locked ? s.toggle : ''}
				/>
				<MdFullscreen
					data-tip
					data-for={'tt-fs'}
					onClick={() => props.onFullscreen(!fullscreen)}
					className={fullscreen ? s.toggle : ''}
				/>
				<GoGear
					data-tip
					data-for={'tt-controls'}
					onClick={() => props.onControls(!props.controls)}
					className={props.controls ? s.toggle : ''}
				/>
				<MdSettingsBackupRestore
					data-tip
					data-for={'tt-reset'}
					onClick={() => Global.engine.master.reset()}
				/>
				<RiDownload2Line data-tip data-for={'tt-save'} onClick={() => props.onSave()} />
				<RiUpload2Line data-tip data-for={'tt-load'} onClick={() => props.onLoad()} />
				<FiPlus data-tip data-for={'tt-new'} onClick={() => props.onToggleNewSet()} />
				<IoMdHelp
					data-tip
					data-for={'tt-help'}
					onClick={() => props.onToggleHelp(!showHelp)}
				/>

				<ReactTooltip id='tt-playing' type='dark' place='top' effect='float' delayShow={800}>
					Play/Stop
				</ReactTooltip>
				<ReactTooltip id='tt-record' type='dark' place='top' effect='float' delayShow={800}>
					Record
				</ReactTooltip>
				<ReactTooltip id='tt-record-time' type='dark' place='top' effect='float' delayShow={800}>
					Recording time
				</ReactTooltip>
				<ReactTooltip id='tt-loop' type='dark' place='top' effect='float' delayShow={800}>
					Loop
				</ReactTooltip>
				<ReactTooltip id='tt-lock' type='dark' place='top' effect='float' delayShow={800}>
					Lock
				</ReactTooltip>
				<ReactTooltip id='tt-fs' type='dark' place='top' effect='float' delayShow={800}>
					Fullscreeen
				</ReactTooltip>
				<ReactTooltip id='tt-controls' type='dark' place='top' effect='float' delayShow={800}>
					Toggle Controls
				</ReactTooltip>
				<ReactTooltip id='tt-reset' type='dark' place='top' effect='float' delayShow={800}>
					Reset all
				</ReactTooltip>
				<ReactTooltip id='tt-save' type='dark' place='top' effect='float' delayShow={800}>
					Save
				</ReactTooltip>
				<ReactTooltip id='tt-load' type='dark' place='top' effect='float' delayShow={800}>
					Load
				</ReactTooltip>
				<ReactTooltip id='tt-new' type='dark' place='top' effect='float' delayShow={800}>
					New
				</ReactTooltip>
				<ReactTooltip id='tt-recordings' type='dark' place='top' effect='float' delayShow={800}>
					Recordings
				</ReactTooltip>
				<ReactTooltip id='tt-mute' type='dark' place='top' effect='float' delayShow={800}>
					Mute
				</ReactTooltip>
				<ReactTooltip id='tt-help' type='dark' place='top' effect='float' delayShow={800}>
					Help
				</ReactTooltip>
			</div>
			<div className={s.volume}>
				<MdVolumeUp
					className={cn(s.volumeMute, muted && s.toggle)}
					data-tip
					data-for={'tt-mute'}
					onClick={() => props.onMute(!muted)}
				/>
				<MasterFader onVolume={(vol) => props.onVolume(vol)} volume={volume} init={init} />
			</div>
			<div className={s.settings}>
				<Select
					value={model}
					options={models.map((m) => ({ label: m.name, value: m.name }))}
					onChange={(val) => props.onLoadModel(val as string)}
				/>

				{midiDevices.length > 0 ? (
					<Select
						value={midiDeviceId}
						options={midiDevices.map((d) => ({ label: d.name, value: d.deviceId }))}
						onChange={(id) => props.onMidiDeviceChange(id as string)}
					/>
				) : (
					<Select
						value={0}
						options={[
							{
								label: midiSupported ? 'MIDI not connected' : 'MIDI not supported',
								value: 0,
							},
						]}
					/>
				)}
				{inputDevices.length > 0 ? (
					<Select
						value={inputDeviceId}
						options={inputDevices.map((d) => ({ label: d.label, value: d.deviceId }))}
						onChange={(id) => props.onDeviceChange(id as string)}
					/>
				) : (
					<Select
						value={0}
						options={[{ label: 'Choose Input', value: 0 }]}
						onClick={() => props.onRequestInput()}
					/>
				)}
			</div>
		</div>
	);
}

export interface ControlsProps {
	init?: boolean;
	show?: boolean;
	models: { name: string }[];
	model?: string;
	volume?: number;
	locked?: boolean;
	looping?: boolean;
	playing?: boolean;
	muted?: boolean;
	paused?: boolean;
	duration?: number;
	rate?: number;
	controls?: boolean;
	fullscreen?: boolean;
	recording?: boolean;
	recordings: Recording[];
	recordingProgress?: Record<string, unknown>;
	showRecordings?: boolean;
	showHelp?: boolean;
	midiSupported?: boolean;
	midiDevices: { name: string; deviceId: string }[];
	midiDeviceId?: string | null;
	inputDevices: { label: string; deviceId: string }[];
	inputDeviceId?: string | null;
	onRequestInput: () => void;
	onFullscreen: (on: boolean) => void;
	onLoadModel: (model: string) => void;
	onVolume: (vol: number) => void;
	onMute: (on: boolean) => void;
	onLoop: (on: boolean) => void;
	onLocked: (on: boolean) => void;
	onRecord: (on: boolean) => void;
	onDeviceChange: (deviceId: string) => void;
	onOutputDeviceChange: (deviceId: string) => void;
	onMidiDeviceChange: (midiDeviceId: string) => void;
	onControls: (on: boolean) => void;
	onSave: () => void;
	onLoad: () => void;
	onToggleNewSet: () => void;
	onToggleRecordings: (on: boolean) => void;
	onToggleHelp: (on: boolean) => void;
}