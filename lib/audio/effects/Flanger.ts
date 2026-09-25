// @ts-nocheck
import { baseEffect, Utils, createEffectBase } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * Flanger — modulated (sine-LFO) fractional delay with feedback. The DSP
 * (base delay, LFO rate/depth mapping, feed loop, dry/wet) runs in the
 * pp-flanger worklet; the same normalized ranges as the original node graph.
 */
const Flanger = function (context, options = {}) {
	this.context = context;
	this.options = { ...options };
	this.defaults = {
		time: { value: 0.45, max: 1, min: 0, type: 'float' },
		speed: { value: 0.2, max: 1, min: 0, type: 'float' },
		depth: { value: 0.1, max: 1, min: 0, type: 'float' },
		feedback: { value: 0.5, max: 1, min: 0, type: 'float' },
		mix: { value: 0.5, max: 1, min: 0, type: 'float' },
	};
	const init = {};
	Object.keys(this.defaults).forEach((k) => {
		init[k] = options[k] !== undefined && options[k] !== null ? options[k] : this.defaults[k].value;
	});
	this.inputNode = this.outputNode = this.node = createWorkletEffectNode(context, 'pp-flanger', init);
	createEffectBase.call(this, context, options, this.defaults);
};

Flanger.prototype = Object.create(baseEffect, {
	time: {
		enumerable: true,

		get: function () {
			return this.options.time;
		},
		set: function (time) {
			if (!Utils.isInRange(time, 0, 1)) return;
			this.options.time = time;
			this.node.parameters.get('time').value = time;
		},
	},

	speed: {
		enumerable: true,

		get: function () {
			return this.options.speed;
		},
		set: function (speed) {
			if (!Utils.isInRange(speed, 0, 1)) return;
			this.options.speed = speed;
			this.node.parameters.get('speed').value = speed;
		},
	},

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

	feedback: {
		enumerable: true,

		get: function () {
			return this.options.feedback;
		},
		set: function (feedback) {
			if (!Utils.isInRange(feedback, 0, 1)) return;
			this.options.feedback = feedback;
			this.node.parameters.get('feedback').value = feedback;
		},
	},

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
});
export default Flanger