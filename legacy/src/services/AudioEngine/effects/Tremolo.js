import {baseEffect, Utils} from './'

const Tremolo = function(context, options) {

	this.context = context;

	// adapted from
	// https://github.com/mmckegg/web-audio-school/blob/master/lessons/3.%20Effects/13.%20Tremolo/answer.js

	this.options = {};
	options = options || this.options;

	this.defaults = {
		speed: {value:4, max:20, min:0, type:'integer'},
		depth: {value:0.5, max:1, min:0, type:'float'},
		mix: {value:0.5, max:1, min:0, type:'float'}
	};

	// create nodes
	this.inputNode = this.context.createGain();
	this.outputNode = this.context.createGain();
	this.dryGainNode = this.context.createGain();
	this.wetGainNode = this.context.createGain();

	this.tremoloGainNode = this.context.createGain();
	this.tremoloGainNode.gain.value = 0;
	this.lfoNode = this.context.createOscillator();

	this.shaperNode = this.context.createWaveShaper();
	this.shaperNode.curve = new Float32Array([0, 1]);
	this.shaperNode.connect(this.tremoloGainNode.gain);

	// dry mix
	this.inputNode.connect(this.dryGainNode);
	this.dryGainNode.connect(this.outputNode);
	
	// wet mix
	this.lfoNode.connect(this.shaperNode);
	this.lfoNode.type = 'sine';
	this.lfoNode.start(0);

	this.inputNode.connect(this.tremoloGainNode);
	this.tremoloGainNode.connect(this.wetGainNode);
	this.wetGainNode.connect(this.outputNode);

	for (var key in this.defaults) {
		this[key] = options[key];
		this[key] = (this[key] === undefined || this[key] === null) ? this.defaults[key].value : this[key];
	}
};

Tremolo.prototype = Object.create(baseEffect, {

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
	 * Speed of the tremolo
	 */
	speed: {
		enumerable: true,

		get: function() {
			return this.options.speed;	
		},

		set: function(speed) {
			if (!Utils.isInRange(speed, 0, 20)) 
				return;
			
			this.options.speed = speed;
			this.lfoNode.frequency.value = speed;
		}
	},

	/**
	 * Depth of the tremolo
	 */
	depth: {
		enumerable: true,

		get: function() {
			return this.options.depth;	
		},

		set: function(depth) {
			if (!Utils.isInRange(depth, 0, 1)) 
				return;
			
			this.options.depth = depth;
			this.shaperNode.curve = new Float32Array([1-depth, 1]);
		}
	}

});
export default Tremolo