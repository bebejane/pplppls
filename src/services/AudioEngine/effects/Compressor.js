import {baseEffect, Utils} from './'

const Compressor = function(context, options = {}) {

	this.context = context;
	this.options = {};
	options = options || this.options;

	this.defaults = {
		threshold: {value:-24, max:0, min:-100, type:'integer'},
		knee: {value:30, max:40, min:0, type:'integer'},
		attack: {value:0, max:1, min:0, type:'integer'},
		release: {value:0.250, max:1, min:0, type:'integer'},
		ratio: {value:1, max:20, min:0, type:'integer'}
	};

	this.inputNode = this.compressorNode = this.context.createDynamicsCompressor();
	this.outputNode = this.context.createGain();
	
	this.compressorNode.connect(this.outputNode);

	for (var key in this.defaults) {
		this[key] = options[key];
		this[key] = (this[key] === undefined || this[key] === null) ? this.defaults[key].value : this[key].value;
	}
};

Compressor.prototype = Object.create(baseEffect, {

	/**
	 * The level above which compression is applied to the audio.
	 * MIN: -100
	 * MAX: 0
	 */
	threshold: {
		enumerable: true,
		
		get: function() {
			return this.compressorNode.threshold.value;
		},
		set: function(value) {
			if (Utils.isInRange(value, -100, 0))
				this.compressorNode.threshold.value = value;
		}
	},

	/**
	 * A value representing the range above the threshold where 
	 * the curve smoothly transitions to the "ratio" portion. More info:
	 * http://www.homestudiocorner.com/what-is-knee-on-a-compressor/
	 * MIN 0
	 * MAX 40
	 */
	knee: {
		enumerable: true,
		
		get: function() {
			return this.compressorNode.knee.value;
		},
		set: function(value) {
			if (Utils.isInRange(value, 0, 40))
				this.compressorNode.knee.value = value;
		}
	},

	/**
	 * How soon the compressor starts to compress the dynamics after 
	 * the threshold is exceeded. If volume changes are slow, you can 
	 * push this to a high value. Short attack times will result in a 
	 * fast response to sudden, loud sounds, but will make the changes 
	 * in volume much more obvious to listeners.
	 * MIN 0
	 * MAX 1
	 */
	attack: {
		enumerable: true,
		
		get: function() {
			return this.compressorNode.attack.value;
		},
		set: function(value) {
			if (Utils.isInRange(value, 0, 1))
				this.compressorNode.attack.value = value;
		}
	},

	/**
	 * How soon the compressor starts to release the volume level 
	 * back to normal after the level drops below the threshold. 
	 * A long time value will tend to lose quiet sounds that come 
	 * after loud ones, but will avoid the volume being raised too 
	 * much during short quiet sections like pauses in speech.
	 * MIN 0
	 * MAX 1
	 */
	release: {
		enumerable: true,
		
		get: function() {
			return this.compressorNode.release.value;
		},
		set: function(value) {
			if (Utils.isInRange(value, 0, 1))
				this.compressorNode.release.value = value;
		}
	},

	/**
	 * The amount of compression applied to the audio once it 
	 * passes the threshold level. The higher the Ratio the more 
	 * the loud parts of the audio will be compressed.
	 * MIN 1
	 * MAX 20
	 */
	ratio: {
		enumerable: true,
		
		get: function() {
			return this.compressorNode.ratio.value;
		},
		set: function(value) {
			if (Utils.isInRange(value, 1, 20))
				this.compressorNode.ratio.value = value;
		}
	},

	getCurrentGainReduction: function() {
		return this.compressorNode.reduction;
	}

});
export default Compressor