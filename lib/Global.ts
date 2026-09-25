import type { AudioEngine } from './audio/types';

/**
 * Client-only global singleton for the audio engine and small helpers.
 * The engine itself is created lazily by the studio (never during render/SSR).
 */

export interface GlobalSingleton {
	engine: AudioEngine | null;
	bpm: number;
	fileToMimeType: (filename?: string | null) => string | null;
}

const Global: GlobalSingleton = {
	engine: null,
	bpm: 120,
	fileToMimeType: (filename) => {
		if (!filename) return filename ?? null;
		const file = filename.toLowerCase();
		if (file.endsWith('.mp3')) return 'audio/mpeg';
		if (file.endsWith('.mp4') || file.endsWith('.m4a')) return 'audio/mp4';
		if (file.endsWith('.wav')) return 'audio/wav';
		if (file.endsWith('.ogg')) return 'audio/ogg';
		if (file.endsWith('.aif')) return 'audio/aiff';
		if (file.endsWith('.webm')) return 'audio/webm';
		return null;
	},
};

export default Global;
export { Global };