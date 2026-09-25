/**
 * Recorder AudioWorklet processor source, loaded via a Blob URL (see
 * Recorder#initProcessor). Kept as a string so it can be delivered as
 * text/javascript regardless of how the bundler hashes/emits assets
 * (`audioWorklet.addModule` requires a JS MIME type, which raw `.ts` assets
 * don't get). Input is passed through to the output so the source stays
 * audible while recording, exactly like the old ScriptProcessorNode.
 */
export const RECORDER_WORKLET_SOURCE = `
const CHUNK_SIZE = 16384;
class PurplePurplesRecorderProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.channels = [];
	}
	flush() {
		if (!this.channels.length || !this.channels[0].length) return;
		const n = Math.max(1, this.channelCount || this.channels.length || 1);
		const buffers = [];
		for (let c = 0; c < n; c++) {
			buffers[c] = this.channels[c] ? new Float32Array(this.channels[c]) : new Float32Array(0);
		}
		this.channels = [];
		this.port.postMessage({ buffer: buffers });
	}
	process(inputs, outputs) {
		const input = inputs[0] || [];
		for (let c = 0; c < input.length; c++) {
			const ch = input[c];
			if (!ch || !ch.length) continue;
			if (!this.channels[c]) this.channels[c] = [];
			const target = this.channels[c];
			for (let i = 0; i < ch.length; i++) target.push(ch[i]);
		}
		const output = outputs[0] || [];
		for (let c = 0; c < output.length; c++) {
			if (input[c] && output[c]) output[c].set(input[c]);
		}
		if (this.channels[0] && this.channels[0].length >= CHUNK_SIZE) this.flush();
		return true;
	}
}
registerProcessor('purplepurples-recorder', PurplePurplesRecorderProcessor);
`;

export default RECORDER_WORKLET_SOURCE;