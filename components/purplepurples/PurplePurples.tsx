'use client';

import Global from '@/lib/Global';
import screenfull from 'screenfull';
import { AiOutlineLoading } from 'react-icons/ai';
import MobileDetect from 'mobile-detect';
import { useCallback, useEffect, useRef, useState } from 'react';
import cn from 'classnames';
import Column from './Column';
import SavesBar, { keyToSlot } from './SavesBar';
import Controls from './Controls';
import Home from './Home';
import SaveDialog from './SaveDialog';
import NewDialog from './NewDialog';
import HelpDialog from './HelpDialog';
import RecordingsDialog, { type Recording } from './RecordingsDialog';
import NotSupported from './NotSupported';
import { useKeyboardShortcuts, type KeyboardHandlers } from './useKeyboardShortcuts';
import { useEngineListeners } from './useEngineListeners';
import type { Model, MoveData, PresetSlot } from './types';
import s from './PurplePurples.module.scss';

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
	models: Model[];
	presets: PresetSlot[];
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
	models: [],
	presets: [],
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
	const [recordings, setRecordings] = useState<Recording[]>([]);

	const stateRef = useRef(state);
	stateRef.current = state;
	const elementMapRef = useRef<Record<string, HTMLElement>>({});
	const canvasRef = useRef<HTMLDivElement>(null);
	const fileUploaderRef = useRef<HTMLInputElement>(null);
	const introTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
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

	// ---- model grid ------------------------------------------------------
	// The engine owns model I/O + presets (lib/audio/model.ts); this only builds
	// the grid state for the model the engine just populated.
	const buildGrid = useCallback((model: Model) => {
		const cols: Record<string, any> = {};
		const rows: { id: string }[][] = [];
		let fileIdx = 0;
		for (let row = 0; row < model.rows; row++) {
			const rowCols: { id: string }[] = [];
			for (let col = 0; col < model.cols; col++) {
				const id = row + '-' + col;
				const file = model.files[fileIdx++];
				const params = file && file.params ? file.params : {};
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
	}, []);

	const initDone = useCallback(async () => {
		try {
			const model = await Global.engine.loadModel(stateRef.current.model);
			if (model) buildGrid(model);
		} catch (err) {
			handleError(err);
		}
	}, [buildGrid]);

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
					if (start) initDone();
				})
				.catch((err: unknown) => {
					if (err === 'NOTALLOWED') {
						set({ inputNotAllowed: true });
						if (start) initDone();
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
				await Global.engine.loadModels();
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
			Global.engine
				.loadModelFromFile(file)
				.then((model) => model && buildGrid(model))
				.catch((err) => err !== 'CANCELLED' && handleError(err))
				.finally(() => (target.value = ''));
		};
		el.addEventListener('change', onChange);
		return () => el.removeEventListener('change', onChange);
	}, [buildGrid]);

	// ---- keyboard shortcuts ---------------------------------------------
	const handlersRef = useRef<KeyboardHandlers>({
		onRecord: () => {},
		toggleSave: () => {},
		toggleControls: () => {},
		toggleFullscreen: () => {},
		randomValues: () => {},
		pressSlot: () => {},
		closeDialogs: () => {},
		toggleHud: () => {},
		stop: () => {},
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
		stop: () => Global.engine.master.stop(),
		pressSlot: (key) => pressSlot(key),
		closeDialogs: () => set({ newDialog: false, saveDialog: false }),
		toggleHud: () => set({ hud: !stateRef.current.hud }),
		masterstate: stateRef.current.masterstate,
		hud: stateRef.current.hud,
		recording: stateRef.current.recording,
	};
	useKeyboardShortcuts(handlersRef);

	// ---- transport / record ---------------------------------------------
	const onRecord = useCallback((start: boolean) => {
		if (stateRef.current.loading || stateRef.current.masterstate.recording) return;
		if (!start) return Global.engine.record(false);
		set({ recording: true });
		Global.engine
			.record(true)
			.then((recording: Recording) => setRecordings((prev) => [recording, ...prev]))
			.catch((err: unknown) => {
				if (err === 'CANCELLED') return;
				console.error(err);
				handleError(err);
			})
			.finally(() => set({ recording: false }));
	}, []);

	const onSampleRecord = useCallback((id: string, start: boolean) => {
		console.log('onSampleRecord', id, start);
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
			if (type === 'wav') return Global.engine.download(recording.blob, recording.name + '.wav');
			set({ notification: { message: 'Converting to mp3', close: true } });
			Global.engine
				.encodeAudio(recording.buffer, 'mp3')
				.then((blob: Blob) => {
					Global.engine.download(blob, recording.name + '.mp3');
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
		Global.engine.downloadSound(id);
	}, []);

	const onUpload = useCallback(
		(id: string, buffer: ArrayBuffer, filename: string) => {
			const name = filename.toLowerCase();
			if (name && name.endsWith('.zip')) {
				Global.engine
					.loadModel(name.replace('.zip', ''), buffer)
					.then((model) => {
						if (model) buildGrid(model);
					})
					.catch((err) => handleError(err));
				return;
			}
			const objURL = URL.createObjectURL(
				new Blob([buffer], { type: Global.fileToMimeType(filename) }),
			);
			Global.engine.replace(id, objURL, filename);
		},
		[buildGrid],
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
		try {
			await Global.engine.downloadModel(modelName);
		} catch (err) {
			handleError(err);
		} finally {
			set({ notification: null });
		}
	}, []);

	const createModel = useCallback(
		(name: string, cols: number, rows: number) => {
			try {
				const model = Global.engine.createModel(name, cols, rows);
				set({ newDialog: false });
				buildGrid(model);
			} catch (err) {
				handleError(err);
			}
		},
		[buildGrid],
	);

	const onLoadModel = useCallback(
		(name: string) => {
			Global.engine
				.loadModel(name)
				.then((model) => {
					if (model) buildGrid(model);
				})
				.catch((err) => handleError(err));
		},
		[buildGrid],
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

	// ---- randomize / presets ---------------------------------------------
	// Presets are owned by the engine (ModelManager) and persisted inside the
	// model file. There is one slot per number key: array[0] = key '1' …
	// array[9] = key '0'. A slot stays empty until its key is pressed the
	// first time — nothing is generated up front.

	// saved-slots bar: visible until 5s idle, hides, reappears on a number key
	const [saves, setSaves] = useState<{ visible: boolean; lit: number }>({
		visible: true,
		lit: -1,
	});
	const savesHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const hideSavesBar = () => setSaves({ visible: false, lit: -1 });
	const revealSavesBar = () => {
		if (savesHideTimer.current) clearTimeout(savesHideTimer.current);
		savesHideTimer.current = setTimeout(hideSavesBar, 5000);
	};

	// 'b': randomize into the next free slot (live only when all 10 are taken)
	const randomValues = () => {
		Global.engine.randomizePreset();
		// reveal the slots bar so the new preset is visible (state follows engine)
		setSaves((prev) => ({ ...prev, visible: true }));
		revealSavesBar();
	};

	/**
	 * A number key (or a bar button): play that slot's preset when it has one,
	 * otherwise generate a random preset into that slot — so the first press
	 * of a key creates something and every press after replays it.
	 */
	const pressSlot = (key: number) => {
		const idx = keyToSlot(key);
		if (Global.engine.hasPreset(idx)) Global.engine.restorePreset(idx);
		else Global.engine.randomizePreset(idx);
		setSaves({ visible: true, lit: key });
		setTimeout(() => setSaves((prev) => (prev.lit === key ? { ...prev, lit: -1 } : prev)), 350);
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
		models,
		presets,
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

			<SavesBar visible={saves.visible} lit={saves.lit} presets={presets} onPress={pressSlot} />

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
