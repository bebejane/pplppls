import {baseEffect, Utils} from './'

/**
 * Frequencies below the cutoff frequency pass 
 * through; frequencies above it are attenuated.
 */
const LowPassFilter = function(context, options) {
	Filter.call(this, context, options, 'lowpass');
};

/**
 * Frequencies below the cutoff frequency are 
 * attenuated; frequencies above it pass through.
 */
const HighPassFilter = function(context, options) {
	Filter.call(this, context, options, 'highpass');
};

/**
 * Filters used by Pizzicato stem from the biquad filter node. This 
 * function acts as a common constructor. The only thing that changes 
 * between filters is the 'type' of the biquad filter node.
 */
function Filter(context, options, type) {
	this.options = {};
	options = options || this.options;
	this.context = context
	
	this.defaults = {
		frequency: {value:350, max:22050, min:10, type:'integer'},
		peak: {value:0.0001, max:1000, min:0, type:'float'}
	};

	this.inputNode = this.filterNode = this.context.createBiquadFilter();
	this.filterNode.type = type;

	this.outputNode = this.context.createGain();

	this.filterNode.connect(this.outputNode);

	for (var key in this.defaults) {
		this[key] = options[key];
		this[key] = (this[key] === undefined || this[key] === null) ? this.defaults[key].value : this[key];
	}
}

var filterPrototype = Object.create(baseEffect, {
	
	/**
	 * The cutoff frequency of the filter.
	 * MIN: 10
	 * MAX: 22050 (half the sampling rate of the current context)
	 */
	frequency: {
		enumerable: true,
		
		get: function() {
			return this.filterNode.frequency.value;
		},
		set: function(value) {
			if (Utils.isInRange(value, 10, 22050))
				this.filterNode.frequency.value = value;
		}
	},

	/**
	 * Indicates how peaked the frequency is around 
	 * the cutoff. The greater the value is, the 
	 * greater is the peak.
	 * MIN: 0.0001
	 * MAX: 1000
	 */
	peak: {
		enumerable: true,
		
		get: function() {
			return this.filterNode.Q.value;
		},
		set: function(value) {
			if (Utils.isInRange(value, 0.0001, 1000))
				this.filterNode.Q.value = value;
		}
	}
});

LowPassFilter.prototype = filterPrototype;
HighPassFilter.prototype = filterPrototype;
export {LowPassFilter, HighPassFilter}