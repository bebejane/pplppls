// @ts-nocheck
import { baseEffect, Utils, createEffectBase } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * Feedback delay. DSP runs in the pp-delay AudioWorklet; `time` is automated
 * exactly like the old native DelayNode (cancel + exp ramp), `mix` keeps the
 * setTargetAtTime smoothing.
 */
const Delay = function (context, options = {}) {
	this.context = context;
	this.options = { ...options };
	this.defaults = {
		feedback: { value: 0.5, max: 1, min: 0, type: 'float' },
		time: { value: 0.1, max: 1.0, min: 0, type: 'float' },
		mix: { value: 0.5, max: 1, min: 0, type: 'float' },
	};
	const init = {};
	Object.keys(this.defaults).forEach((k) => {
		init[k] = options[k] !== undefined && options[k] !== null ? options[k] : this.defaults[k].value;
	});
	this.inputNode = this.outputNode = this.node = createWorkletEffectNode(context, 'pp-delay', init);
	createEffectBase.call(this, context, options, this.defaults);
};

Delay.prototype = Object.create(baseEffect, {
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
	 * Time between each delayed sound
	 */
	time: {
		enumerable: true,

		get: function () {
			return this.options.time;
		},
		set: function (time) {
			if (!Utils.isInRange(time, 0, 180) && this.options.time !== time) return;
			const p = this.node.parameters.get('time');
			const ct = this.context.currentTime;
			p.cancelScheduledValues(ct);
			p.setValueAtTime(this.options.time || time, ct + 0.2);
			p.exponentialRampToValueAtTime(Math.max(0.0001, time), ct + 0.5);
			this.options.time = time;
		},
	},

	/**
	 * Strength of each of the echoed delayed sounds.
	 */
	feedback: {
		enumerable: true,

		get: function () {
			return this.options.feedback;
		},
		set: function (feedback) {
			if (!Utils.isInRange(feedback, 0, 1) && this.options.feedback !== feedback) return;
			const p = this.node.parameters.get('feedback');
			const ct = this.context.currentTime;
			p.cancelScheduledValues(ct);
			p.setValueAtTime(this.options.feedback || feedback, ct + 0.01);
			p.linearRampToValueAtTime(feedback, ct + 0.5);
			this.options.feedback = feedback;
		},
	},
});
export default Delay