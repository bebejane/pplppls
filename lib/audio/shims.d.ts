/** Minimal typings for small untyped audio deps used by the engine. */

declare module 'webaudio-peaks' {
	export interface Peaks {
		length: number;
		data: number[][];
		bits: number;
	}
	const extractPeaks: (
		buffer: AudioBuffer,
		spp: number,
		mono: boolean,
		start: number,
		end: number,
		bits: number,
	) => Peaks;
	export default extractPeaks;
}

declare module 'bpm' {
	class BPM {
		constructor();
		[key: string]: unknown;
	}
	export default BPM;
}
