'use client';

import Global from '@/lib/global';
import cn from 'classnames';
import s from './EqEditor.module.scss';
import { useCallback, useEffect, useState } from 'react';
import type { EqBand, EqBandType, EqBandOptions } from 'audio-engine';
import { HorizontalFader } from '@/components/util/Fader';

const TYPES: EqBandType[] = ['lowshelf', 'peaking', 'highshelf', 'lowpass', 'highpass'];
const LABELS = ['Low', 'Low Mid', 'High Mid', 'High'];
// 20 Hz … 20 kHz on a log slider (t in [0,1])
const FREQ_MIN = 20;
const FREQ_MAX = 20000;
const freqToT = (f: number) =>
	Math.log(Math.max(FREQ_MIN, Math.min(FREQ_MAX, f)) / FREQ_MIN) / Math.log(FREQ_MAX / FREQ_MIN);
const tToFreq = (t: number) =>
	Math.round(FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, Math.max(0, Math.min(1, t))));

/**
 * 4-band channel-EQ editor for one sound, opened from a Mixer channel strip.
 *
 * The EQ lives in the channel processor: this popup mirrors the sound's
 * `eq<id>` events and calls `engine.eq(id, band, options)` for edits.
 */
export default function EqEditor({
	id,
	filename,
	onClose,
}: {
	id: string;
	filename?: string;
	onClose: () => void;
}) {
	const readBands = useCallback((): EqBand[] => {
		const live = Global.engine?.eq?.(id);
		return Array.isArray(live) ? live : [];
	}, [id]);

	const [bands, setBands] = useState<EqBand[]>(readBands);

	useEffect(() => {
		setBands(readBands());
		const onEq = () => setBands(readBands());
		Global.engine.on('eq' + id, onEq);
		return () => {
			Global.engine.off('eq' + id, onEq);
		};
	}, [id, readBands]);

	const name =
		(Global.engine?.get?.(id)?.sound as Record<string, any> | undefined)?._filename ||
		filename ||
		id;

	const set = (band: number, patch: EqBandOptions) => Global.engine.eq(id, band, patch);
	const anyOn = bands.some((b) => b && b.on);

	return (
		<div className={s.overlay} onMouseMove={(e) => e.stopPropagation()}>
			<div className={s.dialog}>
				<div className={s.header}>
					<div className={s.title}>
						EQ <span className={s.sound}>{name}</span>
					</div>
					<div className={s.actions}>
						<button
							type='button'
							className={cn(s.flatBtn, !anyOn && s.on)}
							onClick={() =>
								bands.forEach((_, i) =>
									set(i, {
										on: false,
										gain: 0,
										type: TYPES[i] as EqBandType,
										frequency: [100, 300, 2000, 6000][i],
										q: 0.7,
									}),
								)
							}
						>
							Flat
						</button>
						<button type='button' className={s.close} onClick={onClose}>
							X
						</button>
					</div>
				</div>

				<div className={s.bands}>
					{bands.map((b, i) => {
						const hasGain = b.type === 'lowshelf' || b.type === 'peaking' || b.type === 'highshelf';
						return (
							<div key={i} className={cn(s.band, b.on && s.bandOn)}>
								<label className={s.on}>
									<input
										type='checkbox'
										checked={!!b.on}
										onChange={(e) => set(i, { on: e.target.checked })}
									/>
								</label>
								<div className={s.bandLabel}>{LABELS[i]}</div>
								<select
									className={s.type}
									value={b.type}
									onChange={(e) => set(i, { type: e.target.value as EqBandType })}
								>
									{TYPES.map((t) => (
										<option key={t} value={t}>
											{t}
										</option>
									))}
								</select>

								<div className={s.param}>
									<span className={s.k}>Freq</span>
									<HorizontalFader
										label={`${LABELS[i]} frequency`}
										value={freqToT(b.frequency)}
										min={0}
										max={1}
										step={0.001}
										perPixel={400}
										onChange={(t) => set(i, { frequency: tToFreq(t) })}
									/>
									<span className={s.v}>{Math.round(b.frequency)} Hz</span>
								</div>

								<div className={cn(s.param, !hasGain && s.disabled)}>
									<span className={s.k}>Gain</span>
									<HorizontalFader
										label={`${LABELS[i]} gain`}
										value={b.gain}
										min={-18}
										max={18}
										step={0.5}
										disabled={!hasGain}
										onChange={(gain) => set(i, { gain: Number(gain.toFixed(1)), on: true })}
									/>
									<span className={s.v}>
										{b.gain > 0 ? '+' : ''}
										{b.gain.toFixed(1)} dB
									</span>
								</div>

								<div className={s.param}>
									<span className={s.k}>Q</span>
									<HorizontalFader
										label={`${LABELS[i]} Q`}
										value={b.q}
										min={0.1}
										max={10}
										step={0.1}
										perPixel={300}
										onChange={(q) => set(i, { q: Number(q.toFixed(1)) })}
									/>
									<span className={s.v}>{b.q.toFixed(1)}</span>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
