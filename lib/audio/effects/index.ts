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
		id: 'stonephaser',
		name: 'Stone Phaser',
		defaults:{
			speed: {value:0.2, max:5, min:0.01, type:'float'},
			feedback: {value:0.75, max:0.99, min:0, type:'float'},
			feedbackBassCut: {value:500, max:5000, min:10, type:'integer'},
			mix: {value:0.5, max:1, min:0, type:'float'},
			color: {value:true, max:true, min:false, type:'boolean'},
			phase: {value:0, max:180, min:-180, type:'integer'}
		},
	},{
		id: 'tremolo',
		name: 'Tremolo',
		defaults:{
			speed: {value:4, max:20, min:0, type:'integer'},
			depth: {value:0.5, max:1, min:0, type:'float'},
			mix: {value:0.5, max:1, min:0, type:'float'}
		},
	},{
		id: 'pitchshift',
		name: 'Pitch Shift',
		defaults:{
			pitchShift: {value:1.0, max:2, min:0.5, type:'float'}
		},
	},
]

import Compressor from './Compressor'
import Convolver from './Convolver'
import Delay from './Delay'
import Distortion from './Distortion'
import DubDelay from './DubDelay'
import Flanger from './Flanger'
import { HighPassFilter, LowPassFilter } from './Filters'
import PingPongDelay from './PingPongDelay'
import Quadrafuzz from './Quadrafuzz'
import Reverb from './Reverb'
import RingModulator from './RingModulator'
import StereoPanner from './StereoPanner'
import StonePhaser from './StonePhaser'
import Tremolo from './Tremolo'
import PitchShift from './PitchShift'
import { Utils, baseEffect, createEffectBase } from './core'
import { ensureEffectsWorklet } from './worklet'

const EFFECT_CLASSES: Record<string, any> = {
	delay: Delay,
	dubdelay: DubDelay,
	flanger: Flanger,
	reverb: Reverb,
	distortion: Distortion,
	compressor: Compressor,
	convolver: Convolver,
	pingpongdelay: PingPongDelay,
	tremolo: Tremolo,
	quadrafuzz: Quadrafuzz,
	stereopanner: StereoPanner,
	stonephaser: StonePhaser,
	ringmodulator: RingModulator,
	highpassfilter: HighPassFilter,
	lowpassfilter: LowPassFilter,
	pitchshift: PitchShift,
}

const createEffect = async (id: string, context: AudioContext, opt: Record<string, any> = {}): Promise<any> => {
	const defs = EFFECTS.filter((eff) => eff.id === id)[0];
	if (!defs || !EFFECT_CLASSES[id]) throw new Error('Effect doesnt exist: ' + id);
	const options = { ...opt };
	Object.keys(defs.defaults).forEach((param) => (options[param] = defs.defaults[param].value));
	// AudioWorkletNode construction requires the processor to be registered
	await ensureEffectsWorklet(context);
	return new EFFECT_CLASSES[id](context, options);
}

export { createEffect, createEffectBase, baseEffect, Utils, EFFECTS, EFFECT_CLASSES }