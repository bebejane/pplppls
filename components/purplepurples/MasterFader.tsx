'use client';

import Global from '@/lib/Global';
import { useEffect, useState } from 'react';
import Slider from 'react-input-slider';
import ReactTooltip from 'react-tooltip';
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
			<Slider
				key={id}
				axis='x'
				xmax={100}
				xmin={0}
				x={volume * 100}
				xstep={1}
				onChange={(axis: any) => onVolume(axis.x / 100)}
				styles={sliderStyle}
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

const trackHeight = 20;
const sliderStyle = {
	track: {
		height: '100%',
		width: '100px',
		maxHeight: trackHeight,
		minHeight: trackHeight,
		backgroundColor: '#4f0b4a !important',
		borderRadius: 0,
		marginRight: 10,
	},
	active: {
		backgroundColor: '#7d3866',
		borderRadius: 0,
	},
	thumb: {
		width: 20,
		height: trackHeight + 2,
		borderRadius: 0,
		backgroundColor: 'rgb(106, 30, 98)',
	},
	disabled: {
		opacity: 0.5,
	},
};