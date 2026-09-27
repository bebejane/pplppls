import { Effect, EffectDefaults, Utils } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * Biquad filters (lowpass / highpass). The RBJ biquad DSP matching the native
 * BiquadFilterNode runs in the pp-lowpassfilter / pp-highpassfilter worklets.
 */
abstract class FilterEffect extends Effect {
	/** 'lowpass' | 'highpass' — the filter kind this instance was built as. */
	type: string;

	constructor(context: AudioContext, options: Record<string, any>, type: string, processorId: string) {
		const defaults: EffectDefaults = {
			frequency: { value: 350, max: 22050, min: 10, type: 'integer' },
			peak: { value: 0.0001, max: 1000, min: 0, type: 'float' },
		}
		super(context, options, defaults)
		this.inputNode = this.outputNode = this.node = createWorkletEffectNode(
			context,
			processorId,
			this.collectInit(),
		)
		this.type = type
		this.initParams()
	}

	/** Cutoff frequency. */
	get frequency(): number {
		return this.options.frequency
	}
	set frequency(value: number) {
		if (Utils.isInRange(value, 10, 22050)) {
			this.options.frequency = value
			this.node.parameters.get('frequency').value = value
		}
	}

	/** How peaked the response is around the cutoff. */
	get peak(): number {
		return this.options.peak
	}
	set peak(value: number) {
		if (Utils.isInRange(value, 0.0001, 1000)) {
			this.options.peak = value
			this.node.parameters.get('peak').value = value
		}
	}
}

// Frequencies below the cutoff pass through; above are attenuated.
export class LowPassFilter extends FilterEffect {
	constructor(context: AudioContext, options: Record<string, any> = {}) {
		super(context, options, 'lowpass', 'pp-lowpassfilter')
	}
}

// Frequencies below the cutoff are attenuated; above pass through.
export class HighPassFilter extends FilterEffect {
	constructor(context: AudioContext, options: Record<string, any> = {}) {
		super(context, options, 'highpass', 'pp-highpassfilter')
	}
}
