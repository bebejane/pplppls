// @ts-nocheck
/**
 * ModelManager — owns all model and preset I/O for the audio engine.
 *
 * Loads/saves/downloads .purple.zip models (fetch, JSZip, sound population),
 * and keeps the per-model preset list (snapshots of every sound's settings)
 * that is persisted inside index.json. The React layer only renders the grid
 * and calls these methods; it no longer touches JSZip/axios/sound internals.
 */
import axios from 'axios';
import JSZip from 'jszip';
import Global from '../Global';
import type { Model, ModelMeta, Preset, PresetSlot, PresetSound } from './model-types';

const MODEL_VERSION = 2;
/** One preset slot per number key (1-9, then 0). */
const PRESET_SLOTS = 10;

export default class ModelManager {
	engine;
	/** Entries from /models/index.json (plus in-session "new" models). */
	models: ModelMeta[] = [];
	/** The currently loaded model (or null before the first load). */
	model: Model | null = null;
	/** Saved settings snapshots, one slot per number key (null = empty). */
	presets: PresetSlot[] = [];
	/** Full models already unzipped (files carry buffers), keyed by name. */
	_cache: Record<string, Model> = {};

	constructor(engine) {
		this.engine = engine;
	}

	// ---- fetch helpers ---------------------------------------------------

	async loadFile(file) {
		const binary = !file.toLowerCase().endsWith('.json');
		const res = await axios.get(file, {
			responseType: binary ? 'arraybuffer' : 'json',
			onDownloadProgress: (prog) => {
				if (!binary) return;
				const total = prog.total || 0;
				const perc = total ? ((prog.loaded / total) * 100).toFixed(0) : '0';
				this.emit('notification', { message: '', description: perc + '%' });
			},
		});
		this.emit('notification', null);
		return res.data;
	}

	emit(event, ...args) {
		this.engine.emit(event, ...args);
	}

	// ---- models ----------------------------------------------------------

	async loadModels() {
		const list = (await this.loadFile('/models/index.json')) as ModelMeta[];
		this.models = list;
		this.emit('models', list);
		return list;
	}

	/** Load a model by name (or a supplied zip buffer), populating the engine. */
	async loadModel(name: string, zipContent?: ArrayBuffer): Promise<Model | undefined> {
		let model = this._cache[name];
		const cached = model && (model.new || (model.files.length && model.files[0].buffer));

		if (!cached) {
			let zipData = zipContent;
			if (!zipData) {
				try {
					zipData = (await this.loadFile('/models/' + name + '.zip')) as ArrayBuffer;
				} catch (err) {
					this.engine.emit('error', err);
					throw err;
				}
			}

			this.emit('notification', { message: 'Extracting', description: name });

			try {
				const zip = new JSZip();
				const z = await zip.loadAsync(zipData);
				model = JSON.parse(await z.files['index.json'].async('text'));
				model.version = model.version || 1;
				model.presets = Array.isArray(model.presets) ? model.presets : [];
				for (let i = 0; i < model.files.length; i++) {
					if (typeof (model.files[i] as unknown as string) === 'string')
						model.files[i] = { filename: model.files[i] as unknown as string };
					if (z.files[model.files[i].filename])
						model.files[i].buffer = await z.files[model.files[i].filename].async('arraybuffer');
				}
				this.emit('notification', null);
			} catch (err) {
				this.emit('notification', null);
				this.engine.emit('error', err);
				throw err;
			}
		}

		// Always re-populate (destroys the previous sounds and rebuilds them),
		// even on a cache hit — otherwise switching A → B → A would leave B's
		// sounds in the graph while the grid shows A.
		await this.populate(model);
		return model;
	}

	/** Read a File (from the hidden file input) with progress, then load it. */
	loadModelFromFile(file: File, onProgress?: (e: ProgressEvent<FileReader>) => void): Promise<Model> {
		return new Promise((resolve, reject) => {
			if (!file.name.toLowerCase().endsWith('.zip')) return reject('Format not supported');
			const name = file.name.replace(/(\.zip)/gi, '');
			this.emit('notification', { message: 'Loading', description: '0%' });
			const reader = new FileReader();
			reader.addEventListener('load', (e) => {
				this.loadModel(name, e.target!.result as ArrayBuffer)
					.then((model) => resolve(model!))
					.catch(reject);
			});
			reader.addEventListener('progress', (e) => {
				const perc = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
				this.emit('notification', { message: 'Loading', description: perc + '%' });
				if (onProgress) onProgress(e);
			});
			reader.addEventListener('error', (err) => {
				this.emit('notification', null);
				reject(err);
			});
			reader.addEventListener('abort', () => {
				this.emit('notification', null);
				reject('CANCELLED');
			});
			reader.readAsArrayBuffer(file);
		});
	}

