// @ts-nocheck
import { baseEffect, Utils, createEffectBase } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * Distortion (wave-shaper). The exact per-sample curve from the original
 * `adjustGain`/StackOverflow waveshaper runs in the pp-distortion worklet.
 */
const Distortion = function (context, options = {}) {
	this.context = context;
	this.options = { ...options };
	this.defaults = {
		gain: { value: 0.5, max: 1, min: 0, type: 'float' },
	};
	const init = {};
	Object.keys(this.defaults).forEach((k) => {
		init[k] = options[k] !== undefined && options[k] !== null ? options[k] : this.defaults[k].value;
	});
	this.inputNode = this.outputNode = this.node = createWorkletEffectNode(context, 'pp-distortion', init);
	createEffectBase.call(this, context, options, this.defaults);
};

Distortion.prototype = Object.create(baseEffect, {
	/**
	 * Gets and sets the gain (amount of distortion).
	 */
	gain: {
		enumerable: true,

		get: function () {
			return this.options.gain;
		},

		set: function (gain) {
			if (!Utils.isInRange(gain, 0, 1)) return;
			this.options.gain = gain;
			this.node.parameters.get('gain').value = gain;
		},
	},
});
export default Distortion