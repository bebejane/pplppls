// @ts-nocheck
import { baseEffect, Utils, createEffectBase } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * Convolver: loads the impulse file on the main thread (fetch + decode),
 * posts the channel data to the pp-convolver worklet, which runs a uniform
 * partitioned overlap-save convolution. Dry path stays live until the
 * impulse arrives, matching the old ConvolverNode behavior.
 */
const Convolver = function (context, options = {}) {
	this.context = context;
	this.options = { ...options };
	this.defaults = {
		mix: { value: 0.5, max: 1, min: 0, type: 'float' },
	};
	const init = {};
	Object.keys(this.defaults).forEach((k) => {
		init[k] = options[k] !== undefined && options[k] !== null ? options[k] : this.defaults[k].value;
	});
	this.inputNode = this.outputNode = this.node = createWorkletEffectNode(context, 'pp-convolver', init);
	createEffectBase.call(this, context, options, this.defaults);

	if (!options.impulse) {
		console.error('No impulse file specified.');
		return;
	}
	fetch(options.impulse)
		.then((res) => res.arrayBuffer())
		.then((data) => context.decodeAudioData(data))
		.then((buffer) => {
			const channels = [];
			const n = Math.min(2, buffer.numberOfChannels);
			for (let i = 0; i < n; i++) channels.push(buffer.getChannelData(i));
			this.node.port.postMessage({ type: 'ir', channels });
			if (this.callback && Utils.isFunction(this.callback)) this.callback();
		})
		.catch((error) => {
			error = error || new Error('Error decoding impulse file');
			console.error('Error while fetching impulse file', error);
			if (this.callback && Utils.isFunction(this.callback)) this.callback(error);
		});
};

Convolver.prototype = Object.create(baseEffect, {
	mix: {
		enumerable: true,

		get: function () {
			return this.options.mix;
		},
		set: function (mix) {
			if (!Utils.isInRange(mix, 0, 1)) return;
			this.options.mix = mix;
			const p = this.node.parameters.get('mix');
			p.setTargetAtTime(mix, this.context.currentTime, 0.02);
		},
	},
});
export default Convolver