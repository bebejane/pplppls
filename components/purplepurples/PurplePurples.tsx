'use client';

import Global from '@/lib/Global';
import axios from 'axios';
import JSZip from 'jszip';
import screenfull from 'screenfull';
import { AiOutlineLoading } from 'react-icons/ai';
import MobileDetect from 'mobile-detect';
import { useCallback, useEffect, useRef, useState } from 'react';
import cn from 'classnames';
import Column from './Column';
import SavesBar from './SavesBar';
import Controls from './Controls';
import Home from './Home';
import SaveDialog from './SaveDialog';
import NewDialog from './NewDialog';
import HelpDialog from './HelpDialog';
import RecordingsDialog, { type Recording } from './RecordingsDialog';
import NotSupported from './NotSupported';
import { useKeyboardShortcuts, type KeyboardHandlers } from './useKeyboardShortcuts';
import { useEngineListeners } from './useEngineListeners';
import type { Model, MoveData } from './types';
import s from './PurplePurples.module.scss';

/** A snapshot of one sound's live settings, restored from B/randomValues slots. */
interface SavedSoundSettings {
	id: string;
	volume: number;
	rate: number;
	pan: number;
	muted: boolean;
	loop: boolean;
	loopStart: number;
	loopEnd: number;
	reversed: boolean;
	locked: boolean;
}

/** One saved random-value result: the last 10 are kept, playable via 0-9. */
interface SavedSettings {
	at: number;
	sounds: SavedSoundSettings[];
}

interface PurplePurplesState {
	init: boolean;
	model: string;
	status: string;
	x: number;
	y: number;
	cols: Record<string, any>;
	rows: { id: string }[][];
	numCols: number;
	numRows: number;
	masterstate: Record<string, any>;
	inputDevices: { label: string; deviceId: string }[];
	midiDevices: { name: string; deviceId: string }[];
	midiSupported: boolean;
	loading: boolean;
	loaded: number;
	progress: { loaded: number; total: number } | null;
	deviceId: string | null;
	midiDeviceId: string | null;
	recording: boolean;
	sampling: string | boolean;
	hud: boolean;
	controls: boolean;
	fullscreen: boolean;
	saveDialog: boolean;
	helpDialog: boolean;
	newDialog: boolean;
	recordingDialog: boolean;
	volume: number;
	notification: null | {
		message: string;
		description?: string;
		loading?: boolean;
		close?: boolean;
	};
	inputNotAllowed: boolean;
	error: string | null;
	recordingProgress: Record<string, any>;
	samplingProgress: Record<string, any>;
}

const initialState: PurplePurplesState = {
	init: false,
	model: 'world winter II',
	status: '',
	x: 0,
	y: 0,
	cols: {},
	rows: [],
	numCols: 0,
	numRows: 0,
	masterstate: {},
	inputDevices: [],
	midiDevices: [],
	midiSupported: false,
	loading: true,
	loaded: 0,
	progress: null,
	deviceId: null,
	midiDeviceId: null,
	recording: false,
	sampling: false,
	hud: true,
	controls: true,
	fullscreen: false,
	saveDialog: false,
	helpDialog: false,
	newDialog: false,
	recordingDialog: false,
	volume: 0,
	notification: null,
	inputNotAllowed: false,
	error: null,
	recordingProgress: {},
	samplingProgress: {},
};

