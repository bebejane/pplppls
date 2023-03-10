import {baseEffect, Utils} from './'

const Distortion = function(context, options = {}) {

	this.context = context;
	this.options = {};
	options = options || this.options;
	
	this.defaults = {
		gain: {value:0.5, max:1, min:0, type:'float'}
	};

	this.waveShaperNode = this.context.createWaveShaper();
	this.inputNode = this.outputNode = this.waveShaperNode;

	for (var key in this.defaults) {
		this[key] = options[key];
		this[key] = (this[key] === undefined || this[key] === null) ? this.defaults[key].value : this[key];
	}
};

Distortion.prototype = Object.create(baseEffect, {

	/**
	 * Gets and sets the gain (amount of distortion).
	 */
	gain: {
		enumerable: true,
		
		get: function() {
			return this.options.gain;
		},

		set: function(gain) {
			if (!Utils.isInRange(gain, 0, 1))
				return;

			this.options.gain = gain;
			this.adjustGain();
		}
	},

	/**
	 * Sets the wave curve with the correct gain. Taken from
	 * http://stackoverflow.com/questions/22312841/waveshaper-node-in-webaudio-how-to-emulate-distortion
	 */
	adjustGain: {
		writable: false,
		configurable: false,
		enumerable: false,
		value: function() {
			var gain = Utils.isNumber(this.options.gain) ? parseInt(this.options.gain * 100, 10) : 50;
			var n_samples = 44100;
			var curve = new Float32Array(n_samples);
			var deg = Math.PI / 180;
			var x;

			for (var i = 0; i < n_samples; ++i ) {
				x = i * 2 / n_samples - 1;
				curve[i] = (3 + gain) * x * 20 * deg / (Math.PI + gain * Math.abs(x));
			}

			this.waveShaperNode.curve = curve;
		}
	}

});
export default Distortion