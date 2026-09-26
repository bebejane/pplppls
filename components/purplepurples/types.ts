export type {
	Model,
	ModelFile,
	ModelMeta,
	Preset,
	PresetSlot,
	PresetSound,
	SoundSettings,
	EffectSnapshot,
} from '@/lib/audio/model-types';

export interface ColData {
	x: number;
	y: number;
	w: number;
	h: number;
	l: number;
	r: number;
	t: number;
	b: number;
	tl: number;
	tr: number;
	bl: number;
	br: number;
	heat: number;
}

export interface ColState {
	model: string;
	id: string;
	row: number;
	col: number;
	subactive: boolean;
	active: boolean;
	fullscreen: boolean;
	data: ColData;
	related: Record<string, string>;
	[key: string]: any;
}

export interface MoveData {
	id: string;
	heat: number;
	l: number;
	r: number;
	t: number;
	b: number;
	tl: number;
	tr: number;
	bl: number;
	br: number;
	w: number;
	h: number;
}