	/**
	 * Build the engine sounds for a model (destroys any previous set). The grid
	 * itself is still rendered by the React layer from the returned model.
	 */
	async populate(model: Model) {
		this.engine.destroy();
		this.model = model;
		this._cache[model.name] = model;
		this.presets = this._normalizeSlots(model.presets);
		this.emit('presets', this.presets);

		const files = model.files || [];
		for (let idx = 0; idx < files.length; idx++) {
			const file = files[idx];
			const row = model.cols ? Math.floor(idx / model.cols) : 0;
			const col = model.cols ? idx % model.cols : idx;
			const id = row + '-' + col;
			const filename = file ? file.filename : null;
			const params = file && file.params ? file.params : {};
			const effectParams =
				file && file.params && file.params.effects && file.params.effects.length
					? file.params.effects[0].params
					: undefined;
			const effectBypass =
				file && file.params && file.params.effects && file.params.effects.length
					? file.params.effects[0].bypassed
					: undefined;
			const url =
				file && file.buffer
					? URL.createObjectURL(new Blob([file.buffer], { type: file.mimeType }))
					: filename
						? '/audio/' + model.name + '/' + filename
						: null;
			if (url) {
				this.engine.add(id, url, filename, { ...params, enableAnalyser: false });
				await this.engine.addEffect(
					id,
					'delay',
					effectBypass !== undefined ? effectBypass : false,
					effectParams,
				);
			}
		}
		this.emit('model', model);
	}

	/** Create an empty in-memory model (no files) and show its grid. */
	createModel(name: string, cols: number, rows: number): Model {
		if (this.models.filter((m) => m.name.toLowerCase() === name.toLowerCase()).length)
			throw 'Name is already taken!';
		const model: Model = {
			name,
			cols,
			rows,
			files: [],
			presets: [],
			version: MODEL_VERSION,
			new: true,
		};
		this.engine.destroy();
		this.model = model;
		this._cache[name] = model;
		this.presets = this._emptySlots();
		this.models = [...this.models, { name, cols, rows }];
		this.emit('models', this.models);
		this.emit('presets', this.presets);
		this.emit('model', model);
		return model;
	}

	/** Serialize the current engine state into a zip Blob (does not download). */
	async saveModel(name?: string) {
		const modelName = name || (this.model && this.model.name);
		if (!modelName) return null;
		const model: Model = {
			name: modelName,
			version: MODEL_VERSION,
			files: [],
			cols: this.model ? this.model.cols : 0,
			rows: this.model ? this.model.rows : 0,
			presets: this.presets,
			contentLength: 0,
		};
		const zip = new JSZip();
		const sounds = this.engine.sounds;
		for (let i = 0; i < sounds.length; i++) {
			const sound = sounds[i].sound;
			if (sound._loaded) {
				const blob = new Blob([sound._buffer], { type: sound.mimeType || sound._mimeType });
				zip.file(sound._filename, blob, { binary: false, base64: true });
				model.contentLength += blob.size;
			}
			model.files.push({
				filename: sound._filename,
				mimeType: Global.fileToMimeType(sound._filename) || undefined,
				params: sound.getSaveState(),
			});
		}
		zip.file('index.json', JSON.stringify(model, null, 4));
		Object.keys(zip.files).forEach(
			(n) => (model.contentLength += (zip.files[n] as any)._data.length),
		);
		const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
		return { blob, model };
	}

	/** Serialize the current state and trigger a browser download. */
	async downloadModel(name?: string) {
		const res = await this.saveModel(name);
		if (!res) return undefined;
		this.download(res.blob, res.model.name + '.purple.zip');
		return res.model;
	}

	/** Download a single sound's original audio file. */
	downloadSound(id: string) {
		const item = this.engine.get(id);
		if (!item) return;
		const sound = item.sound;
		const blob = new Blob([sound._buffer], { type: sound.mimeType || sound._mimeType });
		this.download(blob, sound._filename);
	}

	download(blob: Blob, filename: string) {
		const a = document.createElement('a');
		a.style.display = 'none';
		document.body.appendChild(a);
		const url = window.URL.createObjectURL(blob);
		a.href = url;
		a.download = filename;
		a.click();
		setTimeout(() => {
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
		}, 100);
	}

	// ---- presets ---------------------------------------------------------
	// Presets are slot-addressed: `presets` is always PRESET_SLOTS long and
	// index i belongs to the number key (i === PRESET_SLOTS - 1 ? '0' : i + 1).
	// A null slot is empty — the engine never generates anything until that
	// slot's key is actually pressed, which is when the preset is created.

	/** Snapshot every sound's current settings and store it as a preset. */
	savePreset(name?: string): Preset {
		const sounds: PresetSound[] = this.engine.sounds.map((item) => this._snapshot(item));
		return this._setPreset(this._freeSlot(), { at: Date.now(), name, sounds });
	}

