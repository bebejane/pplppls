// @ts-nocheck
import { baseEffect, Utils, createEffectBase } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * Reverb (simple-reverb style): generates a decaying noise impulse response on
 * the main thread (so Math.random + the time/decay/reverse math stay as
 * before) and ships it to the pp-reverb worklet, which runs a uniform
 * partitioned overlap-save convolution. Rebuilding the impulse replaces the
 * internal state, like the old ConvolverNode swap.
 */
const Reverb = function (context, options = {}) {
	this.context = context;
	this.options = { ...options };
	this.defaults = {
		mix: { value: 0.5, max: 1, min: 0, type: 'float' },
		time: { value: 0.001, max: 1, min: 0, type: 'float' },
		decay: { value: 0.1, max: 10, min: 0, type: 'float' },
		reverse: { value: false, max: true, min: false, type: 'boolean' },
	};
	const init = {};
	Object.keys(this.defaults).forEach((k) => {
		init[k] = options[k] !== undefined && options[k] !== null ? options[k] : this.defaults[k].value;
	});
	this.inputNode = this.outputNode = this.node = createWorkletEffectNode(context, 'pp-reverb', { mix: init.mix });
	createEffectBase.call(this, context, options, this.defaults);
	buildImpulse.call(this);
};

Reverb.prototype = Object.create(baseEffect, {
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

	time: {
		enumerable: true,

		get: function () {
			return this.options.time;
		},
		set: function (time) {
			if (!Utils.isInRange(time, 0.0001, 10)) return;
			this.options.time = time;
			buildImpulse.call(this);
		},
	},

	decay: {
		enumerable: true,

		get: function () {
			return this.options.decay;
		},
		set: function (decay) {
			if (!Utils.isInRange(decay, 0.0001, 10)) return;
			this.options.decay = decay;
			buildImpulse.call(this);
		},
	},

	reverse: {
		enumerable: true,

		get: function () {
			return this.options.reverse;
		},
		set: function (reverse) {
			if (!Utils.isBool(reverse)) return;
			this.options.reverse = reverse;
			buildImpulse.call(this);
		},
	},
});

function buildImpulse() {
	var length = Math.max(1, Math.round(this.context.sampleRate * this.time));
	var impulseL = new Float32Array(length);
	var impulseR = new Float32Array(length);
	var i;
	for (i = 0; i < length; i++) {
		var n = this.reverse ? length - i : i;
		impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, this.decay);
		impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, this.decay);
	}
	this.node.port.postMessage({ type: 'ir', channels: [impulseL, impulseR] });
}
export default Reverb