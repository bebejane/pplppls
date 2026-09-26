// @ts-nocheck
import { baseEffect, Utils, createEffectBase } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * Stone Phaser — 4-stage analog phaser ported from the Faust DSP in
 * jpcima/stone-phaser (BSL-1.0 / CC0-1.0). The whole graph (input and feedback
 * high-passes, four share-one-coefficient allpass stages, LFO) runs in the
 * pp-stonephaser worklet.
 *
 * Unlike the other effects, every control here is already one-pole smoothed
 * inside the DSP (100 ms, Faust "tsmooth"), so the setters write the AudioParam
 * value directly rather than layering `setTargetAtTime` on top — double
 * smoothing would make the phaser feel sluggish.
 */
const StonePhaser = function (context, options = {}) {
	this.context = context;
	this.options = { ...options };
	this.defaults = {
		speed: { value: 0.2, max: 5, min: 0.01, type: 'float' },
		feedback: { value: 0.75, max: 0.99, min: 0, type: 'float' },
		feedbackBassCut: { value: 500, max: 5000, min: 10, type: 'integer' },
		mix: { value: 0.5, max: 1, min: 0, type: 'float' },
		color: { value: true, max: true, min: false, type: 'boolean' },
		phase: { value: 0, max: 180, min: -180, type: 'integer' },
	};
	const init = {};
	Object.keys(this.defaults).forEach((k) => {
		init[k] = options[k] !== undefined && options[k] !== null ? options[k] : this.defaults[k].value;
	});
	// AudioParam data is numeric; "color" is the usual boolean control
	init.color = init.color ? 1 : 0;
	this.inputNode = this.outputNode = this.node = createWorkletEffectNode(context, 'pp-stonephaser', init);
	createEffectBase.call(this, context, options, this.defaults);
};

StonePhaser.prototype = Object.create(baseEffect, {
	/**
	 * LFO frequency in Hz (0.01 - 5).
	 */
	speed: {
		enumerable: true,

		get: function () {
			return this.options.speed;
		},
		set: function (speed) {
			if (!Utils.isInRange(speed, 0.01, 5)) return;
			this.options.speed = speed;
			this.node.parameters.get('speed').value = speed;
		},
	},

	/**
	 * Feedback depth (0 - 0.99).
	 */
	feedback: {
		enumerable: true,

		get: function () {
			return this.options.feedback;
		},
		set: function (feedback) {
			if (!Utils.isInRange(feedback, 0, 0.99)) return;
			this.options.feedback = feedback;
			this.node.parameters.get('feedback').value = feedback;
		},
	},

	/**
	 * Cutoff of the high-pass in the feedback path, in Hz (10 - 5000).
	 */
	feedbackBassCut: {
		enumerable: true,

		get: function () {
			return this.options.feedbackBassCut;
		},
		set: function (cut) {
			if (!Utils.isInRange(cut, 10, 5000)) return;
			this.options.feedbackBassCut = cut;
			this.node.parameters.get('feedbackBassCut').value = cut;
		},
	},

	/**
	 * Dry/wet, equal-power (Faust sin/cos crossfade, not the shared linear one).
	 */
	mix: {
		enumerable: true,

		get: function () {
			return this.options.mix;
		},
		set: function (mix) {
			if (!Utils.isInRange(mix, 0, 1)) return;
			this.options.mix = mix;
			this.node.parameters.get('mix').value = mix;
		},
	},

	/**
	 * "Color" voicing: on = deeper feedback and a lower sweep (80 Hz - 2.2 kHz),
	 * off = lighter feedback and a higher sweep (300 Hz - 6 kHz).
	 */
	color: {
		enumerable: true,

		get: function () {
			return this.options.color;
		},
		set: function (color) {
			if (!Utils.isBool(color)) return;
			this.options.color = color;
			this.node.parameters.get('color').value = color ? 1 : 0;
		},
	},

	/**
	 * Stereo LFO phase offset in degrees (-180 - 180).
	 */
	phase: {
		enumerable: true,

		get: function () {
			return this.options.phase;
		},
		set: function (phase) {
			if (!Utils.isInRange(phase, -180, 180)) return;
			this.options.phase = phase;
			this.node.parameters.get('phase').value = phase;
		},
	},
});
export default StonePhaser
