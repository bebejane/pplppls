'use client';

import cn from 'classnames';
import type { PresetSlot } from './types';
import s from './PresetBar.module.scss';

/** The 10 number keys, in the order the engine stores their slots. */
export const PRESET_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

/** Preset slot a number key addresses ('0' is the last slot). */
export const keyToSlot = (key: number) => PRESET_KEYS.indexOf(key);

/**
 * Top-centered bar of the 10 preset slots, labelled with their keyboard keys
 * (1-9, then 0). Pressing a key either plays its saved preset or — when the
 * slot is empty — generates a random one and stores it there, so keys without
 * a preset are dimmed but still clickable. Mouse and touch both work; the
 * keyboard handler lights the same key when pressed. The bar hides itself
 * after 5s without a key press and reappears on the next one.
 */
export default function PresetBar({
	visible,
	lit,
	presets,
	onPress,
}: {
	visible: boolean;
	lit: number;
	presets: PresetSlot[];
	onPress: (key: number) => void;
}) {
	if (!visible) return null;
	return (
		<div className={s.bar} role='toolbar' aria-label='saved settings'>
			{PRESET_KEYS.map((k) => {
				const empty = !presets[keyToSlot(k)];
				return (
					<button
						key={k}
						type='button'
						title={empty ? 'create a random setting on ' + k : 'play saved setting ' + k}
						className={cn(s.key, empty && s.empty, !empty && k === lit && s.lit)}
						onClick={() => onPress(k)}
					>
						{k}
					</button>
				);
			})}
		</div>
	);
}
