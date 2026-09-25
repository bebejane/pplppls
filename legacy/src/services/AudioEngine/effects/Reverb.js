
import {baseEffect, Utils} from './'


/**
 * Adapted from https://github.com/web-audio-components/simple-reverb
 */

const Reverb = function(context, options) {
	

	this.context = context;
	this.options = {};
	options = options || this.options;

	this.defaults = {
		mix: {value:0.5, max:1, min:0, type:'float'},
		time: {value:0.001, max:1, min:0, type:'float'},
		decay: {value:0.1, max:10, min:0, type:'float'},
		reverse: {value:false, max:true, min:false, type:'boolean'}
	};
	
	this.inputNode = this.context.createGain();
	this.reverbNode = this.context.createConvolver();
	this.outputNode = this.context.createGain();
	this.wetGainNode = this.context.createGain();
	this.dryGainNode = this.context.createGain();

	this.inputNode.connect(this.reverbNode);
	this.reverbNode.connect(this.wetGainNode);
	this.inputNode.connect(this.dryGainNode);
	this.dryGainNode.connect(this.outputNode);
	this.wetGainNode.connect(this.outputNode);
	
	for (var key in this.defaults) {
		this[key] = options[key];
		this[key] = (this[key] === undefined || this[key] === null) ? this.defaults[key].value : this[key];
	}

	(buildImpulse.bind(this))();
};

Reverb.prototype = Object.create(baseEffect, {

	mix: {
		enumerable: true,
		
		get: function() {
			return this.options.mix;
		},

		set: function (mix) {
			if (!Utils.isInRange(mix, 0, 1))
				return;

			this.options.mix = mix;
			this.dryGainNode.gain.value = Utils.getDryLevel(this.mix);
			this.wetGainNode.gain.value = Utils.getWetLevel(this.mix);
		}
	},

	time: {
		enumerable: true,

		get: function () {
			return this.options.time;
		},

		set: function (time) {
			if (!Utils.isInRange(time, 0.0001, 10))
				return;

			this.options.time = time;
			(buildImpulse.bind(this))();
		}
	},

	decay: {
		enumerable: true,

		get: function () {
			return this.options.decay;
		},

		set: function (decay) {
			if (!Utils.isInRange(decay, 0.0001, 10))
				return;

			this.options.decay = decay;
			(buildImpulse.bind(this))();
		}

	},

	reverse: {
		enumerable: true,

		get: function () {
			return this.options.reverse;
		},

		set: function (reverse) {
			if (!Utils.isBool(reverse))
				return;

			this.options.reverse = reverse;
			(buildImpulse.bind(this))();
		}
	}

});

function buildImpulse() {

	var length = this.context.sampleRate * this.time;
	var impulse = this.context.createBuffer(2, length, this.context.sampleRate);
	var impulseL = impulse.getChannelData(0);
	var impulseR = impulse.getChannelData(1);
	var n, i;

	for (i = 0; i < length; i++) {
		n = this.reverse ? length - i : i;
		impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, this.decay);
		impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, this.decay);
	}

        // https://github.com/alemangui/pizzicato/issues/91
        // ConvolverNode can be associated with only one buffer.
        // Not sure what's the best way, but we are recreating ConvolverNode
        // when properties change to work it around.
        if (this.reverbNode.buffer) {
          this.inputNode.disconnect(this.reverbNode);
          this.reverbNode.disconnect(this.wetGainNode);

          this.reverbNode = this.context.createConvolver();
          this.inputNode.connect(this.reverbNode);
          this.reverbNode.connect(this.wetGainNode);
        }

	this.reverbNode.buffer = impulse;
}
export default Reverb