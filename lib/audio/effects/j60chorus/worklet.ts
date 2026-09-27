/**
 * J60 Chorus AudioWorklet loader.
 *
 * The chorus lives in its own worklet module — like the recorder worklet —
 * because it needs no shared state with the effect catalog and its Blob-URL
 * source stays self-contained. `ensureJ60ChorusWorklet` registers
 * `pp-j60chorus` once per AudioContext; `createEffect` awaits it before
 * building a `J60Chorus` node (see effects/index.ts).
 */
import { J60CHORUS_WORKLET_SOURCE } from './source'

const workletPromises = new WeakMap<AudioContext, Promise<void>>();

const loadJ60ChorusWorklet = async (context: AudioContext): Promise<void> => {
	const blob = new Blob([J60CHORUS_WORKLET_SOURCE], { type: 'text/javascript' });
	const url = URL.createObjectURL(blob);
	try {
		await context.audioWorklet.addModule(url);
	} finally {
		URL.revokeObjectURL(url);
	}
};

/**
 * Register the J60 chorus worklet on `context` (idempotent per context).
 * Effect construction must await this before creating the AudioWorkletNode.
 */
export const ensureJ60ChorusWorklet = (context: AudioContext): Promise<void> => {
	let promise = workletPromises.get(context);
	if (!promise) {
		promise = loadJ60ChorusWorklet(context).catch((err) => {
			workletPromises.delete(context);
			throw err;
		});
		workletPromises.set(context, promise);
	}
	return promise;
};
