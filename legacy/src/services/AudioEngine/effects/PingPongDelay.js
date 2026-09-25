import {baseEffect, Utils} from './'

/**
 * Adapted from https://github.com/mmckegg/web-audio-school/blob/master/lessons/3.%20Effects/18.%20Ping%20Pong%20Delay/answer.js
 */

const PingPongDelay = function(context, options) {

	this.context = context;
	this.options = {};
	options = options || this.options;
	
	this.defaults = {
		feedback: {value:0.5, max:1, min:0, type:'float'},
		time: {value:0.3, max:1, min:0, type:'float'},
		mix: {value:0.5, max:1, min:0, type:'float'}
	};

	this.inputNode = this.context.createGain();
	this.outputNode = this.context.createGain();
	this.delayNodeLeft = this.context.createDelay();
	this.delayNodeRight = this.context.createDelay();
	this.dryGainNode = this.context.createGain();
	this.wetGainNode = this.context.createGain();
	this.feedbackGainNode = this.context.createGain();
	this.channelMerger = this.context.createChannelMerger(2);

	// dry mix
	this.inputNode.connect(this.dryGainNode);
	// dry mix out
	this.dryGainNode.connect(this.outputNode);

	// the feedback loop
	this.delayNodeLeft.connect(this.channelMerger, 0, 0);
	this.delayNodeRight.connect(this.channelMerger, 0, 1);
	this.delayNodeLeft.connect(this.delayNodeRight);
	this.feedbackGainNode.connect(this.delayNodeLeft);
	this.delayNodeRight.connect(this.feedbackGainNode);

	// wet mix
	this.inputNode.connect(this.feedbackGainNode);

	// wet out
	this.channelMerger.connect(this.wetGainNode);
	this.wetGainNode.connect(this.outputNode);

	for (var key in this.defaults) {
		this[key] = options[key];
		this[key] = (this[key] === undefined || this[key] === null) ? this.defaults[key].value : this[key];
	}
};

PingPongDelay.prototype = Object.create(baseEffect, {

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
			this.dryGainNode.gain.value = Utils.getDryLevel(this.mix);
			this.wetGainNode.gain.value = Utils.getWetLevel(this.mix);
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
			this.delayNodeLeft.delayTime.value = time;
			this.delayNodeRight.delayTime.value = time;
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
	}

});
export default PingPongDelay