// @ts-nocheck
import { EventEmitter } from 'events';

const defaults = {
	fftSize: 32,
	minDecibels: -60,
	maxDecibels: 0,
	smoothingTimeConstant: 0.9,
	bits: 8,
	interval: 0,
	lowcut: undefined,
	hicut: undefined,
};
// `interval` is the minimum ms between reads. volume wants every frame (0);
// FFT/time-domain only need ~30Hz, which is plenty for a meter/gradient and
// cuts the analysis work by ~3x.
const typeDefaults = {
	volume: {
		...defaults,
		fftSize: 32,
		interval: 0,
		tweenIn: 1.618,
		tweenOut: 1.618 * 3,
	},
	timedomain: {
		...defaults,
		fftSize: 1024,
		interval: 30,
	},
	frequency: {
		...defaults,
		fftSize: 2048,
		interval: 30,
	},
};

// A sound that isn't playing only needs its visuals to settle. Meters keep
// ticking until their level has actually reached silence (so an effect tail —
// delay/reverb — stays visible after the source stops); other visuals settle on
// this grace alone.
const IDLE_GRACE = 500;

// ---- one shared rAF pump for every listener ------------------------------
// Previously each listener owned a setInterval that scheduled its own rAF, so
// N visuals produced N separate callbacks (often several per frame for the same
// analyser). A single loop now reads each listener at most once per frame and
// only when its own interval is due, and it shuts down when nothing is active.
const active = new Set();
let pumping = false;

function unschedule(listener) {
	active.delete(listener);
}

function schedule(listener) {
	listener.last = 0;
	active.add(listener);
	if (!pumping) {
		pumping = true;
		requestAnimationFrame(pump);
	}
}

function pump() {
	const now = performance.now();
	try {
		active.forEach((listener) => {
			if (listener.idle && now - listener.idleAt > IDLE_GRACE) {
				// A meter keeps running while its level is still above silence so
				// an effect tail stays visible; everything else settles on the
				// grace alone. Then drop it from the loop until reactivated.
				const settled = listener.type === 'volume' ? listener.level < 0.5 : true;
				if (settled) {
					unschedule(listener);
					listener.paused = true;
					return;
				}
			}
			if (now - listener.last < listener.options.interval) return;
			listener.last = now;
			listener.tick();
		});
	} finally {
		if (active.size) requestAnimationFrame(pump);
		else pumping = false;
	}
}

// One silent gain, shared by every analyser, keeps their output part of the
// rendering graph (so they update in every browser) without a
// MediaStreamDestination + gain node per listener.
const sinks = new WeakMap();
function sinkFor(context) {
	let sink = sinks.get(context);
	if (!sink) {
		sink = context.createGain();
		sink.gain.value = 0;
		sink.connect(context.destination);
		sinks.set(context, sink);
	}
	return sink;
}

