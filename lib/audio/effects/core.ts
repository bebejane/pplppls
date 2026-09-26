/**
 * Shared primitives for the WebAudio effects. Every effect is now a real class
 * extending `Effect` (the base owns context/options/defaults plus the graph
 * connect/disconnect + param snapshot/reset contract `Sound` relies on).
 *
 * Kept in its own module so effect classes can import from here without a
 * circular import back to effects/index.
 */
import Utils from './Utils'

export { Utils }

/** One editable parameter, as declared in the engine catalog (EFFECTS). */
export interface EffectParamDef {
	value: number | boolean;
	max: number | boolean;
	min: number | boolean;
	type: string;
}

export type EffectDefaults = Record<string, EffectParamDef>;

/**
 * Base effect. Subclasses create their AudioWorkletNode and then call
 * `initParams()` so each param's setter runs against a live node (the same
 * ordering the old `createEffectBase.call(this, …)` relied on).
 */
export abstract class Effect {
	/** Param accessors are dynamic (one per catalog entry) — allow `effect[key]`. */
	[key: string]: any;
	context: AudioContext;
	options: Record<string, any>;
	defaults: EffectDefaults;
	inputNode!: AudioNode;
	outputNode!: AudioNode;
	node!: AudioWorkletNode;
	connected = false;
	_connectedNode: AudioNode | null = null;

	constructor(context: AudioContext, options: Record<string, any> = {}, defaults: EffectDefaults = {}) {
		this.context = context;
		this.options = { ...options };
		this.defaults = defaults;
	}

	/** Initial AudioParam values (options over defaults) for node construction. */
	protected collectInit(): Record<string, any> {
		const init: Record<string, any> = {};
		Object.keys(this.defaults).forEach((k) => {
			const v = this.options[k];
			init[k] = v !== undefined && v !== null ? v : this.defaults[k].value;
		});
		return init;
	}

	/** Apply options/defaults through each param setter (call after the node exists). */
	protected initParams(): void {
		Object.keys(this.defaults).forEach((k) => {
			const v = this.options[k];
			(this as any)[k] = v === undefined || v === null ? this.defaults[k].value : v;
		});
	}

	connect(audioNode: AudioNode): this {
		this._connectedNode = audioNode;
		this.outputNode.connect(audioNode);
		this.connected = true;
		return this;
	}

	disconnect(audioNode?: AudioNode): this {
		if (this.connected)
			this.outputNode.disconnect(audioNode || (this._connectedNode as AudioNode));
		this.connected = false;
		return this;
	}

	params(): Record<string, number | boolean> {
		const p: Record<string, number | boolean> = {};
		Object.keys(this.defaults).forEach((k) => (p[k] = (this as any)[k]));
		return p;
	}

	reset(): boolean {
		Object.keys(this.defaults).forEach((k) => ((this as any)[k] = this.defaults[k].value));
		return true;
	}
}
