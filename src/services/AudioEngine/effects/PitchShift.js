import {baseEffect, Utils} from './'
const pitchShift = require('pitch-shift');
const pool = require('typedarray-pool');

const PitchShift = function(context, options = {}) {
	this.context = context;
	this.sampleRate = context.sampleRate
	this.defaults = {
		sampleRate: 44100,
		pitchShift: 1.0,
		frameSize: 512,
		dataSize: 512,
		threshold: 0.9
	};
	this.options = {...this.defaults, ...options}
	options = options || this.options;

	this.pitchNode = new PitchShifter(this.context, this.options.pitchShift, this.options);
	this.inputNode = this.context.createGain();
	this.outputNode = this.context.createGain();
	

	for (var key in this.defaults) {
		this[key] = options[key];
		this[key] = (this[key] === undefined || this[key] === null) ? this.defaults[key].value : this[key];
	}
};

PitchShift.prototype = Object.create(baseEffect, {
	pitchShift: {
		enumerable: true,
		get: function() {
			return this.options.pitchShift;	
		},
		set: function(pitchShift) {
			console.log(pitchShift)
			this.pitchNode.shiftOffset = pitchShift;
			this.options.pitchShift = pitchShift;
		}
	},
	connect: {
		enumerable: true,
		value: function(audioNode) {
			if(!this.connected){
				console.log('connect')
				this.inputNode.connect(this.pitchNode)
				this.pitchNode.connect(this.outputNode)
				this.outputNode.connect(audioNode)
			}
			
			this.connected = true;
			return this;
		}
	},
	disconnect: {
		enumerable: true,

		value: function(audioNode) {
			if(this.connected){
				this.inputNode.disconnect(this.pitchNode)
				this.pitchNode.disconnect(this.outputNode)
				this.outputNode.disconnect(audioNode);
			}
			this.connected = false;
			return this;
		}
	}
});

function PitchShifter(context, shiftOffset, options){
    var queue = [];

    options = options || {};
    options.frameSize = options.frameSize || 512;
    options.hopSize = options.hopSize || options.frameSize / 4;

    var shifter = pitchShift(onData, onTune, options);

    var scriptNode = context.createScriptProcessor(options.frameSize, 1, 1);
    scriptNode.onaudioprocess = function(e) {
        shift(e.inputBuffer.getChannelData(0));
        var out = e.outputBuffer.getChannelData(0);
        var q = queue[0];
        queue.shift();
        out.set(q);
        pool.freeFloat32(q);
        console.log('.')
        //console.log('.')
    };
    scriptNode.shiftOffset = shiftOffset;

    //Enque some garbage to buffer stuff
    shift(new Float32Array(options.frameSize));
    shift(new Float32Array(options.frameSize));
    shift(new Float32Array(options.frameSize));
    shift(new Float32Array(options.frameSize));
    shift(new Float32Array(options.frameSize));

    function shift(frame) {
        shifter(frame);
    }

    function onData(data) {
        var buf = pool.mallocFloat32(data.length);
        buf.set(data);
        queue.push(buf);
    }

    function onTune(t, pitch) {
        return scriptNode.shiftOffset;
    }

    return scriptNode;
}

export default PitchShift