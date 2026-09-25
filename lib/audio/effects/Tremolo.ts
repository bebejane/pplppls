// @ts-nocheck
import { baseEffect, Utils, createEffectBase } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * Tremolo (sine LFO amplitude modulation). DSP in the pp-tremolo worklet;
 * the depth curve and dry/wet mirror the original shaper + gain graph.
 */
const Tremolo = function (context, options = {}) {
	this.context = context;
	this.options = { ...options };
	this.defaults = {
		speed: { value: 4, max: 20, min: 0, type: 'integer' },
		depth: { value: 0.5, max: 1, min: 0, type: 'float' },
		mix: { value: 0.5, max: 1, min: 0, type: 'float' },
	};
	const init = {};
	Object.keys(this.defaults).forEach((k) => {
		init[k] = options[k] !== undefined && options[k] !== null ? options[k] : this.defaults[k].value;
	});
	this.inputNode = this.outputNode = this.node = createWorkletEffectNode(context, 'pp-tremolo', init);
	createEffectBase.call(this, context, options, this.defaults);
};

Tremolo.prototype = Object.create(baseEffect, {
	/**
	 * Gets and sets the dry/wet mix.
	 */
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

	/**
	 * Speed of the tremolo
	 */
	speed: {
		enumerable: true,

		get: function () {
			return this.options.speed;
		},
		set: function (speed) {
			if (!Utils.isInRange(speed, 0, 20)) return;
			this.options.speed = speed;
			this.node.parameters.get('speed').value = speed;
		},
	},

	/**
	 * Depth of the tremolo
	 */
	depth: {
		enumerable: true,

		get: function () {
			return this.options.depth;
		},
		set: function (depth) {
			if (!Utils.isInRange(depth, 0, 1)) return;
			this.options.depth = depth;
			this.node.parameters.get('depth').value = depth;
		},
	},
});
export default Tremolo