import {baseEffect, Utils} from './'

const Convolver =function(context, options = {}) {

	this.context = context;
	this.options = {};
	options = options || this.options;
	

	var self = this;
	var request = new XMLHttpRequest();
	this.defaults = {
		mix: {value:0.5, max:1, min:0, type:'float'}
	};

	//this.callback = callback;

	this.inputNode = this.context.createGain();
	this.convolverNode = this.context.createConvolver();
	this.outputNode = this.context.createGain();

	this.wetGainNode = this.context.createGain();
	this.dryGainNode = this.context.createGain();

	this.inputNode.connect(this.convolverNode);

	this.convolverNode.connect(this.wetGainNode);
	this.inputNode.connect(this.dryGainNode);

	this.dryGainNode.connect(this.outputNode);
	this.wetGainNode.connect(this.outputNode);


	for (var key in this.defaults) {
		this[key] = options[key];
		this[key] = (this[key] === undefined || this[key] === null) ? this.defaults[key].value : this[key];
	}

	if (!options.impulse) {
		console.error('No impulse file specified.');
		return;
	}

	request.open('GET', options.impulse, true);
	request.responseType = 'arraybuffer';
	request.onload = function (e) {
		var audioData = e.target.response;

		this.context.decodeAudioData(audioData, function(buffer) {

			self.convolverNode.buffer = buffer;

			if (self.callback && Utils.isFunction(self.callback))
				self.callback();

		}, function(error) {

			error = error || new Error('Error decoding impulse file');

			if (self.callback && Utils.isFunction(self.callback))
				self.callback(error);
		});
	};

	request.onreadystatechange = function(event) {
		if (request.readyState === 4 && request.status !== 200) {
			console.error('Error while fetching ' + options.impulse + '. ' + request.statusText);
		}
	};

	request.send();
};

Convolver.prototype = Object.create(baseEffect, {

	mix: {
		enumerable: true,

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
export default Convolver