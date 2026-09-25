'use client';

import Global from '@/lib/Global';
import { useEffect, useRef, useState } from 'react';
import { MdPlayArrow, MdStop } from 'react-icons/md';
import moment from 'moment';
import s from './RecordingsDialog.module.scss';

export interface Recording {
	id: number;
	url: string;
	blob: Blob;
	buffer: Float32Array[];
	mimeType: string;
	filename: string;
	name: string;
	duration: number;
}

export default function RecordingsDialog({
	recordings,
	show,
	onDeleteRecording,
	onDownload,
	onClose,
}: {
	recordings: Recording[];
	show: boolean;
	onDeleteRecording: (id: number) => void;
	onDownload: (id: number, type: 'wav' | 'mp3') => void;
	onClose: () => void;
}) {
	const [playId, setPlayId] = useState<number | null>(null);
	const [elapsed, setElapsed] = useState<Record<number, number>>({});
	const soundRef = useRef<any>(null);

	useEffect(() => {
		return () => {
			if (soundRef.current) soundRef.current.destroy();
		};
	}, []);

	if (!show) return null;

	const play = (id: number, e: React.MouseEvent) => {
		const rec = recordings.filter((r) => r.id === id)[0];
		if (!rec) return;
		Global.engine.stop();
		if (soundRef.current) soundRef.current.destroy();
		const sound = Global.engine.playSound(rec.url, { enableElapsed: true, volume: 1.0 });
		soundRef.current = sound;
		sound.on('ready', () => {
			sound.volume(1.0);
			sound.play();
			setPlayId(id);
		});
		sound.on('elapsed', (el: number) => {
			setElapsed((prev) => ({ ...prev, [id]: el }));
		});
		sound.on('ended', () => {
			setPlayId(null);
		});
		sound.load();
		e.stopPropagation();
	};

	const stop = (e: React.MouseEvent) => {
		if (soundRef.current) soundRef.current.stop();
		setPlayId(null);
		e.stopPropagation();
	};

	const del = (id: number, e: React.MouseEvent) => {
		stop(e);
		onDeleteRecording(id);
	};

	const download = (id: number, type: 'wav' | 'mp3', e: React.MouseEvent) => {
		onDownload(id, type);
		e.stopPropagation();
	};

	const formatDuration = (sec: number, rate?: number) => {
		const time = moment.utc(moment.duration(rate ? sec / rate : sec, 'seconds').asMilliseconds());
		return time.format((time.hours() > 0 ? 'HH:' : '') + 'mm:ss');
	};

	return (
		<div
			className={s.dialog}
			onMouseMove={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
			onClick={(e) => e.stopPropagation()}
		>
			<div className={s.box}>
				<div className={s.header}>Recordings</div>
				{recordings.length > 0 &&
					recordings.map((r) => (
						<div className={s.row} key={r.id}>
							<div className={s.tools}>
								{playId !== r.id ? (
									<MdPlayArrow onClick={(e) => play(r.id, e)} />
								) : (
									<MdStop onClick={(e) => stop(e)} />
								)}
							</div>
							<div className={s.label}>
								{r.filename.replace('.wav', '')}&nbsp;-&nbsp;
								<div className={s.duration}>
									{formatDuration(elapsed[r.id] || r.duration)}
								</div>
							</div>
							<div className={s.tools}>
								<div className={s.download} onClick={(e) => download(r.id, 'wav', e)}>
									WAV
								</div>
								<div className={s.download} onClick={(e) => download(r.id, 'mp3', e)}>
									MP3
								</div>
								<div className={s.download} onClick={(e) => del(r.id, e)}>
									DELETE
								</div>
							</div>
						</div>
					))}
				{recordings.length === 0 && <div className={s.empty}>Nix hier...</div>}
				<div
					className={s.close}
					onClick={(e) => {
						stop(e);
						onClose();
					}}
				>
					X
				</div>
			</div>
		</div>
	);
}