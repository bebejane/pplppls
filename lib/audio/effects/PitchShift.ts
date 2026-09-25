// @ts-nocheck
import { baseEffect, Utils, createEffectBase } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * Pitch shift — real-time granular transposer. Previously relied on the
 * removed `pitch-shift` npm module (unreachable): the DSP now runs in the
 * pp-pitchshift worklet (frame-hop + overlap-add + scaled-grain splicing,
 * ported from that module). `pitchShift` is the semitone-free rate factor:
 * 1.0 = unity, >1 raises pitch.
 */
const PitchShift = function (context, options = {}) {
	this.context = context;
	this.options = { ...options };
	this.defaults = {
		pitchShift: { value: 1.0, max: 2, min: 0.5, type: 'float' },
		// informational plumbing kept from the original (used by the DSP)
		frameSize: { value: 512, max: 2048, min: 128, type: 'integer' },
		dataSize: { value: 512, max: 2048, min: 128, type: 'integer' },
	};
	const init = {};
	Object.keys(this.defaults).forEach((k) => {
		init[k] = options[k] !== undefined && options[k] !== null ? options[k] : this.defaults[k].value;
	});
	this.inputNode = this.outputNode = this.node = createWorkletEffectNode(context, 'pp-pitchshift', {
		pitchShift: init.pitchShift,
	});
	createEffectBase.call(this, context, options, this.defaults);
};

PitchShift.prototype = Object.create(baseEffect, {
	pitchShift: {
		enumerable: true,
		get: function () {
			return this.options.pitchShift;
		},
		set: function (pitchShift) {
			this.options.pitchShift = pitchShift;
			this.node.parameters.get('pitchShift').value = pitchShift;
		},
	},
});

export default PitchShift