import { Effect, EffectDefaults, Utils } from './core'
import { createWorkletEffectNode } from './worklet'

/**
 * Korg 35 filters — virtual-analog models of the MS-10 / early MS-20 low-pass
 * and high-pass filters. The DSP is a 1:1 port of the Faust sources published
 * in the faustfilters project (<https://github.com/SpotlightKid/faustfilters>,
 * `faust/korg35lpf.dsp` / `faust/korg35hpf.dsp`, Faust by Eric Tarr and
 * Christopher Arndt, STK-4.3 license). It runs in the `pp-korg35lpf` /
 * `pp-korg35hpf` AudioWorklet processors — see `workletsource.ts`.
 *
 * Both filters expose the same two controls as the reference plugins:
 * `cutoff` (Hz) and `q` (0.5..10, resonance; 0.707 = flat). The upstream
 * plugins default to 20000 Hz / Q 1; we start at the app's filter default
 * (350 Hz) so adding one audibly shapes the sound, Q staying at 1.
 */
abstract class Korg35FilterEffect extends Effect {
	/** 'korg35lpf' | 'korg35hpf' — the filter kind this instance was built as. */
	type: string;

	constructor(context: AudioContext, options: Record<string, any>, type: string, processorId: string) {
		const defaults: EffectDefaults = {
			cutoff: { value: 350, max: 20000, min: 20, type: 'integer' },
			q: { value: 1, max: 10, min: 0.5, type: 'float' },
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

	/** Cutoff frequency in Hertz (20 - 20000). */
	get cutoff(): number {
		return this.options.cutoff
	}
	set cutoff(value: number) {
		if (Utils.isInRange(value, 20, 20000)) {
			this.options.cutoff = value
			this.node.parameters.get('cutoff').value = value
		}
	}

	/** Resonance (0.5 - 10; 0.707 is flat, higher values emphasize the cutoff). */
	get q(): number {
		return this.options.q
	}
	set q(value: number) {
		if (Utils.isInRange(value, 0.5, 10)) {
			this.options.q = value
			this.node.parameters.get('q').value = value
		}
	}
}

// Korg 35 24 dB low pass: below the cutoff passes, above is attenuated.
export class Korg35LowPassFilter extends Korg35FilterEffect {
	constructor(context: AudioContext, options: Record<string, any> = {}) {
		super(context, options, 'korg35lpf', 'pp-korg35lpf')
	}
}

// Korg 35 24 dB high pass: below the cutoff is attenuated, above passes.
export class Korg35HighPassFilter extends Korg35FilterEffect {
	constructor(context: AudioContext, options: Record<string, any> = {}) {
		super(context, options, 'korg35hpf', 'pp-korg35hpf')
	}
}
