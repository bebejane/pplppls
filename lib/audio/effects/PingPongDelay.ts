// @ts-nocheck
import { baseEffect, Utils, createEffectBase } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * Ping-pong delay (delay L -> delay R, feedback back to L). DSP in the
 * pp-pingpongdelay worklet; wet output is stereo (L tap / R tap).
 */
const PingPongDelay = function (context, options = {}) {
	this.context = context;
	this.options = { ...options };
	this.defaults = {
		feedback: { value: 0.5, max: 1, min: 0, type: 'float' },
		time: { value: 0.3, max: 1, min: 0, type: 'float' },
		mix: { value: 0.5, max: 1, min: 0, type: 'float' },
	};
	const init = {};
	Object.keys(this.defaults).forEach((k) => {
		init[k] = options[k] !== undefined && options[k] !== null ? options[k] : this.defaults[k].value;
	});
	this.inputNode = this.outputNode = this.node = createWorkletEffectNode(context, 'pp-pingpongdelay', init);
	createEffectBase.call(this, context, options, this.defaults);
};

PingPongDelay.prototype = Object.create(baseEffect, {
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
			if (!Utils.isInRange(time, 0, 180)) return;
			this.options.time = time;
			this.node.parameters.get('time').value = time;
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
			if (!Utils.isInRange(feedback, 0, 1)) return;
			this.options.feedback = parseFloat(feedback, 10);
			this.node.parameters.get('feedback').value = this.feedback;
		},
	},
});
export default PingPongDelay