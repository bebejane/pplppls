'use client';

import Global from '@/lib/global';
import { useEffect, useState } from 'react';
import ReactTooltip from 'react-tooltip';
import { HorizontalFader } from '@/components/util/Fader';
import VolumeVisualizer from '@/components/visualizers/VolumeVisualizer';
import s from './MasterFader.module.scss';

export default function MasterFader({
	id,
	init,
	volume = 0,
	onVolume,
}: {
	id?: string;
	init?: boolean;
	volume?: number;
	onVolume: (vol: number) => void;
}) {
	const [noteOn, setNoteOn] = useState(false);
	const [velocity, setVelocity] = useState(0);

	useEffect(() => {
		const onNoteOn = (note: any) => {
			setNoteOn(true);
			setVelocity(note.rawVelocity);
		};
		const onNoteOff = () => setNoteOn(false);
		Global.engine.on('noteon', onNoteOn);
		Global.engine.on('noteoff', onNoteOff);
		return () => {
			Global.engine.off('noteon', onNoteOn);
			Global.engine.off('noteoff', onNoteOff);
		};
	}, []);

	return (
		<div className={s.fader}>
			<HorizontalFader
				key={id}
				className={s.slider}
				label='Output volume'
				value={volume}
				min={0}
				max={1}
				onChange={onVolume}
			/>
			<div className={s.meter} data-tip data-for={'tt-output'}>
				<VolumeVisualizer id={'master'} color={'#ffffff'} ready={init} />
			</div>
			<div className={s.meter} data-tip data-for={'tt-midi'}>
				<div
					className={s.midiOn}
					style={{ opacity: noteOn ? 1.0 : 0.0, minHeight: (velocity / 127) * 100 + '%' }}
				></div>
			</div>
			<ReactTooltip id='tt-output' type='dark' place='top' effect='float' delayShow={800}>
				Output volume
			</ReactTooltip>
			<ReactTooltip id='tt-input' type='dark' place='top' effect='float' delayShow={800}>
				Input volume
			</ReactTooltip>
			<ReactTooltip id='tt-midi' type='dark' place='top' effect='float' delayShow={800}>
				Midi In
			</ReactTooltip>
		</div>
	);
}

