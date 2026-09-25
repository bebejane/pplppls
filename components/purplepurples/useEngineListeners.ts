'use client';

import Global from '@/lib/Global';
import { useEffect } from 'react';

/**
 * Subscribes to engine events and mirrors them into component state.
 * Needs mutable access to latest state (stateRef) for the 'ready' handler.
 */
export function useEngineListeners(
	set: (patch: Partial<Record<string, any>>) => void,
	setCols: (updater: (cols: Record<string, any>) => Record<string, any>) => void,
	stateRef: React.MutableRefObject<Record<string, any>>,
) {
	useEffect(() => {
		const engine = Global.engine;
		if (!engine) return;

		const onInputDevices = (devices: unknown) => set({ inputDevices: devices });
		const onMidiDevices = (devices: unknown) => set({ midiDevices: devices });

		const onMasterState = (masterstate: unknown) => set({ masterstate });

		const onRecordingProgress = (prog: unknown) => set({ recordingProgress: prog });

		const onLoadingProgress = (progress: unknown) => set({ progress });

		const onLoadError = (id: string, err: unknown) => {
			setCols((cols) => ({
				...cols,
				[id]: { ...(cols[id] as object), error: err },
			}));
		};

		const onError = (err: unknown) => {
			console.log('ENGINE ERROR', err);
		};

		const onReady = (id: string, status: { total: number; ready: number }) => {
			const st = stateRef.current;
			const notification = {
				message: 'Loading',
				description: status.ready + '/' + status.total,
			};
			const progress = { loaded: status.ready, total: status.total };
			if (status.ready === status.total) {
				set({
					loading: false,
					model: st.model,
					notification: null,
					progress: null,
					init: true,
				});
			} else {
				set({ notification, progress });
			}
		};

		const onState = () => {};

		engine.on('inputdevices', onInputDevices);
		engine.on('mididevices', onMidiDevices);
		engine.on('masterstate', onMasterState);
		engine.on('recordingprogress', onRecordingProgress);
		engine.on('loadingprogress', onLoadingProgress);
		engine.on('loaderror', onLoadError);
		engine.on('error', onError);
		engine.on('ready', onReady);
		engine.on('state', onState);

		return () => {
			engine.off('inputdevices', onInputDevices);
			engine.off('mididevices', onMidiDevices);
			engine.off('masterstate', onMasterState);
			engine.off('recordingprogress', onRecordingProgress);
			engine.off('loadingprogress', onLoadingProgress);
			engine.off('loaderror', onLoadError);
			engine.off('error', onError);
			engine.off('ready', onReady);
			engine.off('state', onState);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
}