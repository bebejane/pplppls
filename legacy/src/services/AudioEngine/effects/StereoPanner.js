import {baseEffect, Utils} from './'

const StereoPanner = function(context, options) {

	this.context = context;
	this.options = {};
	options = options || this.options;

	this.defaults = {
		pan: {value:0, max:1, min:-1, type:'integer'}
	};

	this.inputNode = this.context.createGain();
	this.outputNode = this.context.createGain();

	if (this.context.createStereoPanner) {
		this.pannerNode = this.context.createStereoPanner();
		this.inputNode.connect(this.pannerNode);
		this.pannerNode.connect(this.outputNode);

	} else if (this.context.createPanner) {

		console.warn('Your browser does not support the StereoPannerNode. Will use PannerNode instead.');

		this.pannerNode = this.context.createPanner();
		this.pannerNode.type = 'equalpower';
		this.inputNode.connect(this.pannerNode);
		this.pannerNode.connect(this.outputNode);

	} else {
		console.warn('Your browser does not support the Panner effect.');
		this.inputNode.connect(this.outputNode);
	}


	for (var key in this.defaults) {
		this[key] = options[key];
		this[key] = (this[key] === undefined || this[key] === null) ? this.defaults[key].value : this[key];
	}
};

StereoPanner.prototype = Object.create(baseEffect, {

	/**
	 * Pan position
	 */
	pan: {
		enumerable: true,

		get: function() {
			return this.options.pan;	
		},

		set: function(pan) {
			if (!Utils.isInRange(pan, -1, 1))
				return;

			this.options.pan = pan;

			if (!this.pannerNode)
				return;

			var isStereoPannerNode = this.pannerNode.toString().indexOf('StereoPannerNode') > -1;

			if (isStereoPannerNode) {
				this.pannerNode.pan.value = pan;	
			} else {
				this.pannerNode.setPosition(pan, 0, 1 - Math.abs(pan));
			}
		}
	}

});

export default StereoPanner