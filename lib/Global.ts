import type { AudioEngineFacade } from 'audio-engine';

/**
 * Client-only global singleton for the audio engine and small helpers.
 * The engine itself is created lazily by the studio (never during render/SSR).
 */

export interface GlobalSingleton {
	engine: AudioEngineFacade | null;
}

const Global: GlobalSingleton = {
	engine: null,
};

export default Global;
export { Global };
