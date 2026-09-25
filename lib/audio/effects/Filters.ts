// @ts-nocheck
import { baseEffect, Utils, createEffectBase } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * Biquad filters (lowpass / highpass). The RBJ biquad DSP matching the native
 * BiquadFilterNode runs in the pp-lowpassfilter / pp-highpassfilter worklets.
 */

function commonFilter(context, options, type, processorId) {
	this.options = { ...options };
	this.context = context;
	this.defaults = {
		frequency: { value: 350, max: 22050, min: 10, type: 'integer' },
		peak: { value: 0.0001, max: 1000, min: 0, type: 'float' },
	};
	const init = {};
	Object.keys(this.defaults).forEach((k) => {
		init[k] = options[k] !== undefined && options[k] !== null ? options[k] : this.defaults[k].value;
	});
	this.inputNode = this.outputNode = this.node = createWorkletEffectNode(context, processorId, init);
	this.type = type;
	createEffectBase.call(this, context, options, this.defaults);
}

var filterPrototype = Object.create(baseEffect, {
	/**
	 * The cutoff frequency of the filter.
	 */
	frequency: {
		enumerable: true,

		get: function () {
			return this.options.frequency;
		},
		set: function (value) {
			if (Utils.isInRange(value, 10, 22050)) {
				this.options.frequency = value;
				this.node.parameters.get('frequency').value = value;
			}
		},
	},

	/**
	 * Indicates how peaked the frequency is around the cutoff.
	 */
	peak: {
		enumerable: true,

		get: function () {
			return this.options.peak;
		},
		set: function (value) {
			if (Utils.isInRange(value, 0.0001, 1000)) {
				this.options.peak = value;
				this.node.parameters.get('peak').value = value;
			}
		},
	},
});

// Frequencies below the cutoff frequency pass through; above are attenuated.
const LowPassFilter = function (context, options) {
	commonFilter.call(this, context, options, 'lowpass', 'pp-lowpassfilter');
};

// Frequencies below the cutoff are attenuated; above pass through.
const HighPassFilter = function (context, options) {
	commonFilter.call(this, context, options, 'highpass', 'pp-highpassfilter');
};

LowPassFilter.prototype = filterPrototype;
HighPassFilter.prototype = filterPrototype;
export { LowPassFilter, HighPassFilter }