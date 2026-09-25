// @ts-nocheck
import { baseEffect, Utils, createEffectBase } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * Ring modulator (BBC design): carrier oscillator through diode saturation,
 * summed with the audio, compressed, gain x3. DSP (LFO, diode curves,
 * internal compressor) runs in the pp-ringmodulator worklet.
 */
const RingModulator = function (context, options = {}) {
	this.context = context;
	this.options = { ...options };
	this.defaults = {
		speed: { value: 30, max: 2000, min: 0, type: 'float' },
		distortion: { value: 0.2, max: 50, min: 0.2, type: 'float' },
		mix: { value: 0.5, max: 1, min: 0, type: 'float' },
	};
	const init = {};
	Object.keys(this.defaults).forEach((k) => {
		init[k] = options[k] !== undefined && options[k] !== null ? options[k] : this.defaults[k].value;
	});
	this.inputNode = this.outputNode = this.node = createWorkletEffectNode(context, 'pp-ringmodulator', init);
	createEffectBase.call(this, context, options, this.defaults);
};

RingModulator.prototype = Object.create(baseEffect, {
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
	 * Speed on the input oscillator
	 */
	speed: {
		enumerable: true,

		get: function () {
			return this.options.speed;
		},
		set: function (speed) {
			if (!Utils.isInRange(speed, 0, 2000)) return;
			this.options.speed = speed;
			this.node.parameters.get('speed').value = speed;
		},
	},

	/**
	 * Level of distortion
	 */
	distortion: {
		enumerable: true,

		get: function () {
			return this.options.distortion;
		},
		set: function (distortion) {
			if (!Utils.isInRange(distortion, 0.2, 50)) return;
			this.options.distortion = parseFloat(distortion, 10);
			this.node.parameters.get('distortion').value = this.options.distortion;
		},
	},
});
export default RingModulator