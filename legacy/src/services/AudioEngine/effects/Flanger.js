import {baseEffect, Utils} from './'

const Flanger = function(context, options) {

	this.context = context;
	this.options = {};
	options = options || this.options;
	
	this.defaults = {
		time: {value:0.45, max:1, min:0, type:'float'},
		speed: {value:0.2, max:1, min:0, type:'float'},
		depth: {value:0.1, max:1, min:0, type:'float'},
		feedback: {value:0.5, max:1, min:0, type:'float'},
		mix: {value:0.5, max:1, min:0, type:'float'}
	};

	this.inputNode = this.context.createGain();
	this.outputNode = this.context.createGain();
	this.inputFeedbackNode = this.context.createGain();
	this.wetGainNode = this.context.createGain();
	this.dryGainNode = this.context.createGain();
	this.delayNode = this.context.createDelay();
	this.oscillatorNode = this.context.createOscillator();
	this.gainNode = this.context.createGain();
	this.feedbackNode = this.context.createGain();
	this.oscillatorNode.type = 'sine';

	this.inputNode.connect(this.inputFeedbackNode);
	this.inputNode.connect(this.dryGainNode);

	this.inputFeedbackNode.connect(this.delayNode);
	this.inputFeedbackNode.connect(this.wetGainNode);

	this.delayNode.connect(this.wetGainNode);
	this.delayNode.connect(this.feedbackNode);

	this.feedbackNode.connect(this.inputFeedbackNode);

	this.oscillatorNode.connect(this.gainNode);
	this.gainNode.connect(this.delayNode.delayTime);

	this.dryGainNode.connect(this.outputNode);
	this.wetGainNode.connect(this.outputNode);

	this.oscillatorNode.start(0);

	for (var key in this.defaults) {
		this[key] = options[key];
		this[key] = (this[key] === undefined || this[key] === null) ? this.defaults[key].value : this[key];
	}

};

Flanger.prototype = Object.create(baseEffect, {
	
	time: {
		enumberable: true,
		
		get: function() {
			return this.options.time;
		},

		set: function(time) {

			if (!Utils.isInRange(time, 0, 1))
				return;

			this.options.time = time;
			this.delayNode.delayTime.value = Utils.normalize(time, 0.001, 0.02);
		}
	},


	speed: {
		enumberable: true,
		
		get: function() {
			return this.options.speed;
		},

		set: function(speed) {
			if (!Utils.isInRange(speed, 0, 1))
				return;

			this.options.speed = speed;
			this.oscillatorNode.frequency.value = Utils.normalize(speed, 0.5, 5);
		}
	},


	depth: {
		enumberable: true,
		
		get: function() {
			return this.options.depth;
		},

		set: function(depth) {
			if (!Utils.isInRange(depth, 0, 1))
				return;

			this.options.depth = depth;
			this.gainNode.gain.value = Utils.normalize(depth, 0.0005, 0.005);
		}
	},


	feedback: {
		enumberable: true,
		
		get: function() {
			return this.options.feedback;
		},

		set: function(feedback) {
			if (!Utils.isInRange(feedback, 0, 1))
				return;

			this.options.feedback = feedback;
			this.feedbackNode.gain.value = Utils.normalize(feedback, 0, 0.8);
		}
	},


	mix: {
		enumberable: true,
		
		get: function() {
			return this.options.mix;
		},

		set: function(mix) {
			if (!Utils.isInRange(mix, 0, 1))
				return;

			this.options.mix = mix;
			this.dryGainNode.gain.value = Utils.getDryLevel(this.mix);
			this.wetGainNode.gain.value = Utils.getWetLevel(this.mix);
		}
	}

});
export default Flanger