class Analyser extends EventEmitter {
	constructor(id, context, node, opt = {}) {
		super();
		this.id = id;
		this.context = context;
		this.node = node;
		this.sampleRate = context.sampleRate;
		// caller-provided options only — seeding the global defaults here used
		// to leak the default interval (10ms) into _setup and silently override
		// each type's own interval, so frequency ran at 100Hz instead of 30Hz
		this.options = { ...opt };
		Object.keys(this.options).forEach((k) => (this['_' + k] = this.options[k]));
		this._listeners = {};
		this.idle = false;
	}
	addEventListener(type, opt, cb) {
		cb = typeof opt === 'function' ? opt : cb;
		opt = typeof opt === 'function' ? { ...this.options } : { ...this.options, ...opt };
		const listener = this._setup(type, opt, cb);
		this._connect(listener);
		this._analyse(listener);
	}
	removeEventListener(type, cb) {
		const listener = this._listeners[type];
		if (!listener) return;
		// notify only the leaving callback; other subscribers must keep running
		this._end(listener, cb);
		listener.callbacks = listener.callbacks.filter((c) => c !== cb);
		if (!listener.callbacks.length) {
			this._stopAnalyse(listener);
			this._disconnect(listener);
		}
	}
	on(type, opt, cb) {
		return this.addEventListener(type, opt, cb);
	}
	off(type, cb) {
		return this.removeEventListener(type, cb);
	}
	/** True while any subscriber is still attached (used to refcount reuse). */
	hasListeners() {
		return Object.keys(this._listeners).some((t) => this._listeners[t].callbacks.length > 0);
	}
	/** Idle analysers stop reading until the sound plays again (see pump). */
	setActive(on) {
		on = !!on;
		if (this._activeSet === on) return;
		this._activeSet = on;
		this.idle = !on;
		const now = performance.now();
		Object.keys(this._listeners).forEach((type) => {
			const listener = this._listeners[type];
			listener.idle = !on;
			listener.idleAt = now;
			if (on && listener.paused && listener.analysing) {
				listener.paused = false;
				schedule(listener);
			}
		});
	}
	setNode(node) {
		if (node === this.node) return;
		Object.keys(this._listeners).forEach((type) => {
			const listener = this._listeners[type];
			this._disconnect(listener);
		});
		this.node = node;
		Object.keys(this._listeners).forEach((type) => {
			const listener = this._listeners[type];
			this._connect(listener);
			if (listener.analysing) schedule(listener);
		});
	}
	setOptions(type, opt) {
		const listener = this._listeners[type];
		if (!listener) return;

		listener.options = { ...listener.options, ...opt };
		listener.analyser.fftSize = listener.options.fftSize;
		listener.analyser.minDecibels = listener.options.minDecibels;
		listener.analyser.maxDecibels = listener.options.maxDecibels;
		listener.analyser.smoothingTimeConstant = listener.options.smoothingTimeConstant;
		if (listener.analysing) this._restartAnalyse(listener);
	}
	pause() {
		Object.keys(this._listeners).forEach((type) => {
			const listener = this._listeners[type];
			this._end(listener);
			this._stopAnalyse(listener);
		});
	}
	unpause() {
		Object.keys(this._listeners).forEach((type) => this._restartAnalyse(this._listeners[type]));
	}
	close(type, cb) {
		this._disconnect(this._listeners[type], cb);
	}
	destroy() {
		Object.keys(this._listeners).forEach((type) => {
			const listener = this._listeners[type];
			this._end(listener);
			this._stopAnalyse(listener);
			this._disconnect(listener);
		});
	}
	_connect(listener) {
		if (listener.connected) return;
		this.node.connect(listener.analyser);
		listener.analyser.connect(sinkFor(this.context));
		listener.connected = true;
	}
	_disconnect(listener, cb) {
		if (!listener || !listener.connected) return;
		this._end(listener, cb);
		try {
			this.node.disconnect(listener.analyser);
		} catch (e) {}
		try {
			listener.analyser.disconnect();
		} catch (e) {}
		listener.connected = false;
	}
	_setup(type, opt = {}, cb) {
		const options = { ...(typeDefaults[type] || defaults), ...opt };
		if (!this._listeners[type]) {
			this._listeners[type] = {
				type,
				analyser: this.context.createAnalyser(),
				options,
				analysing: false,
				connected: false,
				idle: this.idle,
				idleAt: 0,
				paused: false,
				last: 0,
				lastValue: 0,
				level: 0,
				callbacks: [],
				tick: null,
				dataArray: null,
			};
		}
		const listener = this._listeners[type];
		this.setOptions(type, options);

		if (cb) listener.callbacks.push(cb);
		return listener;
	}
	_end(listener, cb) {
		const end =
			listener.type === 'volume'
				? 0
				: listener.options.bits === 32
					? new Float32Array(listener.analyser.frequencyBinCount)
					: new Uint8Array(listener.analyser.frequencyBinCount);
		if (this.listenerCount(listener.type)) this.emit(listener.type, end, { ...listener.options, ended: true });
		if (cb) cb(end, listener.options);
		else listener.callbacks.forEach((c) => c(end, listener.options));
	}
	_analyse(listener) {
		if (listener.analysing) return;

		const { options, analyser, type } = listener;
		const length = type === 'volume' ? options.fftSize : analyser.frequencyBinCount;
		listener.dataArray =
			options.bits === 32 ? new Float32Array(length) : new Uint8Array(length);
		listener.analysing = true;
		listener.paused = false;
		listener.idle = this.idle;
		listener.idleAt = performance.now();
		listener.tick = () => this._read(listener);
		schedule(listener);
	}
	_read(listener) {
		const { options, analyser, type, dataArray } = listener;

		if (type === 'frequency')
			options.bits === 32
				? analyser.getFloatFrequencyData(dataArray)
				: analyser.getByteFrequencyData(dataArray);
		else if (type === 'timedomain' || type === 'volume')
			options.bits === 32
				? analyser.getFloatTimeDomainData(dataArray)
				: analyser.getByteTimeDomainData(dataArray);

		let result;
		if (options.lowcut !== undefined || options.hicut !== undefined) {
			const freqsPerBand = this.sampleRate / 2 / dataArray.length;
			const start = options.lowcut <= 0 ? 0 : parseInt(options.lowcut / freqsPerBand);
			const end =
				options.hicut >= this.sampleRate / 2
					? dataArray.length - 1
					: dataArray.length -
						parseInt((this.sampleRate / 2 - options.hicut) / freqsPerBand) -
						1;
			result = dataArray.slice(start, end);
		}
		if (type === 'volume') {
			const range = this._getDynamicRange(dataArray) * (Math.E - 1);
			const next = Math.floor(Math.log1p(range) * 100);
			const tween = next > listener.lastValue ? options.tweenIn : options.tweenOut;
			listener.lastValue =
				(listener.lastValue + (next - listener.lastValue) / tween) /
				this.node.numberOfOutputs;
			// remembered so an idle meter can tell a ringing tail from silence
			listener.level = listener.lastValue;
			result = listener.lastValue;
		} else result = dataArray;

		if (this.listenerCount(type)) this.emit(type, result, options);
		listener.callbacks.forEach((cb) => (cb ? cb(result, options) : null));
	}
	_stopAnalyse(listener) {
		if (!listener || !listener.analysing) return;
		unschedule(listener);
		listener.analysing = false;
		listener.paused = false;
		listener.tick = null;
	}
	_restartAnalyse(listener) {
		if (!listener) return;
		this._stopAnalyse(listener);
		this._analyse(listener);
	}
	_getDynamicRange(buffer) {
		let len = buffer.length;
		let min = 128;
		let max = 128;
		for (let i = 0; i < len; i++) {
			let sample = buffer[i];
			if (sample < min) min = sample;
			else if (sample > max) max = sample;
		}
		return (max - min) / 255;
	}
}
export default Analyser;
