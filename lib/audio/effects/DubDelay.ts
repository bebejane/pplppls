// @ts-nocheck
import {baseEffect, Utils, createEffectBase} from './core'

const DubDelay = function(context, options = {}) {

	this.context = context;
	this.options = {};
	options = options || this.options;

	this.defaults = {
		feedback: {value:0.6, max:1, min:0, type:'float'},
		time: {value:0.7, max:180.0, min:0, type:'float'},
		mix: {value:0.5, max:1, min:0, type:'float'},
		cutoff: {value:700, max:4000, min:0, type:'integer'}
	};

	this.inputNode = this.context.createGain();
	this.outputNode = this.context.createGain();
	this.dryGainNode = this.context.createGain();
	this.wetGainNode = this.context.createGain();
	this.feedbackGainNode = this.context.createGain();
	this.delayNode = this.context.createDelay();
	this.bqFilterNode = this.context.createBiquadFilter(); 


	// dry mix
	this.inputNode.connect(this.dryGainNode);
	this.dryGainNode.connect(this.outputNode);

	// wet mix
	this.inputNode.connect(this.wetGainNode);
	this.inputNode.connect(this.feedbackGainNode);

	this.feedbackGainNode.connect(this.bqFilterNode);
	this.bqFilterNode.connect(this.delayNode);
	this.delayNode.connect(this.feedbackGainNode);
	this.delayNode.connect(this.wetGainNode);

	this.wetGainNode.connect(this.outputNode);

	createEffectBase.call(this, context, options, this.defaults);
};

DubDelay.prototype = Object.create(baseEffect, {

	/**
	 * Gets and sets the dry/wet mix.
	 */
	mix: {
		enumerable: true,

		get: function() {
			return this.options.mix	;	
		},

		set: function(mix) {
			if (!Utils.isInRange(mix, 0, 1))
				return;

			this.options.mix = mix;
			const mixTime = this.context.currentTime;
			this.dryGainNode.gain.setTargetAtTime(Utils.getDryLevel(this.mix), mixTime, 0.02);
			this.wetGainNode.gain.setTargetAtTime(Utils.getWetLevel(this.mix), mixTime, 0.02);
		}
	},

	/**
	 * Time between each delayed sound
	 */
	time: {
		enumerable: true,

		get: function() {
			return this.options.time;	
		},

		set: function(time) {
			if (!Utils.isInRange(time, 0, 180))
				return;

			this.options.time = time;
			this.delayNode.delayTime.value = time;
		}
	},

	/**
	 * Strength of each of the echoed delayed sounds.
	 */
	feedback: {
		enumerable: true,

		get: function() {
			return this.options.feedback;	
		},

		set: function(feedback) {
			if (!Utils.isInRange(feedback, 0, 1))
				return;

			this.options.feedback = parseFloat(feedback, 10);
			this.feedbackGainNode.gain.value = this.feedback;
		}
	},

	/**
	 * Frequency on delay repeats
	 */
	cutoff: {
		enumerable: true,

		get: function() {
			return this.options.cutoff;	
		},

		set: function(cutoff) {
			if (!Utils.isInRange(cutoff, 0, 4000))
				return;

			this.options.cutoff = cutoff;
			this.bqFilterNode.frequency.value = this.cutoff;
		}
	}



});
export default DubDelay