'use client';

import {
	MdPlayArrow,
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
import s from './HelpDialog.module.scss';

export default function HelpDialog({ onClose }: { onClose: () => void }) {
	return (
		<div className={s.dialog} onMouseMove={(e) => e.stopPropagation()}>
			<div className={s.box}>
				<div className={s.close} onClick={onClose}>
					X
				</div>
				<div>
					<table>
						<tbody>
							<tr>
								<td colSpan={2}>
									<b>Keys</b>
								</td>
							</tr>
							<tr>
								<td>SPACE</td>
								<td>Toggle Record</td>
							</tr>
							<tr>
								<td>RETURN</td>
								<td>Play all</td>
							</tr>
							<tr>
								<td>C</td>
								<td>Toggle Controls</td>
							</tr>
							<tr>
								<td>F</td>
								<td>Toggle Fullscreen</td>
							</tr>
							<tr>
								<td>S</td>
								<td>Toggle Save</td>
							</tr>
							<tr>
								<td>M</td>
								<td>Toggle Mixer</td>
							</tr>
							<tr>
								<td>0 - 9</td>
								<td>Play setting, or random one on first press</td>
							</tr>
							<tr>
								<td>B</td>
								<td>Random</td>
							</tr>
							<tr>
								<td>Q</td>
								<td>Other stuff</td>
							</tr>
							<tr>
								<td colSpan={2}>
									<br />
								</td>
							</tr>
							<tr>
								<td colSpan={2}>
									<b>Mouse</b>
								</td>
							</tr>
							<tr>
								<td>Right CLick</td>
								<td>Stop</td>
							</tr>
							<tr>
								<td>CTRL + Click</td>
								<td>Lock</td>
							</tr>
							<tr>
								<td>CTRL + Move</td>
								<td>Change Loop</td>
							</tr>
							<tr>
								<td>CMD + Dbl Click</td>
								<td>Zoom</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div>
					<table>
						<tbody>
							<tr>
								<td colSpan={2}>
									<b>Controls</b>
								</td>
							</tr>
							<tr>
								<td>
									<MdPlayArrow className={s.icon} />
								</td>
								<td>Play/Stop</td>
							</tr>
							<tr>
								<td>
									<MdFiberManualRecord className={s.icon} />
								</td>
								<td>Record</td>
							</tr>
							<tr>
								<td>
									<MdVolumeUp className={s.icon} />
								</td>
								<td>Mute</td>
							</tr>
							<tr>
								<td>
									<MdRepeat className={s.icon} />
								</td>
								<td>Loop</td>
							</tr>
							<tr>
								<td>
									<RiArrowGoBackLine className={s.icon} />
								</td>
								<td>Reverse</td>
							</tr>
							<tr>
								<td>
									<AiOutlineLink className={s.icon} />
								</td>
								<td>Map midi note</td>
							</tr>
							<tr>
								<td>
									<MdSettingsBackupRestore className={s.icon} />
								</td>
								<td>Reset</td>
							</tr>
							<tr>
								<td>
									<AiFillPhone className={s.icon} />
								</td>
								<td>Solo</td>
							</tr>
							<tr>
								<td>
									<TiWaves className={s.icon} />
								</td>
								<td>Waveform</td>
							</tr>
							<tr>
								<td>
									<IoMdLock className={s.icon} />
								</td>
								<td>Lock</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}