'use client';

import Global from '@/lib/Global';
import AudioEngine from '@/lib/audio/AudioEngine';
import { useEffect, useState } from 'react';
import PurplePurples from '@/components/purplepurples/PurplePurples';
import NotSupported from '@/components/purplepurples/NotSupported';

/**
 * Client-only root. The WebAudio engine can't exist on the server, so it is
 * constructed lazily on first client mount and cached on the Global singleton.
 */
export default function Studio() {
	const [ready, setReady] = useState(false);
	const [supported, setSupported] = useState(true);

	useEffect(() => {
		if (Global.engine) {
			setReady(true);
			return;
		}
		try {
			Global.engine = new AudioEngine({
				sampleRate: 44100,
				channels: 2,
				volume: 0.5,
				enableAnalysers: true,
				enableElapsed: true,
				enableLoops: true,
				processSample: {
					trim: true,
					normalize: true,
				},
			} as never) as unknown as typeof Global.engine;
			setReady(true);
		} catch (err) {
			console.error(err);
			setSupported(false);
		}
	}, []);

	if (!supported) return <NotSupported />;
	if (!ready) return null;
	return <PurplePurples />;
}