import type { AudioEngine } from './audio/types';

/**
 * Client-only global singleton for the audio engine and small helpers.
 * The engine itself is created lazily by the studio (never during render/SSR).
 */

export interface GlobalSingleton {
	engine: AudioEngine | null;
}

const Global: GlobalSingleton = {
	engine: null,
};

export default Global;
export { Global };
