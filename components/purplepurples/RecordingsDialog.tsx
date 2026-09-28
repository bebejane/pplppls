'use client';

import Global from '@/lib/global';
import { useEffect, useRef, useState } from 'react';
import { MdPause, MdPlayArrow } from 'react-icons/md';
import cn from 'classnames';
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
	const [paused, setPaused] = useState(false);
	const [elapsed, setElapsed] = useState<Record<number, number>>({});
	const soundRef = useRef<any>(null);
	const pausedRef = useRef(false);

	useEffect(() => {
		return () => {
			if (soundRef.current) soundRef.current.destroy();
		};
	}, []);

	if (!show) return null;

	const play = (id: number, e: React.MouseEvent) => {
		e.stopPropagation();
		const rec = recordings.filter((r) => r.id === id)[0];
		if (!rec) return;
		Global.engine.stop();
		if (soundRef.current) soundRef.current.destroy();
		const sound = Global.engine.playSound(rec.url, { enableElapsed: true, volume: 1.0 });
		soundRef.current = sound;
		sound.on('ready', () => {
			sound.volume(1.0);
			sound.play();
			pausedRef.current = false;
			setPlayId(id);
			setPaused(false);
		});
		sound.on('elapsed', (el: number) => {
			// while paused the engine can replay a synthetic elapsed 0 (old
			// engine pause path); keep the readout frozen at the pause point
			if (pausedRef.current) return;
			setElapsed((prev) => ({ ...prev, [id]: el }));
		});
		sound.on('pause', (_id: string, p: boolean) => {
			pausedRef.current = !!p;
			setPaused(!!p);
		});
		sound.on('ended', () => {
			// pause()/seeks stop the source directly, which fires the source's
			// `ended` — only tear down when this was a real end of playback
			if (sound._paused) return;
			sound.destroy();
			soundRef.current = null;
			pausedRef.current = false;
			setPlayId(null);
			setPaused(false);
			setElapsed((prev) => ({ ...prev, [id]: 0 }));
		});
		sound.load();
	};

	const togglePlay = (id: number, e: React.MouseEvent) => {
		e.stopPropagation();
		if (playId === id) {
			const sound = soundRef.current;
			if (!sound) return;
			sound.pause(!paused);
			return;
		}
		play(id, e);
	};

	const stop = () => {
		if (soundRef.current) {
			soundRef.current.destroy();
			soundRef.current = null;
		}
		pausedRef.current = false;
		setPlayId(null);
		setPaused(false);
	};

	const seek = (id: number, rec: Recording, e: React.MouseEvent<HTMLDivElement>) => {
		e.stopPropagation();
		if (playId !== id || !soundRef.current) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
		if (paused) setPaused(false);
		soundRef.current.jump(frac * rec.duration);
	};

	const del = (id: number) => {
		stop();
		onDeleteRecording(id);
	};

	const download = (id: number, type: 'wav' | 'mp3', e: React.MouseEvent) => {
		onDownload(id, type);
		e.stopPropagation();
	};

	const formatDuration = (sec: number) => {
		const time = moment.utc(moment.duration(sec, 'seconds').asMilliseconds());
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
				<div className={s.list}>
					{recordings
						// .concat(recordings)
						// .concat(recordings)
						// .concat(recordings)
						// .concat(recordings)
						.map((r) => {
							const active = playId === r.id;
							const el = elapsed[r.id] || 0;
							const pct = Math.min(100, Math.max(0, (el / (r.duration || 1)) * 100));
							return (
								<div className={cn(s.row, active && s.rowActive)} key={r.id}>
									<div className={s.rowTop}>
										<button
											className={cn(s.playBtn, active && !paused && s.playBtnPlaying)}
											onClick={(e) => togglePlay(r.id, e)}
											title={active && !paused ? 'Pause' : 'Play'}
										>
											{active && !paused ? <MdPause /> : <MdPlayArrow />}
										</button>
										<div className={s.label}>{r.filename.replace('.wav', '')}</div>
										<div className={s.time}>
											<span className={cn(s.elapsed, active && s.elapsedLive)}>
												{formatDuration(el)}
											</span>
											<span className={s.sep}>/</span>
											<span>{formatDuration(r.duration)}</span>
										</div>
									</div>
									<div className={s.progress} onClick={(e) => seek(r.id, r, e)} title='Seek'>
										<div className={s.progressFill} style={{ width: `${pct}%` }} />
										<div
											className={s.progressHandle}
											style={{ left: `calc(${pct}% - 5px)`, opacity: active ? 1 : 0 }}
										/>
									</div>
									<div className={s.rowActions}>
										<div className={s.download} onClick={(e) => download(r.id, 'wav', e)}>
											WAV
										</div>
										<div className={s.download} onClick={(e) => download(r.id, 'mp3', e)}>
											MP3
										</div>
										<div className={s.delete} onClick={() => del(r.id)}>
											DELETE
										</div>
									</div>
								</div>
							);
						})}
					{recordings.length === 0 && <div className={s.empty}>Nix hier...</div>}
				</div>
				<div
					className={s.close}
					onClick={() => {
						stop();
						onClose();
					}}
				>
					X
				</div>
			</div>
		</div>
	);
}
