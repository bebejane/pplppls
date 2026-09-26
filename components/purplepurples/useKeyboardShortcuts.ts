'use client';

import Global from '@/lib/Global';
import { useEffect } from 'react';

export interface KeyboardHandlers {
	onRecord: (on: boolean) => void;
	toggleSave: () => void;
	toggleControls: () => void;
	toggleFullscreen: () => void;
	randomValues: () => void;
	pressSlot: (key: number) => void;
	closeDialogs: () => void;
	toggleHud: () => void;
	stop: () => void;
	masterstate: Record<string, any>;
	hud: boolean;
	recording: boolean;
}

/**
 * Global keyboard shortcuts (space record, enter play, v/m/p/s/c/f/b, 0-9 presets, esc).
 * Reads a mutable handlers ref so it never needs re-subscribing.
 */
export function useKeyboardShortcuts(handlersRef: React.MutableRefObject<KeyboardHandlers>) {
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).tagName === 'INPUT') return;
			const ctrlKey = e.metaKey || e.ctrlKey;
			const H = handlersRef.current;
			switch (e.key) {
				case ' ':
				case 'Space':
					ctrlKey && H.onRecord(!H.recording);
					!ctrlKey && H.stop();
					break;
				case 'Enter':
					Global.engine.master.play();
					//else Global.engine.master.stop();
					break;
				case 'esc':
					H.closeDialogs();
					break;
				case 'v':
					H.toggleHud();
					break;
				case 'm':
					Global.engine.master.mute(!Global.engine.master.muted());
					break;
				case 'p':
					Global.engine.pause();
					break;
				case 's':
					H.toggleSave();
					break;
				case 'c':
					H.toggleControls();
					break;
				case 'f':
					H.toggleFullscreen();
					break;
				case 'b':
					H.randomValues();
					break;
				case 'x':
					H.stop();
					break;
				default:
					// 0-9 play that key's preset, or generate one when the slot is empty
					if (e.key.length === 1 && e.key >= '0' && e.key <= '9') {
						H.pressSlot(parseInt(e.key, 10));
					}
					break;
			}
		};
		document.body.addEventListener('keydown', onKeyDown);
		return () => document.body.removeEventListener('keydown', onKeyDown);
	}, []);
}