	/**
	 * Randomize every sound and store the result as a preset. `index` addresses
	 * the slot to write (used when a number key creates a preset); without it
	 * the first empty slot is used, and when every slot is taken the result is
	 * only played live (the 'b' action).
	 */
	randomizePreset(index?: number): Preset {
		this.engine.master.stop();
		const sounds = this.engine.sounds;

		sounds.forEach((item) => {
			const id = item.id;
			if (!this.engine.exist(id)) return;
			this.engine.rate(id, Math.random());
			this.engine.mute(id, Math.random() > 0.5);
			this.engine.volume(id, Math.random());
			this.engine.pan(id, Math.random() * 180 - 90);
		});

		const snapshots: PresetSound[] = [];
		sounds.forEach((item, idx) => {
			const sound = item.sound;
			const start = Math.random() * sound._duration;
			const end = Math.random() * (sound._duration - start);
			const loopOn = Math.random() < 0.5;
			const lockedOn = Math.random() > 0.75;
			this.engine.loop(item.id, true, { start, end });
			sound._loop = loopOn;
			if (Math.random() < 0.5) this.engine.reverse(item.id, true);
			setTimeout(() => this.engine.lock(item.id, lockedOn), idx * 200);
			// lock() is applied on a stagger, so record the intended value
			snapshots.push(this._snapshot(item, { loop: loopOn, locked: lockedOn }));
		});

		const preset: Preset = { at: Date.now(), sounds: snapshots };
		const slot = index === undefined || index === null ? this._freeSlot() : index;
		if (slot >= 0 && slot < PRESET_SLOTS) this._setPreset(slot, preset);
		this.engine.master.play();
		return preset;
	}

	/** True when the slot already holds a preset (otherwise pressing it creates one). */
	hasPreset(index: number): boolean {
		return !!this.presets[index];
	}

	/** Restore every sound to a saved preset's settings. */
	restorePreset(index: number) {
		const preset = this.presets[index];
		if (!preset) return;
		preset.sounds.forEach((cfg) => {
			if (!this.engine.exist(cfg.id)) return;
			const item = this.engine.get(cfg.id);
			const sound = item.sound;
			// unmute first: engine.volume silently skips muted sounds, so the
			// real mute state is re-applied last
			this.engine.mute(cfg.id, false);
			if (cfg.volume !== undefined) this.engine.volume(cfg.id, cfg.volume);
			if (cfg.rate !== undefined) this.engine.rate(cfg.id, cfg.rate);
			if (cfg.pan !== undefined) this.engine.pan(cfg.id, cfg.pan);
			this.engine.loop(cfg.id, !!cfg.loop, { start: cfg.loopStart, end: cfg.loopEnd });
			if (cfg.reversed !== undefined) this.engine.reverse(cfg.id, !!cfg.reversed);
			if (cfg.locked !== undefined) this.engine.lock(cfg.id, !!cfg.locked);
			// effects: enabled flag first, then per-effect bypass/params override
			if (cfg.effectsEnabled !== undefined && sound.effects && sound.effects.length)
				cfg.effectsEnabled ? sound.enableEffects() : sound.disableEffects();
			if (cfg.effects && cfg.effects.length) {
				cfg.effects.forEach((e) => {
					if (!sound.effects || !sound.effects[e.idx]) return;
					sound.effectBypass(e.idx, !!e.bypassed);
					if (e.params) sound.effectParams(e.idx, e.params);
				});
			}
			this.engine.mute(cfg.id, !!cfg.muted);
		});
		this.engine.master.play();
	}

	clearPresets() {
		this.presets = this._emptySlots();
		this.emit('presets', this.presets);
	}

	/** Index of the first empty preset slot, or -1 when all are taken. */
	_freeSlot(): number {
		return this.presets.findIndex((preset) => !preset);
	}

	_emptySlots(): PresetSlot[] {
		return new Array(PRESET_SLOTS).fill(null);
	}

	/** Copy a stored preset list into exactly PRESET_SLOTS slots (null = empty). */
	_normalizeSlots(list?: PresetSlot[]): PresetSlot[] {
		const slots = this._emptySlots();
		if (Array.isArray(list)) {
			const len = Math.min(list.length, PRESET_SLOTS);
			for (let i = 0; i < len; i++) slots[i] = list[i] || null;
		}
		return slots;
	}

	_snapshot(item, overrides = {}): PresetSound {
		const state = item.sound.getSaveState();
		if (state.effects)
			state.effects = state.effects.map((e) => ({
				idx: e.idx,
				type: e.type,
				bypassed: e.bypassed,
				params: e.params,
			}));
		return { id: item.id, ...state, ...overrides };
	}

	_setPreset(index: number, preset: Preset): Preset {
		if (index < 0 || index >= PRESET_SLOTS) return preset;
		const slots = this._normalizeSlots(this.presets);
		slots[index] = preset;
		this.presets = slots;
		this.emit('presets', this.presets);
		return preset;
	}
}
