import {baseEffect, Utils} from './'
/**
 * See http://webaudio.prototyping.bbc.co.uk/ring-modulator/
 */
const RingModulator = function(context, options) {

	this.context = context;
	this.options = {};
	options = options || this.options;
	this.defaults = {
		speed: {value:30, max:2000, min:0, type:'float'},
		distortion: {value:0.2, max:50, min:0.2, type:'float'},
		mix: {value:0.5, max:1, min:0, type:'float'},
	};

	this.inputNode = this.context.createGain();
	this.outputNode = this.context.createGain();
	this.dryGainNode = this.context.createGain();
	this.wetGainNode = this.context.createGain();


	/**
	 * `vIn` is the modulation oscillator input 
	 * `vc` is the audio input.
	 */
	this.vIn = this.context.createOscillator();
	this.vIn.start(0);
	this.vInGain = this.context.createGain();
	this.vInGain.gain.value = 0.5;
	this.vInInverter1 = this.context.createGain();
	this.vInInverter1.gain.value = -1;
	this.vInInverter2 = this.context.createGain();
	this.vInInverter2.gain.value = -1;
	this.vInDiode1 = new DiodeNode(this.context);
	this.vInDiode2 = new DiodeNode(this.context);
	this.vInInverter3 = this.context.createGain();
	this.vInInverter3.gain.value = -1;
	this.vcInverter1 = this.context.createGain();
	this.vcInverter1.gain.value = -1;
	this.vcDiode3 = new DiodeNode(this.context);
	this.vcDiode4 = new DiodeNode(this.context);

	this.outGain = this.context.createGain();
	this.outGain.gain.value = 3;

	this.compressor = this.context.createDynamicsCompressor();
	this.compressor.threshold.value = -24;
	this.compressor.ratio.value = 16;

	// dry mix
	this.inputNode.connect(this.dryGainNode);
	this.dryGainNode.connect(this.outputNode);

	// wet mix	
	this.inputNode.connect(this.vcInverter1);
	this.inputNode.connect(this.vcDiode4.node);
	this.vcInverter1.connect(this.vcDiode3.node);
	this.vIn.connect(this.vInGain);
	this.vInGain.connect(this.vInInverter1);
	this.vInGain.connect(this.vcInverter1);
	this.vInGain.connect(this.vcDiode4.node);
	this.vInInverter1.connect(this.vInInverter2);
	this.vInInverter1.connect(this.vInDiode2.node);
	this.vInInverter2.connect(this.vInDiode1.node);
	this.vInDiode1.connect(this.vInInverter3);
	this.vInDiode2.connect(this.vInInverter3);
	this.vInInverter3.connect(this.compressor);
	this.vcDiode3.connect(this.compressor);
	this.vcDiode4.connect(this.compressor);
	this.compressor.connect(this.outGain);
	this.outGain.connect(this.wetGainNode);

	// line out
	this.wetGainNode.connect(this.outputNode);

	for (var key in this.defaults) {
		this[key] = options[key];
		this[key] = (this[key] === undefined || this[key] === null) ? this.defaults[key].value : this[key];
	}
};

var DiodeNode = function(context_) {
	this.context = context_;
	this.node = this.context.createWaveShaper();
	this.vb = 0.2;
	this.vl = 0.4;
	this.h = 1;
	this.setCurve();
};

DiodeNode.prototype.setDistortion = function (distortion) {
	this.h = distortion;
	return this.setCurve();
};

DiodeNode.prototype.setCurve = function () {
	var i, 
		samples, 
		v, 
		value, 
		wsCurve, 
		_i, 
		_ref, 
		retVal;

	samples = 1024;
	wsCurve = new Float32Array(samples);
	
	for (i = _i = 0, _ref = wsCurve.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
		v = (i - samples / 2) / (samples / 2);
		v = Math.abs(v);
		if (v <= this.vb) {
			value = 0;
		} else if ((this.vb < v) && (v <= this.vl)) {
			value = this.h * ((Math.pow(v - this.vb, 2)) / (2 * this.vl - 2 * this.vb));
		} else {
			value = this.h * v - this.h * this.vl + (this.h * ((Math.pow(this.vl - this.vb, 2)) / (2 * this.vl - 2 * this.vb)));
		}
		wsCurve[i] = value;
	}

	retVal = this.node.curve = wsCurve;
	return retVal;
};

DiodeNode.prototype.connect = function(destination) {
	return this.node.connect(destination);
};


RingModulator.prototype = Object.create(baseEffect, {

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
	 * Speed on the input oscillator
	 */
	speed: {
		enumerable: true,

		get: function() {
			return this.options.speed;	
		},

		set: function(speed) {
			if (!Utils.isInRange(speed, 0, 2000))
				return;

			this.options.speed = speed;
			this.vIn.frequency.value = speed;
		}
	},

	/**
	 * Level of distortion
	 */
	distortion: {
		enumerable: true,

		get: function() {
			return this.options.distortion;	
		},

		set: function(distortion) {
			if (!Utils.isInRange(distortion, 0.2, 50))
				return;

			this.options.distortion = parseFloat(distortion, 10);

			var diodeNodes = [this.vInDiode1, this.vInDiode2, this.vcDiode3, this.vcDiode4];

			for (var i=0, l=diodeNodes.length; i<l; i++) {
				diodeNodes[i].setDistortion(distortion);
			}
		}
	}

});
export default RingModulator