export default function PurplePurples() {
	const [state, setState] = useState<PurplePurplesState>(initialState);
	const [models, setModels] = useState<Model[]>([]);
	const [recordings, setRecordings] = useState<Recording[]>([]);

	const stateRef = useRef(state);
	stateRef.current = state;
	const modelsRef = useRef<Model[]>([]);
	const elementMapRef = useRef<Record<string, HTMLElement>>({});
	const canvasRef = useRef<HTMLDivElement>(null);
	const fileUploaderRef = useRef<HTMLInputElement>(null);
	const introTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	const mobile = useRef(new MobileDetect(window.navigator.userAgent)).current;
	const ios = useRef(
		/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream,
	).current;
	const [notsupported] = useState(() => mobile.phone() || mobile.tablet() || false);

	const set = useCallback((patch: Partial<PurplePurplesState>) => {
		setState((prev) => ({ ...prev, ...patch }));
	}, []);

	const setCols = useCallback((updater: (cols: Record<string, any>) => Record<string, any>) => {
		setState((prev) => ({ ...prev, cols: updater(prev.cols) }));
	}, []);

	useEngineListeners(set, setCols, stateRef);

	// ---- model loading helpers -------------------------------------------

	const loadFile = useCallback(async (file: string): Promise<unknown> => {
		const binary = !file.toLowerCase().endsWith('.json');
		const type = binary ? 'arraybuffer' : 'json';
		const res = await axios.get(file, {
			responseType: type,
			onDownloadProgress: (prog) => {
				if (!binary) return;
				const total = prog.total || 0;
				const perc = total ? ((prog.loaded / total) * 100).toFixed(0) : '0';
				setState((prev) => ({
					...prev,
					notification: { message: '', description: perc + '%', loading: false },
				}));
			},
		});
		setState((prev) => ({ ...prev, notification: null }));
		return res.data;
	}, []);

	const loadModel = useCallback(
		async (name: string, zipContent?: ArrayBuffer): Promise<Model | undefined> => {
			const models = modelsRef.current;
			const model = models.filter((m) => m.name === name)[0];
			if (model && model.files.length && model.files[0].buffer) return model;
			if (model && model.new) return model;

			let zipData = zipContent;
			if (!zipData) {
				const zipFile = '/models/' + name + '.zip';
				try {
					zipData = (await loadFile(zipFile)) as ArrayBuffer;
				} catch (err) {
					handleError(err);
					return;
				}
			}

			setState((prev) => ({
				...prev,
				notification: { message: 'Extracting', description: name },
			}));

			try {
				const zip = new JSZip();
				const z = await zip.loadAsync(zipData);
				const m: Model = JSON.parse(await z.files['index.json'].async('text'));
				for (let i = 0; i < m.files.length; i++) {
					if (typeof (m.files[i] as unknown as string) === 'string')
						m.files[i] = { filename: m.files[i] as unknown as string };
					if (z.files[m.files[i].filename])
						m.files[i].buffer = await z.files[m.files[i].filename].async('arraybuffer');
				}
				setState((prev) => ({ ...prev, notification: null, model: m.name }));
				return m;
			} catch (err) {
				setState((prev) => ({ ...prev, notification: null }));
				handleError(err);
				return undefined;
			}
		},
		[loadFile],
	);

	const initModel = useCallback((model: Model) => {
		Global.engine.destroy();
		const cols: Record<string, any> = {};
		const rows: { id: string }[][] = [];
		let fileIdx = 0;
		for (let row = 0; row < model.rows; row++) {
			const rowCols: { id: string }[] = [];
			for (let col = 0; col < model.cols; col++) {
				const id = row + '-' + col;
				const file = model.files[fileIdx++];
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
					Global.engine.add(id, url, filename, { ...params, enableAnalyser: false });
					Global.engine.addEffect(
						id,
						'delay',
						effectBypass !== undefined ? effectBypass : false,
						effectParams,
					);
				}
				cols[id] = {
					model: model.name,
					id,
					row,
					col,
					subactive: false,
					active: false,
					fullscreen: false,
					...params,
					related: {
						l: row + '-' + (col - 1),
						r: row + '-' + (col + 1),
						t: row - 1 + '-' + col,
						b: row + 1 + '-' + col,
						tl: row - 1 + '-' + (col - 1),
						tr: row - 1 + '-' + (col + 1),
						bl: row + 1 + '-' + (col - 1),
						br: row + 1 + '-' + (col + 1),
					},
					data: {
						x: 0,
						y: 0,
						w: 0,
						h: 0,
						l: 0,
						r: 0,
						t: 0,
						b: 0,
						tl: 0,
						tr: 0,
						bl: 0,
						br: 0,
						heat: 0,
					},
				};
				rowCols.push({ id });
			}
			rows.push(rowCols);
		}

		setState((prev) => ({
			...prev,
			cols,
			rows,
			model: model.name,
			numCols: model.cols,
			numRows: model.rows,
			loaded: 0,
			loading: true,
			notification: { message: 'Loading', description: '0/' + model.files.length },
		}));

		// wait for the DOM to render the columns, then map them and load
		setTimeout(() => {
			const elements = document.querySelectorAll('[data-sound-point]');
			elementMapRef.current = {};
			elements.forEach((el) => (elementMapRef.current[(el as HTMLElement).id] = el as HTMLElement));
			Global.engine.load();
		}, 0);

		if (!modelsRef.current.filter((m) => m.name === model.name).length)
			modelsRef.current.push(model);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const initDone = useCallback(
		async (start?: boolean) => {
			const model = await loadModel(stateRef.current.model);
			if (model) initModel(model);
		},
		[loadModel, initModel],
	);

	const init = useCallback(
		(start?: boolean) => {
			if (!Global.engine)
				return handleError(
					'This browser is not really supported. Use Firefox or Chrome to try this out!',
				);
			set({ init: false });

			const lastInputDevice = localStorage.getItem('lastInputDevice');
			const lastMidiDevice = localStorage.getItem('lastMidiDevice');

			Global.engine
				.init(lastInputDevice, lastMidiDevice)
				.then((info: any) => {
					if (info && info.devices) set({ deviceId: info.selected, inputDevices: info.devices });
					if (start) initDone(true);
				})
				.catch((err: unknown) => {
					if (err === 'NOTALLOWED') {
						set({ inputNotAllowed: true });
						if (start) initDone(true);
						return;
					}
					handleError(err);
				});

			Global.engine
				.initMidi()
				.then((devices: { deviceId: string; name: string }[]) => {
					set({ midiDevices: devices, midiSupported: true });
					if (!devices.length) return;
					const device = devices.filter((d) => d.deviceId === lastMidiDevice)[0] || devices[0];
					onMidiDeviceChange(device.deviceId);
				})
				.catch(() => {
					console.log('MIDI NOT AVAILABLE');
				});
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[initDone],
	);

	const onStart = useCallback(() => {
		if (!introTimeoutRef.current) {
			introTimeoutRef.current = setTimeout(() => set({ hud: true, controls: true }), 30000);
		} else {
			clearTimeout(introTimeoutRef.current);
		}
		Global.engine.context.resume().then(() => init(true));
	}, [init]);

	const onRequestInput = useCallback(() => {
		Global.engine
			.initInputDevices()
			.then((info: any) => {
				if (info.devices) set({ deviceId: info.selected, inputDevices: info.devices });
			})
			.catch((err: unknown) => {
				if (err === 'NOTALLOWED') {
					set({ inputNotAllowed: true });
					handleError('You have to reload page to select input');
				}
			});
	}, []);

	const onDeviceChange = useCallback((deviceId: string) => {
		Global.engine.initInputSource(deviceId).then(() => {
			localStorage.setItem('lastInputDevice', deviceId);
			set({ deviceId });
		});
	}, []);

	const onMidiDeviceChange = useCallback((midiDeviceId: string) => {
		if (!midiDeviceId) return;
		Global.engine.initMidiSource(midiDeviceId).then(() => {
			localStorage.setItem('lastMidiDevice', midiDeviceId);
			set({ midiDeviceId });
		});
	}, []);

	const handleError = useCallback((err: unknown) => {
		const error = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err);
		set({ error });
		console.error(err);
	}, []);

	const onErrorClose = useCallback(() => set({ error: null }), []);

	// ---- mount: load models index, init devices, block touchmove ---------
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const list = (await loadFile('/models/index.json')) as Model[];
				modelsRef.current = list;
				if (!cancelled) setModels(list);
				if (!cancelled) init(false);
			} catch (err) {
				handleError(err);
			}
		})();
		const touchHandler = (e: TouchEvent) => e.preventDefault();
		document.addEventListener('touchmove', touchHandler, true);
		return () => {
			cancelled = true;
			document.removeEventListener('touchmove', touchHandler, true);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// model upload via hidden file input
	useEffect(() => {
		const el = fileUploaderRef.current;
		if (!el) return;
		const onChange = (event: Event) => {
			const target = event.target as HTMLInputElement;
			if (!target.files || !target.files.length) return;
			const file = target.files[0];
			if (!file.name.toLowerCase().endsWith('.zip')) return handleError('Format not supported');

			set({ notification: { message: 'Loading', description: '0%' } });
			const reader = new FileReader();
			reader.addEventListener('load', (e) => {
				const name = file.name.replace(/(\.zip)/gi, '');
				loadModel(name, e.target!.result as ArrayBuffer)
					.then((model) => {
						if (model) initModel(model);
					})
					.catch((err) => handleError(err))
					.finally(() => set({ notification: null }));
			});
			reader.addEventListener('progress', (e) => {
				set({
					notification: {
						message: 'Loading',
						description: parseInt(((e.loaded / e.total) * 100).toString(), 10) + '%',
					},
				});
			});
			reader.addEventListener('error', (err) => {
				console.error(err);
				set({ error: String(err), notification: null });
			});
			reader.addEventListener('abort', () => {
				set({ notification: null });
			});
			reader.readAsArrayBuffer(file);
		};
		el.addEventListener('change', onChange);
		return () => el.removeEventListener('change', onChange);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loadModel, initModel]);

	// ---- keyboard shortcuts ---------------------------------------------
	const handlersRef = useRef<KeyboardHandlers>({
		onRecord: () => {},
		toggleSave: () => {},
		toggleControls: () => {},
		toggleFullscreen: () => {},
		randomValues: () => {},
		restoreSettings: () => {},
		closeDialogs: () => {},
		toggleHud: () => {},
		masterstate: {},
		hud: true,
		recording: false,
	});
	handlersRef.current = {
		onRecord: (on) => onRecord(on),
		toggleSave: () => set({ saveDialog: !stateRef.current.saveDialog }),
		toggleControls: () => set({ controls: !stateRef.current.controls }),
		toggleFullscreen: () => onFullscreen(!stateRef.current.fullscreen),
		randomValues: () => randomValues(),
		restoreSettings: (slot) => flashAndRestore(slot),
		closeDialogs: () => set({ newDialog: false, saveDialog: false }),
		toggleHud: () => set({ hud: !stateRef.current.hud }),
		masterstate: stateRef.current.masterstate,
		hud: stateRef.current.hud,
		recording: stateRef.current.recording,
	};
	useKeyboardShortcuts(handlersRef);

	// ---- transport / record ---------------------------------------------
	const onRecord = useCallback((start: boolean) => {
		if (stateRef.current.loading) return;
		if (start) {
			if (stateRef.current.masterstate.recording) return;
			set({ recording: true });
			Global.engine
				.record(true)
				.then((recording: Recording) => {
					setRecordings((prev) => [recording, ...prev]);
				})
				.catch((err: unknown) => {
					if (err === 'CANCELLED') return;
					console.error(err);
					handleError(err);
				})
				.finally(() => set({ recording: false }));
		} else Global.engine.record(false);
	}, []);

	const onSampleRecord = useCallback((id: string, start: boolean) => {
		if (stateRef.current.loading) return;
		if (start) {
			set({ sampling: id });
			Global.engine
				.sample(id, true)
				.then(() => {
					Global.engine.lock(id, true);
				})
				.catch((err: unknown) => {
					set({ sampling: false });
					if (err === 'CANCELLED') return;
					handleError(err);
				});
		} else {
			set({ sampling: false });
			Global.engine.sample(id, false);
		}
	}, []);

	const onCancelSampleRecord = useCallback((id: string) => {
		Global.engine.cancelSample(id);
	}, []);

	const onDeleteRecording = useCallback((id: number) => {
		setRecordings((prev) => prev.filter((r) => r.id !== id));
	}, []);

	const onDownload = useCallback(
		async (recId: number, type: 'wav' | 'mp3') => {
			const recording = recordings.filter((r) => r.id === recId)[0];
			if (!recording) return;
			if (type === 'wav') return forceDownload(recording.blob, recording.name + '.wav');
			set({ notification: { message: 'Converting to mp3', close: true } });
			Global.engine
				.encodeAudio(recording.buffer, 'mp3')
				.then((blob: Blob) => {
					forceDownload(blob, recording.name + '.mp3');
				})
				.catch((err: unknown) => {
					if (err === 'CANCELLED') return;
					handleError(err);
				})
				.finally(() => set({ notification: null }));
			// eslint-disable-next-line react-hooks/exhaustive-deps
		},
		[recordings],
	);

	const onDownloadSample = useCallback((id: string) => {
		const s = Global.engine.get(id);
		const blob = new Blob([s.sound._buffer], { type: s.sound.mimeType });
		forceDownload(blob, s.sound.filename);
	}, []);

	const forceDownload = useCallback((blob: Blob, filename: string) => {
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
	}, []);

	const onUpload = useCallback(
		(id: string, buffer: ArrayBuffer, filename: string) => {
			const name = filename.toLowerCase();
			if (name && name.endsWith('.zip')) {
				loadModel(name.replace('.zip', ''), buffer)
					.then((model) => {
						if (model) initModel(model);
					})
					.catch((err) => handleError(err));
				return;
			}
			const objURL = URL.createObjectURL(
				new Blob([buffer], { type: Global.fileToMimeType(filename) }),
			);
			Global.engine.replace(id, objURL, filename);
		},
		[loadModel, initModel],
	);

	const onMultiUpload = useCallback(
		(id: string, files: { contents: ArrayBuffer; filename: string }[]) => {
			let offset = 0;
			Global.engine.sounds.forEach((s: any, idx: number) => {
				if (id === s.id) offset = idx;
			});
			files.forEach((f, idx) => {
				if (offset + idx >= Global.engine.sounds.length) return;
				const targetId = Global.engine.sounds[offset + idx].id;
				const objURL = URL.createObjectURL(
					new Blob([f.contents], { type: Global.fileToMimeType(f.filename) }),
				);
				Global.engine.replace(targetId, objURL, f.filename);
			});
		},
		[],
	);

	// ---- fullscreen ------------------------------------------------------
	const onFullscreen = useCallback((on: boolean) => {
		if (on) screenfull.request();
		else screenfull.exit();
		set({ fullscreen: on });
	}, []);

	const onColumnFullscreen = useCallback((id: string, on: boolean) => {
		setCols((cols) => ({
			...cols,
			[id]: { ...cols[id], fullscreen: on, _volume: cols[id].volume },
		}));
		setTimeout(() => {
			if (on) {
				Global.engine.mute(id, false);
				Global.engine.volume(id, 1.0);
				Global.engine.rate(id, 1.0);
			} else Global.engine.volume(id, stateRef.current.cols[id]._volume);
		}, 0);
	}, []);

	// ---- saving / creating models ----------------------------------------
	const saveModel = useCallback(async (modelName: string) => {
		if (!modelName) return;
		set({
			saveDialog: false,
			notification: { message: 'Saving: ' + modelName, description: '' },
		});
		const st = stateRef.current;
		const model: Model = {
			name: modelName,
			files: [],
			cols: st.numCols,
			rows: st.numRows,
			contentLength: 0,
		};
		const zip = new JSZip();
		const sounds = Global.engine.sounds;
		for (let i = 0; i < sounds.length; i++) {
			const sound = sounds[i].sound;
			if (sound._loaded) {
				const blob = new Blob([sound._buffer], { type: sound.mimeType });
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
			(name) => (model.contentLength += (zip.files[name] as any)._data.length),
		);
		try {
			const content = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
			forceDownload(content, modelName + '.purple.zip');
		} catch (err) {
			handleError(err);
		} finally {
			set({ notification: null });
		}
	}, []);

	const createModel = useCallback((name: string, cols: number, rows: number) => {
		if (modelsRef.current.filter((m) => m.name.toLowerCase() === name.toLowerCase()).length)
			return handleError('Name is already taken!');
		const model: Model = { name, cols, rows, files: [], new: true };
		set({ newDialog: false });
		initModel(model);
	}, []);

	const onLoadModel = useCallback(
		(name: string) => {
			loadModel(name)
				.then((model) => {
					if (model) initModel(model);
				})
				.catch((err) => handleError(err));
		},
		[loadModel, initModel],
	);

	const onUploadModelFromFile = useCallback(() => {
		fileUploaderRef.current?.click();
	}, []);

	// ---- column grid interactions ----------------------------------------
	const elementByPos = useCallback((x: number, y: number) => {
		let el: HTMLElement | undefined;
		Object.keys(elementMapRef.current).forEach((k) => {
			const node = elementMapRef.current[k];
			if (node.offsetLeft < x && node.offsetTop < y) el = node;
		});
		return el;
	}, []);

	const onMove = useCallback((data: MoveData) => {
		const cols = stateRef.current.cols;
		const col = cols[data.id];
		if (!col) return;
		const locked = Global.engine.lock(data.id);
		const soloOn = stateRef.current.masterstate.solo;

		const heatPerc = Math.abs(data.heat - 100) / 100;
		const delayParams = {
			feedback: parseFloat(((heatPerc * 1.0) / 2).toFixed(1)),
			mix: parseFloat((heatPerc * 1.0).toFixed(1)),
			time: Number(heatPerc * 1.0 <= 0 ? 0.0001 : heatPerc * 1.0),
		};

		if (!locked) {
			Global.engine.volume(data.id, parseFloat((data.heat / 100).toFixed(1)));
			Global.engine.pan(data.id, parseFloat((data.r - data.l - 10).toFixed(0)));
			Global.engine.effectParams(data.id, 0, delayParams);
		}
		if (soloOn) return;

		const nextCols = { ...cols };
		Object.keys(nextCols).forEach((k) => {
			nextCols[k] = {
				...nextCols[k],
				active: false,
				subactive: false,
				data: { ...nextCols[k].data, heat: 0 },
			};
		});

		Object.keys(col.related).forEach((k) => {
			const id = col.related[k];
			if (!nextCols[id]) return;
			nextCols[id] = {
				...nextCols[id],
				data: { ...nextCols[id].data, heat: data[k as keyof typeof data] as number },
				subactive: true,
			};
			if (!Global.engine.lock(id)) {
				const vol = Number(data[k as keyof typeof data]) / 100;
				Global.engine.volume(id, Number(vol.toFixed(1)) / 2);
			}
		});
		nextCols[col.id] = {
			...nextCols[col.id],
			data,
			active: true,
			subactive: false,
		};

		Object.keys(nextCols).forEach((k) => {
			const c = nextCols[k];
			if (Global.engine.lock(k)) return;
			if (c.active || c.subactive) Global.engine.mute(c.id, false);
			else Global.engine.mute(c.id, true);
		});

		set({ cols: nextCols });
	}, []);

	const onMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (Math.abs(e.movementX) > 50 || Math.abs(e.movementY) > 50) return;
			const el = elementByPos(e.pageX, e.pageY);
			if (!el) return;
			const col = stateRef.current.cols[el.id];
			if (!col || col.fullscreen || stateRef.current.loading) return;

			const l = el.offsetLeft;
			const t = el.offsetTop;
			const w = el.clientWidth;
			const h = el.clientHeight;
			const x = e.pageX - l;
			const y = e.pageY - t;

			const pos: MoveData = {
				id: el.id,
				l: 100 - (x / w) * 100,
				r: Math.abs((x / w) * 100),
				t: 100 - (y / h) * 100,
				b: Math.abs((y / h) * 100),
				tl: (100 - (x / w) * 100 + (100 - (y / h) * 100)) / 2,
				tr: (Math.abs((x / w) * 100) + (100 - (y / h) * 100)) / 2,
				bl: (100 - (x / w) * 100 + Math.abs((y / h) * 100)) / 2,
				br: (Math.abs((x / w) * 100) + Math.abs((y / h) * 100)) / 2,
				w,
				h,
				heat: 0,
			};
			const heatX = x <= pos.w / 2 ? x / (pos.w / 2) : pos.w / x - 1.0;
			const heatY = y <= pos.h / 2 ? y / (pos.h / 2) : pos.h / y - 1.0;
			pos.heat = parseInt((((heatX + heatY) / 2) * 100).toString(), 10);
			if (pos.id) onMove(pos);
		},
		[elementByPos, onMove],
	);

	// ---- randomize -------------------------------------------------------
	const savedSettingsRef = useRef<SavedSettings[]>([]);

	// saved-slots bar: visible until 5s idle, hides, reappears on a number key
	const [saves, setSaves] = useState<{ visible: boolean; lit: number; count: number }>({
		visible: true,
		lit: -1,
		count: 0,
	});
	const savesHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const hideSavesBar = () => setSaves({ visible: false, lit: -1, count: savedSettingsRef.current.length });
	const revealSavesBar = () => {
		if (savesHideTimer.current) clearTimeout(savesHideTimer.current);
		savesHideTimer.current = setTimeout(hideSavesBar, 5000);
	};

	const randomValues = () => {
		Global.engine.master.stop();
		const cols = stateRef.current.cols;
		Object.keys(cols).forEach((k) => {
			const channel = cols[k];
			// a col can exist in state without a sound (no file in the model, or
			// mid teardown while loading a new model) — skip those
			if (!Global.engine.exist(channel.id)) return;
			const mul = Math.random();
			Global.engine.rate(channel.id, mul);
			Global.engine.mute(channel.id, Math.random() > 0.5);
			Global.engine.volume(channel.id, Math.random());
			Global.engine.pan(channel.id, Math.random() * 180 - 90);
		});
		const snapshot: SavedSoundSettings[] = [];
		Global.engine.sounds.forEach((s: any, idx) => {
			const sound = s.sound;
			const start = Math.random() * sound._duration;
			const end = Math.random() * (sound._duration - start);
			const loopOn = Math.random() < 0.5;
			const lockedOn = Math.random() > 0.75;
			Global.engine.loop(s.id, true, { start, end });
			sound._loop = loopOn;
			if (Math.random() < 0.5) Global.engine.reverse(s.id, true);
			setTimeout(() => Global.engine.lock(s.id, lockedOn), idx * 200);
			snapshot.push({
				id: s.id,
				volume: sound._volume,
				rate: sound._rate,
				pan: sound._pan,
				muted: sound._muted,
				loop: sound._loop,
				loopStart: sound._loopStart,
				loopEnd: sound._loopEnd,
				reversed: sound._reversed,
				locked: lockedOn,
			});
		});
		// remember the new settings — newest first, keep the last 10 (0-9 keys)
		savedSettingsRef.current = [{ at: Date.now(), sounds: snapshot }, ...savedSettingsRef.current].slice(0, 10);
		// reveal the slots bar (count updated) so the new save is visible
		setSaves((prev) => ({ ...prev, visible: true, count: savedSettingsRef.current.length }));
		revealSavesBar();
		Global.engine.master.play();
	};

	const restoreSettings = useCallback((slot: number) => {
		const saved = savedSettingsRef.current[slot];
		if (!saved) return;
		saved.sounds.forEach((cfg) => {
			if (!Global.engine.exist(cfg.id)) return;
			// unmute first: engine.volume silently skips muted sounds, so the
			// real mute state is re-applied last
			Global.engine.mute(cfg.id, false);
			Global.engine.volume(cfg.id, cfg.volume);
			Global.engine.rate(cfg.id, cfg.rate);
			Global.engine.pan(cfg.id, cfg.pan);
			Global.engine.loop(cfg.id, !!cfg.loop, { start: cfg.loopStart, end: cfg.loopEnd });
			Global.engine.reverse(cfg.id, !!cfg.reversed);
			Global.engine.lock(cfg.id, !!cfg.locked);
			Global.engine.mute(cfg.id, !!cfg.muted);
		});
		Global.engine.master.play();
	}, []);

	const flashAndRestore = (slot: number) => {
			// invalid slot: just reveal the bar; no setting is saved at that key
			const count = savedSettingsRef.current.length;
			const valid = slot < count;
			setSaves((prev) => ({ ...prev, visible: true, lit: valid ? slot : -1 }));
			if (valid) {
				setTimeout(() => setSaves((prev) => (prev.lit === slot ? { ...prev, lit: -1 } : prev)), 350);
				restoreSettings(slot);
			}
			revealSavesBar();
		};

	// hide the slots bar after 5s idle from mount (it reappears on key presses)
	useEffect(() => {
		savesHideTimer.current = setTimeout(hideSavesBar, 5000);
		return () => {
			if (savesHideTimer.current) clearTimeout(savesHideTimer.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// ---- swipe / misc ----------------------------------------------------
	const onSwipeStart = useCallback((e: React.TouchEvent) => {
		const touch = e.changedTouches[0];
		touchStartRef.current = { x: touch.pageX, y: touch.pageY, t: Date.now() };
	}, []);

	const onSwipeEnd = useCallback((e: React.TouchEvent) => {
		const touch = e.changedTouches[0];
		const dist = touch.pageX - (touchStartRef.current?.x || 0);
		const elapsed = Date.now() - (touchStartRef.current?.t || 0);
		touchStartRef.current = null;
		if (dist > 200 && elapsed < 500) set({ hud: false });
	}, []);

	const onCancelEncodeAudio = useCallback(() => {
		Global.engine.cancelEncodeAudio();
		set({ notification: null });
	}, []);

	// ---- render ----------------------------------------------------------
	if (notsupported) return <NotSupported />;

	const {
		init: initialized,
		rows,
		cols,
		recording,
		hud,
		controls,
		model,
		notification,
		inputDevices,
		deviceId,
		inputNotAllowed,
		midiDevices,
		midiDeviceId,
		midiSupported,
		fullscreen,
		error,
		saveDialog,
		newDialog,
		recordingDialog,
		helpDialog,
		masterstate,
		sampling,
	} = state;

	const points = rows.map((row, rowidx) => {
		const columns = row.map((c) => {
			const col = cols[c.id];
			if (!col) return null;
			return (
				<Column
					key={c.id}
					id={c.id}
					controls={controls}
					midiSupported={midiSupported}
					fullscreen={col.fullscreen}
					locked={col.locked}
					sampling={sampling === c.id}
					isSampling={sampling}
					heat={col.data && col.data.heat}
					onActive={() => {}}
					onUpload={(buffer, filename) => onUpload(c.id, buffer, filename)}
					onMultiUpload={(files) => onMultiUpload(c.id, files)}
					onPlay={(opt) => Global.engine.play(c.id, opt)}
					onPause={() => Global.engine.pause(c.id)}
					onStop={() => Global.engine.stop(c.id)}
					onSolo={(on) => Global.engine.solo(c.id, on, false)}
					onVolume={(vol) => onVolume(c.id, vol)}
					onRate={(rate) => onRate(c.id, rate)}
					onLoop={(on, offset) => onLoop(c.id, on, offset)}
					onMute={(on) => Global.engine.mute(c.id, on)}
					onSampleRecord={(on) => onSampleRecord(c.id, on)}
					onCancelSampleRecord={() => onCancelSampleRecord(c.id)}
					onEffectBypass={(type, active) => Global.engine.effectBypass(c.id, type, active)}
					onEffectParams={(type, params) => Global.engine.effectParams(c.id, type, params)}
					onDownload={() => onDownloadSample(c.id)}
					onLocked={(on) => onLocked(c.id, on)}
					onMidiMapMode={(on, unmap) => onMidiMapMode(c.id, on, unmap)}
					onReverse={(on) => onReverse(c.id, on)}
					onEffectsEnabled={(on) => onEffectsEnabled(c.id, on)}
					onFullscreen={(on) => onColumnFullscreen(c.id, on)}
				/>
			);
		});
		return (
			<div key={'r' + rowidx} className={s.row}>
				{columns}
			</div>
		);
	});

	return (
		<div className={s.container}>
			<Home init={initialized} onStart={onStart} />
			<form style={{ display: 'none' }}>
				<input
					type='file'
					id='upload'
					accept={'application/zip'}
					ref={fileUploaderRef}
					style={{ display: 'none' }}
				/>
			</form>
			{error && (
				<div className={s.error}>
					<div className={s.errorBox}>
						<div className={s.errorHeader}>Error</div>
						<div className={s.errorMessage}>{error.toString()}</div>
						<div className={s.errorButtons}>
							<button onClick={onErrorClose}>Close</button>
						</div>
					</div>
				</div>
			)}
			{notification && (
				<div className={s.notification} onMouseMove={(e) => e.stopPropagation()}>
					<div className={s.notificationBox}>
						<div>{notification.message}</div>
						{notification.description && <div>{notification.description}</div>}
						{notification.loading && (
							<div className={s.notificationLoading}>
								<AiOutlineLoading />
							</div>
						)}
						{notification.close && (
							<div className={s.notificationClose}>
								<button onClick={onCancelEncodeAudio}>Cancel</button>
							</div>
						)}
					</div>
				</div>
			)}

			<SavesBar visible={saves.visible} lit={saves.lit} count={saves.count} onRestore={flashAndRestore} />

			<div
				ref={canvasRef}
				className={s.canvas}
				onTouchStart={(e) => onSwipeStart(e)}
				onTouchEnd={(e) => onSwipeEnd(e)}
				onMouseMove={(e) => {
					if (!ios) onMouseMove(e);
				}}
			>
				{points}
				{recording && <div className={s.rec}>{recording ? '[REC]' : ''}</div>}
				{saveDialog && (
					<SaveDialog
						model={model}
						onSubmit={(name) => saveModel(name)}
						onClose={() => set({ saveDialog: false })}
					/>
				)}
				{newDialog && (
					<NewDialog
						onSubmit={(name, cols, rows) => createModel(name, cols, rows)}
						onClose={() => set({ newDialog: false })}
					/>
				)}
				{helpDialog && <HelpDialog onClose={() => set({ helpDialog: false })} />}
				<RecordingsDialog
					recordings={recordings}
					show={recordingDialog}
					onDeleteRecording={(id) => onDeleteRecording(id)}
					onDownload={(id, type) => onDownload(id, type)}
					onClose={() => set({ recordingDialog: false })}
				/>
			</div>
			<Controls
				init={initialized}
				volume={masterstate.volume}
				locked={masterstate.locked}
				looping={masterstate.looping}
				playing={masterstate.playing}
				muted={masterstate.muted}
				paused={masterstate.paused}
				duration={masterstate.duration}
				rate={masterstate.rate}
				model={model}
				show={hud}
				models={models}
				recording={masterstate.recording}
				recordings={recordings}
				recordingProgress={state.recordingProgress}
				showRecordings={recordingDialog}
				showHelp={helpDialog}
				inputDevices={inputDevices}
				inputDeviceId={deviceId === null ? undefined : deviceId}
				midiDevices={midiDevices}
				midiDeviceId={midiDeviceId === null ? undefined : midiDeviceId}
				fullscreen={fullscreen}
				controls={controls}
				midiSupported={midiSupported}
				onRequestInput={onRequestInput}
				onFullscreen={(on) => onFullscreen(on)}
				onLoadModel={(name) => onLoadModel(name)}
				onVolume={(vol) => Global.engine.master.volume(vol)}
				onMute={(on) => Global.engine.master.mute(on)}
				onLoop={(on) => Global.engine.master.loop(on)}
				onLocked={(on) => Global.engine.master.locked(on)}
				onRecord={(on) => onRecord(on)}
				onDeviceChange={(id) => onDeviceChange(id)}
				onOutputDeviceChange={(id) => console.log('output device change', id)}
				onMidiDeviceChange={(id) => onMidiDeviceChange(id)}
				onControls={(active) => set({ controls: active })}
				onSave={() => set({ saveDialog: true })}
				onLoad={() => onUploadModelFromFile()}
				onToggleNewSet={() => set({ newDialog: !state.newDialog })}
				onToggleRecordings={(on) => set({ recordingDialog: on })}
				onToggleHelp={(on) => set({ helpDialog: on })}
			/>
		</div>
	);
}

/* eslint-disable @typescript-eslint/no-unused-vars */
function onVolume(id: string, vol: number) {
	Global.engine.volume(id, vol);
}
function onRate(id: string, rate: number) {
	Global.engine.rate(id, rate);
}
function onLoop(id: string, on: boolean, offset?: Record<string, number>) {
	Global.engine.loop(id, on, offset);
}
function onLocked(id: string, on: boolean) {
	Global.engine.lock(id, on);
}
function onReverse(id: string, on: boolean) {
	Global.engine.reverse(id, on);
}
function onEffectsEnabled(id: string, on: boolean) {
	if (on) Global.engine.enableEffects(id);
	else Global.engine.disableEffects(id);
}
function onMidiMapMode(id: string, on: boolean, unmap?: boolean) {
	if (unmap) return Global.engine.unmapMidiNote(id);
	Global.engine.midiMapMode(id, on);
}
/* eslint-enable @typescript-eslint/no-unused-vars */
