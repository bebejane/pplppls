// @ts-nocheck
import { baseEffect, Utils, createEffectBase } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * Feed-forward compressor. DSP (envelope follower + gain computer modeling the
 * DynamicsCompressorNode) runs in the pp-compressor worklet.
 */
const Compressor = function (context, options = {}) {
	this.context = context;
	this.options = { ...options };
	this.defaults = {
		threshold: { value: -24, max: 0, min: -100, type: 'integer' },
		knee: { value: 30, max: 40, min: 0, type: 'integer' },
		attack: { value: 0, max: 1, min: 0, type: 'integer' },
		release: { value: 0.25, max: 1, min: 0, type: 'integer' },
		ratio: { value: 1, max: 20, min: 0, type: 'integer' },
	};
	const init = {};
	Object.keys(this.defaults).forEach((k) => {
		init[k] = options[k] !== undefined && options[k] !== null ? options[k] : this.defaults[k].value;
	});
	this.inputNode = this.outputNode = this.node = createWorkletEffectNode(context, 'pp-compressor', init);
	createEffectBase.call(this, context, options, this.defaults);
};

Compressor.prototype = Object.create(baseEffect, {
	threshold: {
		enumerable: true,
		get: function () {
			return this.options.threshold;
		},
		set: function (value) {
			if (Utils.isInRange(value, -100, 0)) {
				this.options.threshold = value;
				this.node.parameters.get('threshold').value = value;
			}
		},
	},

	knee: {
		enumerable: true,
		get: function () {
			return this.options.knee;
		},
		set: function (value) {
			if (Utils.isInRange(value, 0, 40)) {
				this.options.knee = value;
				this.node.parameters.get('knee').value = value;
			}
		},
	},

	attack: {
		enumerable: true,
		get: function () {
			return this.options.attack;
		},
		set: function (value) {
			if (Utils.isInRange(value, 0, 1)) {
				this.options.attack = value;
				this.node.parameters.get('attack').value = value;
			}
		},
	},

	release: {
		enumerable: true,
		get: function () {
			return this.options.release;
		},
		set: function (value) {
			if (Utils.isInRange(value, 0, 1)) {
				this.options.release = value;
				this.node.parameters.get('release').value = value;
			}
		},
	},

	ratio: {
		enumerable: true,
		get: function () {
			return this.options.ratio;
		},
		set: function (value) {
			if (Utils.isInRange(value, 1, 20)) {
				this.options.ratio = value;
				this.node.parameters.get('ratio').value = value;
			}
		},
	},

	getCurrentGainReduction: {
		enumerable: true,
		value: function () {
			// the worklet does not expose live reduction; UI does not use it
			return 0;
		},
	},
});
export default Compressor