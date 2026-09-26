/**
 * Model/preset data shapes shared by the engine (lib/audio) and the React app.
 *
 * A "model" is a saved grid of sampler cells (.purple.zip): an index.json plus
 * the audio files. `presets` snapshots the live settings of every sound so a
 * whole grid state can be restored with one call. Presets are slot-addressed:
 * one slot per number key (1-9, then 0), `null` for an empty slot. Old files
 * (no `version` / `presets`) load transparently as v1 with no presets.
 */

/** One effect's serialized state (defaults intentionally omitted to stay small). */
export interface EffectSnapshot {
	idx: number;
	type: string;
	bypassed: boolean;
	params: Record<string, number | boolean>;
}

/** The live settings of a single sound (superset of Sound.getSaveState()). */
export interface SoundSettings {
	volume?: number;
	rate?: number;
	pan?: number;
	panX?: number;
	panZ?: number;
	panWidth?: number;
	loop?: boolean;
	loopStart?: number;
	loopEnd?: number;
	solo?: boolean;
	locked?: boolean;
	muted?: boolean;
	pause?: boolean;
	pausedAt?: number;
	reversed?: boolean;
	effectsEnabled?: boolean;
	effects?: EffectSnapshot[];
}

export interface PresetSound extends SoundSettings {
	id: string;
}

/** A saved snapshot of every sound in the current model. */
export interface Preset {
	at: number;
	name?: string;
	sounds: PresetSound[];
}

/** One preset slot: a snapshot, or `null` when the slot is still empty. */
export type PresetSlot = Preset | null;

export interface ModelFile {
	filename: string;
	mimeType?: string;
	params?: SoundSettings;
	/** Runtime only — never serialized to index.json (the bytes live in the zip). */
	buffer?: ArrayBuffer;
}

export interface Model {
	name: string;
	/** Model format version; absent in legacy files (treated as 1). */
	version?: number;
	cols: number;
	rows: number;
	files: ModelFile[];
	presets?: PresetSlot[];
	contentLength?: number;
	/** True for an in-memory model that has not been saved as a zip yet. */
	new?: boolean;
}

/** The lightweight entry from /models/index.json (drives the model dropdown). */
export interface ModelMeta {
	name: string;
	cols?: number;
	rows?: number;
}
