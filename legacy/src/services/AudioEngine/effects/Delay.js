import {baseEffect, Utils} from './'

const Delay = function(context, options = {}) {

	this.context = context;
	this.defaults = {
		feedback: {value:0.5, max:1, min:0, type:'float'},
		time: {value:0.1, max:1.0, min:0, type:'float'},
		mix: {value:0.5, max:1, min:0, type:'float'}
	};
	this.options = {...options}
	options = options || this.options;

	this.inputNode = this.context.createGain();
	this.outputNode = this.context.createGain();
	this.dryGainNode = this.context.createGain();
	this.wetGainNode = this.context.createGain();
	this.feedbackGainNode = this.context.createGain();
	this.delayNode = this.context.createDelay();

	// line in to dry mix
	this.inputNode.connect(this.dryGainNode);
	// dry line out
	this.dryGainNode.connect(this.outputNode);

	// feedback loop
	this.delayNode.connect(this.feedbackGainNode);
	this.feedbackGainNode.connect(this.delayNode);

	// line in to wet mix
	this.inputNode.connect(this.delayNode);
	// wet out
	this.delayNode.connect(this.wetGainNode);
	
	// wet line out
	this.wetGainNode.connect(this.outputNode);
	//this.outputNode.gain.value = 0.5;

	for (var key in this.defaults) {
		this[key] = options[key];
		this[key] = (this[key] === undefined || this[key] === null) ? this.defaults[key].value : this[key];
	}
};

Delay.prototype = Object.create(baseEffect, {

	/**
	 * Gets and sets the dry/wet mix.
	*/
	mix: {
		enumerable: true,

		get: function() {
			return this.options.mix	;	
		},

		set: function(mix) {
			if (!Utils.isInRange(mix, 0, 1)) return;
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
			if (!Utils.isInRange(time, 0, 180) && this.options.time !== time) return;

			this.delayNode.delayTime.cancelScheduledValues(this.context.currentTime)
			this.delayNode.delayTime.setValueAtTime(this.options.time || time, this.context.currentTime+0.2)
    		this.delayNode.delayTime.exponentialRampToValueAtTime(time, this.context.currentTime + 0.5);
    		this.options.time = time;
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
			if (!Utils.isInRange(feedback, 0, 1) && this.options.feedback !== feedback) return;
			
			this.feedbackGainNode.gain.cancelScheduledValues(this.context.currentTime)
			this.feedbackGainNode.gain.setValueAtTime(this.options.feedback || feedback, this.context.currentTime+0.01)
    		this.feedbackGainNode.gain.linearRampToValueAtTime(feedback, this.context.currentTime + 0.5);
    		this.options.feedback = feedback;
		}
	}

});
export default Delay