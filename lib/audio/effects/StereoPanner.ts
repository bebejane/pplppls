// @ts-nocheck
import { baseEffect, Utils, createEffectBase } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * Stereo panner (equal-power). DSP in the pp-stereopanner worklet.
 */
const StereoPanner = function (context, options = {}) {
	this.context = context;
	this.options = { ...options };
	this.defaults = {
		pan: { value: 0, max: 1, min: -1, type: 'integer' },
	};
	const init = {};
	Object.keys(this.defaults).forEach((k) => {
		init[k] = options[k] !== undefined && options[k] !== null ? options[k] : this.defaults[k].value;
	});
	this.inputNode = this.outputNode = this.node = createWorkletEffectNode(context, 'pp-stereopanner', init);
	createEffectBase.call(this, context, options, this.defaults);
};

StereoPanner.prototype = Object.create(baseEffect, {
	/**
	 * Pan position
	 */
	pan: {
		enumerable: true,

		get: function () {
			return this.options.pan;
		},
		set: function (pan) {
			if (!Utils.isInRange(pan, -1, 1)) return;
			this.options.pan = pan;
			this.node.parameters.get('pan').value = pan;
		},
	},
});

export default StereoPanner