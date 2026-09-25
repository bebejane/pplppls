/**
 * Lightweight typed facade over the JS audio engine (lib/audio/AudioEngine.js).
 * Only the surface the React app calls is declared; the engine itself stays
 * untyped JavaScript. Signature details are intentionally loose (the engine's
 * own types are whatever the Web Audio API yields) — the point is that
 * components no longer cross an `any` boundary, so typos in engine method
 * names/args are caught by tsc.
 */

export interface MediaDeviceInfoLike {
	deviceId: string;
	label: string;
	groupId: string;
	kind: string;
}

export interface MidiDeviceInfoLike {
	deviceId: string;
	name: string;
	connection: string;
	state: string;
	manufacturer: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/** The subset of the engine's EventEmitter surface used by components. */
export interface AudioEngineEvents {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	on(event: string, listener: (...args: any[]) => void): AudioEngine;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	off(event: string, listener: (...args: any[]) => void): AudioEngine;
	emit(event: string, ...args: unknown[]): boolean;
}

export interface MasterLike {
	state: Record<string, Any>;
	play(opt?: { enableElapsed?: boolean }): void;
	stop(): void;
	pause(on: boolean): void;
	mute(on: boolean): void;
	muted(): boolean;
	loop(on?: boolean): Any;
	volume(vol?: number): Any;
	locked(on?: boolean): Any;
	reset(): void;
}

/** A Sound wrapper as seen by the app (engine.sounds / playSound results). */
export interface SoundLike {
	id: string;
	url: string;
	filename?: string;
	mimeType?: string;
	_loaded?: boolean;
	_buffer?: ArrayBuffer | null;
	sound: {
		[key: string]: Any;
		load(): void;
		play(opt?: Record<string, unknown>): void;
		stop(): void;
		volume(v?: number): Any;
		on(event: string, listener: Any): Any;
		off(event: string, listener: Any): Any;
		destroy(): void;
	};
}

export interface AudioEngine
	extends AudioEngineEvents {
	master: MasterLike;
	context: AudioContext;
	sounds: SoundLike[];
	soundMap: Record<string, SoundLike>;
	sampleRate: number;
	utils: Record<string, Any>;
	effects: Any[];
	encodeAudio(buffer: Float32Array[] | AudioBuffer, format: 'wav' | 'mp3', opt?: Record<string, unknown>): Promise<Blob>;
	cancelEncodeAudio(): void;
	init(lastInputDevice?: string | null, lastMidiDevice?: string | null): Promise<{ devices?: MediaDeviceInfoLike[]; selected?: string }>;
	initInputDevices(): Promise<{ devices?: MediaDeviceInfoLike[]; selected?: string }>;
	initInputSource(deviceId: string): Promise<unknown>;
	initMidi(): Promise<MidiDeviceInfoLike[]>;
	initMidiSource(deviceId: string): Promise<unknown>;
	listDevices(): Promise<MediaDeviceInfoLike[]>;
	createInputSource(stream: MediaStream, deviceId: string): void;
	add(id: string, url: string | null, filename?: string | null, opt?: Record<string, unknown>): SoundLike;
	addEffect(id: string, type: string, bypass?: boolean, opt?: Record<string, unknown>): Promise<Any>;
	remove(id: string): void;
	replace(id: string, url: string, filename: string): void;
	load(id?: string): void;
	unload(id?: string): void;
	get(): SoundLike[];
	get(id: string): SoundLike;
	play(id: string, opt?: Record<string, unknown>): void;
	pause(id?: string, on?: boolean): Any;
	stop(id?: string): void;
	exist(id: string): boolean;
	mute(id: string, on?: boolean): void;
	unmute(id: string): void;
	solo(id: string, on: boolean, multi?: boolean): void;
	lock(id: string, on?: boolean): Any;
	reverse(id: string, on: boolean): void;
	volume(id: string, vol?: number): Any;
	pan(id: string, deg: number): Any;
	rate(id: string, rate: number): void;
	loop(id: string, on: boolean, offset?: Record<string, number>): Any;
	effectBypass(id: string, idx: number | string, on: boolean): Any;
	effectParams(id: string, idx: number | string, params: Record<string, Any>): Any;
	enableEffects(id: string): void;
	disableEffects(id: string): void;
	midiMapMode(id: string, on: boolean): void;
	unmapMidiNote(id: string, note?: number): void;
	record(start: boolean): Promise<Any> | Any;
	sample(id: string, start: boolean): Promise<Any> | Any;
	cancelSample(id: string): void;
	metronome(tap?: boolean): void;
	playSound(url: string, opt?: Record<string, unknown>): RawSound;
	analyse(id: string, type: string, opt?: Record<string, Any>): Any;
	extractPeaks(id: string, spp?: number, opt?: Record<string, Any>): Any;
	reset(id: string): void;
	destroy(force?: boolean): void;
}

export interface RawSound {
	id?: string;
	load(): void;
	play(opt?: Record<string, unknown>): void;
	stop(): void;
	volume(v?: number): Any;
	on(event: string, listener: Any): Any;
	off(event: string, listener: Any): Any;
	once?(event: string, listener: Any): Any;
	destroy(): void;
	[key: string]: Any;
}