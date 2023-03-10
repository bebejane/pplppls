const EFFECTS = [ 
	{
		id: 'compressor',
		name: 'Compressor',
		defaults:{
			threshold: {value:-24, max:0, min:-100, type:'integer'},
			knee: {value:30, max:40, min:0, type:'integer'},
			attack: {value:0, max:1, min:0, type:'integer'},
			release: {value:0.250, max:1, min:0, type:'integer'},
			ratio: {value:1, max:20, min:0, type:'integer'}
		}
	},{
		id:'convolver',
		name: 'Convolver',
		defaults: {
			mix: {value:0.5, max:1, min:0, type:'float'}
		},
	},{
		id:'delay',
		name: 'Delay',
		defaults:{
			feedback: {value:0.5, max:1, min:0, type:'float'},
			time: {value:0.1, max:1.0, min:0, type:'float'},
			mix: {value:0.5, max:1, min:0, type:'float'}
		},
	},{
		id:'distortion',
		name: 'Distortion',
		defaults:{
		gain: {
			value:0.5, max:1, min:0, type:'float'}
		},
	},{
		id:'dubdelay',
		name: 'Dub Delay',
		defaults:{
			feedback: {value:0.6, max:1, min:0, type:'float'},
			time: {value:0.7, max:180.0, min:0, type:'float'},
			mix: {value:0.5, max:1, min:0, type:'float'},
			cutoff: {value:700, max:4000, min:0, type:'integer'}
		},
	},{
		id:'flanger',
		name: 'Flanger',
		defaults:{
			time: {value:0.45, max:1, min:0, type:'float'},
			speed: {value:0.2, max:1, min:0, type:'float'},
			depth: {value:0.1, max:1, min:0, type:'float'},
			feedback: {value:0.5, max:1, min:0, type:'float'},
			mix: {value:0.5, max:1, min:0, type:'float'}
		},
	},{
		id:'highpassfilter',
		name: 'Highpass Filter',
		defaults:{
			frequency: {value:350, max:22050, min:10, type:'integer'},
			peak: {value:0.0001, max:1000, min:0, type:'float'}
		},
	},{
		id:'lowpassfilter',
		name: 'Lopass Filter',
		defaults:{
			frequency: {value:350, max:22050, min:10, type:'integer'},
			peak: {value:0.0001, max:1000, min:0, type:'float'}
		},
	},{
		id:'pingpongdelay',
		name: 'PingPong Delay',
		defaults:{
			feedback: {value:0.5, max:1, min:0, type:'float'},
			time: {value:0.3, max:1, min:0, type:'float'},
			mix: {value:0.5, max:1, min:0, type:'float'}
		},
	},{
		id:'quadrafuzz',
		name: 'QuadraFuzz',
		defaults:{
			lowGain: {value:0.6, max:1, min:0, type:'float'},
			midLowGain: {value:0.8, max:1, min:0, type:'float'},
			midHighGain: {value:0.5, max:1, min:0, type:'float'},
			highGain: {value:0.6, max:1, min:0, type:'float'}
		},
	},{
		id:'reverb',
		name: 'Reverb',
		defaults:{
			mix: {value:0.5, max:1, min:0, type:'float'},
			time: {value:0.001, max:1, min:0, type:'float'},
			decay: {value:0.1, max:10, min:0, type:'float'},
			reverse: {value:false, max:true, min:false, type:'boolean'}
		},
	},{
		id:'ringmodulator',
		name: 'Ring Modulator',
		defaults:{
			speed: {value:30, max:2000, min:0, type:'float'},
			distortion: {value:0.2, max:50, min:0.2, type:'float'},
			mix: {value:0.5, max:1, min:0, type:'float'},
		},
	},{
		id: 'stereopanner',
		name: 'Stereo Panner',
		defaults:{
			pan: {value:0, max:1, min:-1, type:'integer'}
		},
	},{
		id: 'tremolo',
		name: 'Tremolo',
		defaults:{
			speed: {value:4, max:20, min:0, type:'integer'},
			depth: {value:0.5, max:1, min:0, type:'float'},
			mix: {value:0.5, max:1, min:0, type:'float'}
		},
	},
	/*
	{
		id: 'pitchshift',
		name: 'Pitch Shift',
		defaults:{
			pitchShift: 1.0,
			frameSize: 512,
			dataSize: 512,
			threshold: 0.9
		},
	}
	*/
]
const Utils = require('./Utils').default

const baseEffect = Object.create(null, {	
	connect: {
		enumerable: true,
		value: function(audioNode) {
			this._connectedNode = audioNode
			this.outputNode.connect(audioNode);
			this.connected = true;
			return this;
		}
	},
	disconnect: {
		enumerable: true,

		value: function(audioNode) {
			if(this.connected)
				this.outputNode.disconnect(audioNode || this._connectedNode);
			this.connected = false;
			return this;
		}
	},
	params: {
		enumerable: true,
		value: function(){
			const p = {}
			Object.keys(this.defaults).forEach((k)=> p[k] = this[k])
			return p;	
		}
	},
	reset: {
		enumerable: true,
		value: function(){
			Object.keys(this.defaults).forEach((k)=> this[k] = this.defaults[k].value)
			return true
		}
	}
});

const createEffect = (id, context, opt = {})=>{
	const defaults = EFFECTS.filter((eff)=>eff.id === id)[0].defaults;
	if(!defaults) throw new Error('Effect doesnt exist', id)
	Object.keys(defaults).forEach((param)=>opt[param] = defaults[param].value)

	console.log('CREATE EFFECT', id, opt)

	if(id === 'delay')
		return new Delay(context, opt)
	if(id === 'dubdelay')
		return new DubDelay(context, opt)
	if(id === 'flanger')
		return new Flanger(context, opt)
	if(id === 'reverb')
		return new Reverb(context, opt)
	if(id === 'distortion')
		return new Distortion(context, opt)
	if(id === 'compressor')
		return new Compressor(context, opt)
	if(id === 'convolver')
		return new Convolver(context, opt)
	if(id === 'reverb')
		return new Reverb(context, opt)
	if(id === 'pingpongdelay')
		return new PingPongDelay(context, opt)
	if(id === 'tremolo')
		return new Tremolo(context, opt)
	if(id === 'quadrafuzz')
		return new Quadrafuzz(context, opt)
	if(id === 'stereopanner')
		return new StereoPanner(context, opt)
	if(id === 'ringmodulator')
		return new RingModulator(context, opt)
	if(id === 'highpassfilter')
		return new HighPassFilter(context, opt)
	if(id === 'lowpassfilter')
		return new LowPassFilter(context, opt)
	if(id === 'pitchshift')
		return new PitchShift(context, opt)
}

const Compressor = require('./Compressor').default
const Convolver = require('./Convolver').default
const Delay = require('./Delay').default
const Distortion = require('./Distortion').default
const DubDelay = require('./DubDelay').default
const Flanger = require('./Flanger').default
const HighPassFilter = require('./Filters').HighPassFilter
const LowPassFilter = require('./Filters').LowPassFilter
const PingPongDelay = require('./PingPongDelay').default
const Quadrafuzz = require('./Quadrafuzz').default
const Reverb = require('./Reverb').default
const RingModulator = require('./RingModulator').default
const StereoPanner = require('./StereoPanner').default
const Tremolo = require('./Tremolo').default
const PitchShift = require('./PitchShift').default

export { createEffect, baseEffect, Utils, EFFECTS}