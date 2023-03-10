import {baseEffect, Utils} from './'

const Quadrafuzz = function(context, options) {

	this.context = context;
	this.options = {};
	options = options || this.options;

	this.defaults = {
		lowGain: {value:0.6, max:1, min:0, type:'float'},
		midLowGain: {value:0.8, max:1, min:0, type:'float'},
		midHighGain: {value:0.5, max:1, min:0, type:'float'},
		highGain: {value:0.6, max:1, min:0, type:'float'}
	};


	this.inputNode = this.context.createGain();
	this.outputNode = this.context.createGain();
	this.dryGainNode = this.context.createGain();
	this.wetGainNode = this.context.createGain();


	this.lowpassLeft = this.context.createBiquadFilter();
	this.lowpassLeft.type = 'lowpass';
	this.lowpassLeft.frequency.value = 147;
	this.lowpassLeft.Q.value = 0.7071;

	this.bandpass1Left = this.context.createBiquadFilter();
	this.bandpass1Left.type = 'bandpass';
	this.bandpass1Left.frequency.value = 587;
	this.bandpass1Left.Q.value = 0.7071;

	this.bandpass2Left = this.context.createBiquadFilter();
	this.bandpass2Left.type = 'bandpass';
	this.bandpass2Left.frequency.value = 2490;
	this.bandpass2Left.Q.value = 0.7071;

	this.highpassLeft = this.context.createBiquadFilter();
	this.highpassLeft.type = 'highpass';
	this.highpassLeft.frequency.value = 4980;
	this.highpassLeft.Q.value = 0.7071;


	this.overdrives = [];
	for (var i = 0; i < 4; i++) {
		this.overdrives[i] = this.context.createWaveShaper();
		this.overdrives[i].curve = getDistortionCurve(null, this.context);
	}


	this.inputNode.connect(this.wetGainNode);
	this.inputNode.connect(this.dryGainNode);
	this.dryGainNode.connect(this.outputNode);

	var filters = [this.lowpassLeft, this.bandpass1Left, this.bandpass2Left, this.highpassLeft];
	for (i = 0; i < filters.length; i++) {
		this.wetGainNode.connect(filters[i]);
		filters[i].connect(this.overdrives[i]);
		this.overdrives[i].connect(this.outputNode);
	}

	for (var key in this.defaults) {
		this[key] = options[key];
		this[key] = (this[key] === undefined || this[key] === null) ? this.defaults[key].value : this[key];
	}
};

function getDistortionCurve(gain, context) {
	var sampleRate = context.sampleRate;
	var curve = new Float32Array(sampleRate);
	var deg = Math.PI / 180;

	for (var i = 0; i < sampleRate; i++) {
		var x = i * 2 / sampleRate - 1;
		curve[i] = (3 + gain) * x * 20 * deg / (Math.PI + gain * Math.abs(x));
	}
	return curve;
}

Quadrafuzz.prototype = Object.create(baseEffect, {

	lowGain: {
		enumerable: true,

		get: function() {
			return this.options.lowGain;
		},

		set: function(lowGain) {
			if (!Utils.isInRange(lowGain, 0, 1))
				return;

			this.options.lowGain = lowGain;
			this.overdrives[0].curve = getDistortionCurve(Utils.normalize(this.lowGain, 0, 150), this.context);
		}
	},

	midLowGain: {
		enumerable: true,

		get: function() {
			return this.options.midLowGain;
		},

		set: function(midLowGain) {
			if (!Utils.isInRange(midLowGain, 0, 1))
				return;

			this.options.midLowGain = midLowGain;
			this.overdrives[1].curve = getDistortionCurve(Utils.normalize(this.midLowGain, 0, 150), this.context);
		}
	},

	midHighGain: {
		enumerable: true,

		get: function() {
			return this.options.midHighGain;
		},

		set: function(midHighGain) {
			if (!Utils.isInRange(midHighGain, 0, 1))
				return;

			this.options.midHighGain = midHighGain;
			this.overdrives[2].curve = getDistortionCurve(Utils.normalize(this.midHighGain, 0, 150), this.context);
		}
	},

	highGain: {
		enumerable: true,

		get: function() {
			return this.options.highGain;
		},

		set: function(highGain) {
			if (!Utils.isInRange(highGain, 0, 1))
				return;

			this.options.highGain = highGain;
			this.overdrives[3].curve = getDistortionCurve(Utils.normalize(this.highGain, 0, 150), this.context);
		}
	}
});

export default Quadrafuzz