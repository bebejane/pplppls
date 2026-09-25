'use client';

import cn from 'classnames';
import s from './SavesBar.module.scss';

/**
 * Top-centered bar of the 10 saved random-value slots, labelled with their
 * keyboard keys (1-9, then 0 — `0` is the most recent save). Keys that have a
 * saved setting are enabled; the rest are shown disabled. Clicking an enabled
 * key plays that slot (mouse and touch both work); the keyboard handler lights
 * the same key when pressed. The bar hides itself after 5s without a
 * number-key press and reappears on the next one.
 */
export default function SavesBar({
	visible,
	lit,
	count,
	onRestore,
}: {
	visible: boolean;
	lit: number;
	count: number;
	onRestore: (slot: number) => void;
}) {
	if (!visible) return null;
	const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
	return (
		<div className={s.bar} role='toolbar' aria-label='saved settings'>
			{keys.map((k) => {
				const idx = k === 0 ? 9 : k - 1; // key '1'..'9' -> slots 0..8, key '0' -> slot 9
				const enabled = idx >= 10 - count; // newest saves fill from slot 9 leftward
				return (
					<button
						key={k}
						type='button'
						disabled={!enabled}
						title={enabled ? 'play saved setting ' + k : 'no setting saved'}
						className={cn(s.key, !enabled && s.disabled, enabled && k === lit && s.lit)}
						onClick={() => onRestore(k)}
					>
						{k}
					</button>
				);
			})}
		</div>
	);
}