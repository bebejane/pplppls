// @ts-nocheck
import { baseEffect, Utils, createEffectBase } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * QuadraFuzz — 4-band crossover (147/587/2490/4980 Hz) feeding the same
 * distortion curve as the original, summed over the input. DSP in the
 * pp-quadrafuzz worklet.
 */
const Quadrafuzz = function (context, options = {}) {
	this.context = context;
	this.options = { ...options };
	this.defaults = {
		lowGain: { value: 0.6, max: 1, min: 0, type: 'float' },
		midLowGain: { value: 0.8, max: 1, min: 0, type: 'float' },
		midHighGain: { value: 0.5, max: 1, min: 0, type: 'float' },
		highGain: { value: 0.6, max: 1, min: 0, type: 'float' },
	};
	const init = {};
	Object.keys(this.defaults).forEach((k) => {
		init[k] = options[k] !== undefined && options[k] !== null ? options[k] : this.defaults[k].value;
	});
	this.inputNode = this.outputNode = this.node = createWorkletEffectNode(context, 'pp-quadrafuzz', init);
	createEffectBase.call(this, context, options, this.defaults);
};

const bandSetter = (name, index) => ({
	enumerable: true,
	get: function () {
		return this.options[name];
	},
	set: function (value) {
		if (!Utils.isInRange(value, 0, 1)) return;
		this.options[name] = value;
		this.node.parameters.get(name).value = value;
	},
});

Quadrafuzz.prototype = Object.create(baseEffect, {
	lowGain: bandSetter('lowGain', 0),
	midLowGain: bandSetter('midLowGain', 1),
	midHighGain: bandSetter('midHighGain', 2),
	highGain: bandSetter('highGain', 3),
});

export default Quadrafuzz