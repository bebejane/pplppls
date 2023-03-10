import Global from "../../../Global";
import React, { Component } from "react";
import "./index.css";
import { AiOutlineLoading } from "react-icons/ai";
import AudioEngine from "../../../services/AudioEngine";
import isElectron from "is-electron";
import Controls from "./Controls";
import Home from "./Home";
import TitleBar from "../../util/TitleBar";
import Column from "./Column";
import SaveDialog from "./SaveDialog";
import RecordingsDialog from "./RecordingsDialog";
import HelpDialog from "./HelpDialog";
import NewDialog from "./NewDialog";
import NotSupported from "./NotSupported";
import axios from "axios";
import JSZip from "jszip";
import screenfull from "screenfull";
const MobileDetect = require("mobile-detect");
const Mobile = new MobileDetect(window.navigator.userAgent);

class PurplePurples extends Component {
	constructor(props) {
		super(props);
		this.state = {
			init: false,
			model: "world winter II",
			status: "",
			x: 0,
			y: 0,
			cols: {},
			rows: [],
			numCols: 0,
			numRows: 0,
			masterstate: {},
			inputDevices: [],
			outputDevices: [],
			midiDevices: [],
			midiSupported: false,
			loading: true,
			loaded: 0,
			progress: { loaded: 0, total: 0 },
			deviceId: null,
			midiDeviceId: null,
			recording: false,
			sampling: false,
			hud: true,
			controls: false,
			locked: true,
			loop: true,
			mute: false,
			fullscreen: false,
			saveDialog: false,
			helpDialog: false,
			newDialog: false,
			recordingDialog: false,
			volume: 0,
			notification: null,
			inputNotAllowed: false,
			recordingProgress: {},
			samplingProgress: {},
			notsupported: Mobile.phone() || Mobile.tablet() || false,
			ios: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
		};

		this.models = [];
		this.recordings = [];
		this.elementMap = {};
		this.canvasRef = React.createRef();
		this.fileUploaderRef = React.createRef();
		this.fileUploaderFormRef = React.createRef();
		this.introTimeout = null;

		try {
			Global.engine = new AudioEngine({
				sampleRate: 44100,
				channels: 2,
				volume: 0.5,
				mode: "single",
				electron: isElectron(),
				enableAnalysers: true,
				enableElapsed: true,
				//enableLoops:true,
				processSample: {
					trim: true,
					normalize: true,
				},
			});
			Global.engine.on("inputdevices", (devices) => {
				this.setState({ inputDevices: devices });
			});
			Global.engine.on("mididevices", (devices) => {
				this.setState({ midiDevices: devices });
			});
		} catch (err) {
			this.setState({ notsupported: true });
		}
	}
	async componentDidMount() {
		try {
			this.models = await this.loadFile("/models/index.json");
			console.log(this.models);
			this.init();
		} catch (err) {
			this.handleError(err);
		}
		this.initKeyboard();

		document.addEventListener(
			"touchmove",
			(e) => {
				e.preventDefault();
			},
			true
		);
	}
	componentWillUnmount() {
		this.props.onQuit();
	}
	initKeyboard() {
		document.body.addEventListener("keydown", (e) => {
			const key = e.key;
			if (e.target.tagName === "INPUT") return;

			switch (key) {
				case " ":
					this.onRecord(!this.state.recording);
					break;
				case "Space":
					this.onRecord(!this.state.recording);
					break;
				case "Enter":
					if (!this.state.masterstate.playing) Global.engine.master.play();
					else Global.engine.master.stop();
					break;
				case "esc":
					this.setState({ newDialog: false, saveDialog: false });
					break;
				case "v":
					this.setState({ hud: !this.state.hud });
					break;
				case "m":
					Global.engine.master.mute(!Global.engine.master.muted());
					break;
				case "p":
					Global.engine.pause();
					break;
				case "s":
					this.onToggleSave();
					break;
				case "c":
					this.onControls(!this.state.controls);
					break;
				case "f":
					this.onFullscreen(!this.state.fullscreen);
					break;
				case "b":
					this.randomValues();
					break;
				default:
					break;
			}
		});
	}
	onStart() {
		if (!this.introTimeout)
			this.introTimeout = setTimeout(() => this.setState({ hud: true, controls: true }), 30000);
		else clearTimeout(this.introTimeout);

		Global.engine.context.resume().then(() => {
			//this.setState({hud:true,controls:true})
			this.init(true);
		});
	}
	init(start) {
		if (!Global.engine)
			return this.handleError(
				"This browser is not really supported. Use Firefox or Chrome to try this out!"
			);

		console.log("----------- INIT --------------");

		this.setState({ init: false });

		const lastInputDevice = localStorage.getItem("lastInputDevice");
		const lastMidiDevice = localStorage.getItem("lastMidiDevice");

		Global.engine
			.init(lastInputDevice, lastMidiDevice)
			.then((info) => {
				if (info && info.devices)
					this.setState({ inputDeviceId: info.selected, inputDevices: info.devices });
				if (start) this.initDone();
			})
			.catch((err) => {
				if (err === "NOTALLOWED") {
					this.setState({ inputNotAllowed: true });
					if (start) this.initDone();
					return;
				}
				this.handleError(err);
			});

		Global.engine
			.initMidi()
			.then((devices) => {
				console.log("MIDI SUPPORTED", devices);
				this.setState({ midiDevices: devices, midiSupported: true });
				if (!devices.length) return;
				const device = devices.filter((d) => d.deviceId === lastMidiDevice)[0] || devices[0];
				this.onMidiDeviceChange(device.deviceId);
			})
			.catch((err) => {
				console.log("MIDI NOT AVAILABLE");
			});

		this.fileUploaderRef.current.addEventListener("change", (event) => {
			if (!event.target.files.length) return;
			const file = event.target.files[0];

			if (!file.name.toLowerCase().endsWith(".zip"))
				return this.handleError("Format not supported");

			this.setState({ notification: { message: "Loading", description: "0%" } });

			const reader = new FileReader();
			reader.addEventListener("load", (e) => {
				const name = file.name.replace(/(\.zip)/gi, "");
				this.loadModel(name, e.srcElement.result)
					.then((model) => {
						this.initModel(model);
					})
					.catch((err) => this.handleError(err))
					.then(() => {
						this.setState({ notification: null });
					});
			});
			reader.addEventListener("progress", (e) => {
				this.setState({
					notification: {
						message: "Loading",
						description: parseInt((e.loaded / e.total) * 100) + "%",
					},
				});
			});
			reader.addEventListener("error", (err) => {
				console.error(err);
				this.setState({ error: err, notification: null });
			});
			reader.addEventListener("abort", () => {
				this.setState({ notification: null });
			});
			reader.readAsArrayBuffer(file);
		});
	}
	onRequestInput() {
		Global.engine
			.initInputDevices()
			.then((info) => {
				if (info.devices) {
					const device = info.devices.filter((d) => d.deviceId === info.selected)[0];
					if (device) this.setState({ inputDeviceId: info.selected, inputDevices: info.devices });
				}
			})
			.catch((err) => {
				console.log(err);
				if (err == "NOTALLOWED") {
					this.setState({ inputNotAllowed: true });
					this.handleError("You have to reload page to select input");
				}
			});
	}
	async initDone() {
		const model = await this.loadModel(this.state.model);

		Global.engine.on("loaderror", (id, err) => {
			const cols = this.state.cols;
			cols[id].error = err;
			this.setState({ cols: cols });
		});

		Global.engine.on("recordingprogress", (prog) => {
			this.setState({ recordingProgress: prog });
		});

		Global.engine.on("masterstate", (state, updated) => {
			this.setState({ masterstate: state });
		});

		Global.engine.on("error", (err, id) => {
			console.log("ENGINE ERROR", err);
		});
		Global.engine.on("loaderror", (err, id) => {
			const cols = this.state.cols;
			cols[id].error = err;
			this.setState({ cols });
		});
		Global.engine.on("ready", (id, status) => {
			const cols = this.state.cols;
			const notification = {
				message: "Loading",
				description: status.ready + "/" + status.total,
			};
			const progress = {
				loaded: status.ready,
				total: status.total,
			};

			if (status.ready === status.total) {
				this.setState({
					loading: false,
					model: this.state.model,
					notification: null,
					progress: null,
					init: true,
					cols,
				});
				this.ready();
			} else this.setState({ cols: cols, notification, progress });
		});
		Global.engine.on("loadingprogress", (progress) => {
			console.log(progress);
			this.setState({ progress });
		});

		this.initModel(model);
	}
	async loadFile(file, contentLength) {
		let content = null;
		const binary = !file.toLowerCase().endsWith(".json");
		const type = binary ? "arraybuffer" : "json";

		console.log("donwloading file", file, contentLength);

		if (!isElectron()) {
			console.time("download file");
			content = await axios
				.get(file, {
					responseType: type,
					onDownloadProgress: (prog) => {
						if (!binary) return;

						const total = prog.total || contentLength;
						const perc = ((prog.loaded / total) * 100).toFixed(0);
						this.setState({
							notification: { message: "", description: perc + "%", loading: false },
						});
					},
				})
				.then((res) => {
					console.timeEnd("download file");
					this.setState({ notification: null });
					return res.data;
				});
		} else {
			const fs = window.require("fs");
			const root = window.require("electron").remote.app.getAppPath();
			const filePath = root + "/build" + file;
			content = fs.readFileSync(filePath, type === "arraybuffer" ? "binary" : "utf-8");
			if (type === "json") content = JSON.parse(content);
		}

		return content;
	}
	async loadModel(name, zipContent) {
		console.log("---------- LOAD MODEL ------");

		const model = this.models.filter((model) => model.name === name)[0];

		if (model && model.files.length && model.files[0].buffer) {
			console.log("CACHED model");
			return Promise.resolve(model);
		}

		if (model && model.new) return Promise.resolve(model);

		if (!zipContent) {
			const zipFile = "/models/" + name + ".zip";
			try {
				zipContent = await this.loadFile(zipFile, model.contentLength);
			} catch (err) {
				return this.handleError(err);
			}
		}

		this.setState({ notification: { message: "Extracting", description: name } });

		return new Promise((resolve, reject) => {
			const zip = new JSZip();
			zip
				.loadAsync(zipContent)
				.then(async (z) => {
					const m = JSON.parse(await z.files["index.json"].async("text"));
					for (var i = 0; i < m.files.length; i++) {
						if (typeof m.files[i] === "string") m.files[i] = { filename: m.files[i] };

						if (z.files[m.files[i].filename])
							m.files[i].buffer = await z.files[m.files[i].filename].async("arraybuffer");
					}
					this.setState({ notification: null, model: m.name });
					console.log("LOADED MODEL", m);
					resolve(m);
				})
				.catch((err) => {
					this.setState({ notification: null });
					reject(err);
				});
		});
	}
	cancelLoadModel() {
		this.setState({ notification: null });
	}

	async saveModel(modelName) {
		if (!modelName) return;

		console.log("---------- SAVE ---------------");
		this.setState({
			saveDialog: false,
			notification: { message: "Saving: " + modelName, description: "" },
		});

		const model = {
			name: modelName,
			files: [],
			cols: this.state.numCols,
			rows: this.state.numRows,
			contentLength: 0,
		};
		const zip = new JSZip();
		const sounds = Global.engine.sounds;
		for (var i = 0; i < sounds.length; i++) {
			const sound = sounds[i].sound;
			if (sound._loaded) {
				const blob = new Blob([sound._buffer], { type: sound.mimeType });
				zip.file(sound._filename, blob, { binary: false, base64: true });
				model.contentLength += blob.size;
			}
			model.files.push({
				filename: sound._filename,
				mimeType: Global.fileToMimeType(sound._filename),
				params: sound.getSaveState(),
			});
		}
		zip.file("index.json", JSON.stringify(model, null, 4));
		Object.keys(zip.files).forEach((name) => (model.contentLength += zip.files[name]._data.length));

		zip
			.generateAsync({ type: "blob", compression: "STORE" })
			.then((content) => {
				this.forceDownload(content, modelName + ".purple.zip");
			})
			.catch((err) => {
				this.handleError(err);
			})
			.then(() => {
				this.setState({ notification: null });
			});
	}
	async onUploadModel(name, file) {
		this.setState({
			notification: {
				message: "Loading",
				description: name,
			},
		});
		console.log("upload model", name);
		this.loadModel(name, file.contents)
			.then((model) => {
				this.initModel(model);
			})
			.catch((err) => this.handleError(err))
			.then(() => {
				this.setState({ notification: null });
			});
	}
	onUploadModelFromFile(event) {
		this.fileUploaderRef.current.click();
	}

	onLoadModel(name, opt) {
		this.loadModel(name)
			.then((model) => {
				this.initModel(model);
			})
			.catch((err) => this.handleError(err));
	}
	async initModel(model, opt = {}) {
		console.log(model);
		Global.engine.destroy();
		const state = {
			cols: {},
			model: model.name,
			size: model.cols * model.rows,
			loaded: 0,
			numCols: model.cols,
			numRows: model.rows,
			notification: { message: "Loading", description: "0/" + model.files.length },
		};

		console.log("init", model, opt);
		let fileIdx = 0;
		state.rows = new Array(model.rows).fill(undefined).map((o, row) => {
			return new Array(model.cols).fill(undefined).map((o, col) => {
				const id = row + "-" + col;
				const file = model.files[fileIdx++];
				const filename = file ? file.filename : null;
				const params = file && file.params ? file.params : {};
				const effectParams =
					file && file.params && file.params.effects.length
						? file.params.effects[0].params
						: undefined;
				const effectBypass =
					file && file.params && file.params.effects.length
						? file.params.effects[0].bypassed
						: undefined;
				const url =
					file && file.buffer
						? URL.createObjectURL(new Blob([file.buffer], { type: file.mimeType }))
						: filename
						? "/audio/" + model.name + "/" + filename
						: null;

				Global.engine.add(id, url, filename, { ...params, enableAnalyser: false });
				Global.engine.addEffect(
					id,
					"delay",
					effectBypass != undefined ? effectBypass : false,
					effectParams
				);

				console.log(id, params, effectBypass);

				state.cols[id] = {
					model: model.name,
					id: id,
					row: row,
					col: col,
					subactive: false,
					active: false,
					fullscreen: false,
					...params,
					related: {
						l: row + "-" + (col - 1),
						r: row + "-" + (col + 1),
						t: row - 1 + "-" + col,
						b: row + 1 + "-" + col,
						tl: row - 1 + "-" + (col - 1),
						tr: row - 1 + "-" + (col + 1),
						bl: row + 1 + "-" + (col - 1),
						br: row + 1 + "-" + (col + 1),
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

				return { id: id };
			});
		});

		this.setState(state, () => {
			const elements = document.querySelectorAll(".sound-canvas-point-wrap");
			this.elementMap = {};
			elements.forEach((el) => (this.elementMap[el.id] = el));
			Global.engine.load();
		});
		if (!this.models.filter((m) => m.name === model.name).length) this.models.push(model);
	}
	createModel(name, cols, row) {
		if (this.models.filter((m) => m.name.toLowerCase() === name.toLowerCase()).length)
			return this.handleError("Name is already taken!");

		const model = {
			name: name,
			cols: cols,
			rows: row,
			files: [],
			new: true,
		};

		this.setState({ newDialog: false });
		this.initModel(model);
	}
	onMouseMove(e) {
		if (Math.abs(e.movementX) > 50 || Math.abs(e.movementY) > 50) return; //console.log('skip')

		let el = this.elementByPos(e.pageX, e.pageY);
		if (!el) return console.log("notfind");
		const col = this.state.cols[el.id];
		if (!col || col.fullscreen || this.state.loading) return;

		const l = el.offsetLeft;
		const t = el.offsetTop;
		const w = el.clientWidth;
		const h = el.clientHeight;
		const x = e.pageX - l;
		const y = e.pageY - t;

		const pos = {
			id: el.id,
			l: 100 - (x / w) * 100,
			r: Math.abs((x / w) * 100),
			t: 100 - (y / h) * 100,
			b: Math.abs((y / h) * 100),
			tl: (100 - (x / w) * 100 + (100 - (y / h) * 100)) / 2,
			tr: (Math.abs((x / w) * 100) + (100 - (y / h) * 100)) / 2,
			bl: (100 - (x / w) * 100 + Math.abs((y / h) * 100)) / 2,
			br: (Math.abs((x / w) * 100) + Math.abs((y / h) * 100)) / 2,
			w: w,
			h: h,
		};
		let heatX = x <= pos.w / 2 ? x / (pos.w / 2) : pos.w / x - 1.0;
		let heatY = y <= pos.h / 2 ? y / (pos.h / 2) : pos.h / y - 1.0;
		pos.heat = parseInt(((heatX + heatY) / 2) * 100);
		//if(Math.abs(e.movementX) > 50 ||  Math.abs(e.movementY) > 50) return console.log('skip')
		if (pos.id) this.onMove(pos);
	}
	onMove(data) {
		const cols = this.state.cols;
		const col = cols[data.id];
		const locked = Global.engine.lock(data.id);
		const soloOn = this.state.masterstate.solo;

		const heatPerc = Math.abs(data.heat - 100) / 100;
		const delayParams = {
			feedback: parseFloat(((heatPerc * 1.0) / 2).toFixed(1)),
			mix: parseFloat((heatPerc * 1.0).toFixed(1)),
			time: parseFloat(heatPerc * 1.0 <= 0 ? 0.0001 : heatPerc * 1.0),
		};
		//console.log(delayParams)
		/*
        const tremoloParams = {
            time:parseFloat((heatPerc*10.0).toFixed(2)),
            mix:parseFloat((heatPerc*1.0).toFixed(2)),
            depth:1.0//parseFloat((heatPerc*1.0).toFixed(3))
        }
        */

		if (!locked) {
			Global.engine.volume(data.id, parseFloat((data.heat / 100).toFixed(1)));
			Global.engine.pan(data.id, parseFloat((data.r - data.l - 10).toFixed(0)));
			Global.engine.effectParams(data.id, 0, delayParams);
		}
		if (soloOn) return;

		Object.keys(cols).forEach((k) => {
			cols[k].active = false;
			cols[k].subactive = false;
			cols[k].data.heat = 0;
		});

		Object.keys(col.related).forEach((k) => {
			const id = col.related[k];

			if (!cols[id]) return;
			cols[id].data.heat = data[k];
			cols[id].subactive = true;

			if (!Global.engine.lock(id)) {
				const vol = parseFloat((data[k] / 100).toFixed(1) / 2);
				Global.engine.volume(id, vol);
			}
		});
		cols[col.id].data = data;
		cols[col.id].active = true;
		cols[col.id].subactive = false;

		Object.keys(cols).forEach((k) => {
			if (Global.engine.lock(k)) return;
			if (cols[k].active || cols[k].subactive) Global.engine.mute(cols[k].id, false);
			else Global.engine.mute(cols[k].id, true);
		});

		//console.log(data)
	}

	elementByPos(x, y) {
		let el;
		Object.keys(this.elementMap).forEach((k) => {
			if (this.elementMap[k].offsetLeft < x && this.elementMap[k].offsetTop < y)
				el = this.elementMap[k];
		});
		return el;
	}
	ready() {
		console.log("READY TO ROOOLLLL");
		return;
	}
	reinitModel(opt) {
		this.initModel(this.state.model, opt);
	}

	static getDerivedStateFromProps(nextProps, prevState) {
		return nextProps;
	}
	onOver() {}

	onToggleSave() {
		this.setState({ saveDialog: !this.state.saveDialog });
	}
	onToggleNewSet() {
		this.setState({ newDialog: !this.state.newDialog });
	}
	onToggleHelp() {
		this.setState({ helpDialog: !this.state.helpDialog });
	}
	onToggleRecordings(on) {
		this.setState({ recordingDialog: on !== undefined ? on : !this.state.recordingDialog });
	}
	onRecord(start, id) {
		if (this.state.loading) return;

		if (start) {
			if (this.state.masterstate.recording) return;

			this.setState({ recording: true });
			Global.engine
				.record(true)
				.then((recording) => {
					console.log("Finished recording", recording);
					this.recordings.unshift(recording);
				})
				.catch((err) => {
					if (err === "CANCELLED") return;
					console.error(err);
					this.handleError(err);
				})
				.then(() => {
					this.setState({ recording: false });
				});
		} else Global.engine.record(false, id);
	}

	onSampleRecord(id, start) {
		if (this.state.loading) return;
		const cols = this.state.cols;

		if (start) {
			this.setState({ sampling: id });
			Global.engine
				.sample(id, true)
				.then((recording) => {
					console.log("Finished sampling");
					Global.engine.lock(id, true);
				})
				.catch((err) => {
					this.setState({ sampling: false });
					if (err === "CANCELLED") return;
					this.handleError(err);
				});
		} else {
			this.setState({ sampling: false }, () => {
				Global.engine.sample(id, false);
			});
		}
	}
	onCancelSampleRecord(id) {
		Global.engine.cancelSample(id);
	}
	onDeleteRecording(id) {
		console.log("delete recording", id);
		this.recordings = this.recordings.filter((r) => r.id !== id);
		this.setState({ recordings: this.recordings });
	}

	onOutputDeviceChange(outputDeviceId) {
		console.log("change output device", outputDeviceId);
		this.setState({ outputDeviceId });
		localStorage.setItem("lastOutputDevice", outputDeviceId);
	}

	onMidiDeviceChange(midiDeviceId) {
		if (!midiDeviceId) return;
		console.log("change midi device", midiDeviceId);
		Global.engine
			.initMidiSource(midiDeviceId)
			.then((midiSource) => {
				localStorage.setItem("lastMidiDevice", midiDeviceId);
				this.setState({ midiDeviceId });
			})
			.catch((err) => this.handleError(err));
	}
	onDeviceChange(inputDeviceId) {
		console.log("change device", inputDeviceId);
		Global.engine
			.initInputSource(inputDeviceId)
			.then((inputSource) => {
				localStorage.setItem("lastInputDevice", inputDeviceId);
				this.setState({ inputDeviceId });
			})
			.catch((err) => this.handleError(err));
	}
	async onDownload(id, type) {
		const recording = this.recordings.filter((r) => r.id === id)[0];
		console.log("DOWNLOAD", recording);
		if (type === "wav") return this.forceDownload(recording.blob, recording.name + ".wav");

		this.setState({ notification: { message: "Converting to mp3", close: true } });
		console.time("encode");
		Global.engine
			.encodeAudio(recording.buffer, "mp3")
			.then((blob) => {
				this.forceDownload(blob, recording.name + ".mp3");
				console.timeEnd("encode");
			})
			.catch((err) => {
				if (err === "CANCELLED") return console.log("encoding cancelled");
				this.handleError(err);
			})
			.then(() => this.setState({ notification: null }));
	}
	async onDownloadSample(id) {
		const s = Global.engine.get(id);
		const blob = new Blob([s.sound._buffer], { type: s.sound.mimeType });
		this.forceDownload(blob, s.sound.filename);
	}
	forceDownload(blob, filename) {
		const a = document.createElement("a");
		a.style = "display: none";
		document.body.appendChild(a);
		var url = window.URL.createObjectURL(blob);
		a.href = url;
		a.download = filename;
		a.click();
		setTimeout(function () {
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
		}, 100);
	}
	onUpload(id, buffer, filename) {
		console.log("UPLOAD - - - - -  -", id, buffer);
		const name = filename.toLowerCase();
		if (name && name.endsWith(".zip")) {
			console.log("upload model", name);
			this.loadModel(name.replace(".zip", ""), buffer)
				.then((model) => {
					this.initModel(model);
				})
				.catch((err) => this.handleError(err));
			return;
		}

		const objURL = URL.createObjectURL(
			new Blob([buffer], { type: Global.fileToMimeType(filename) })
		);
		Global.engine.replace(id, objURL, filename);
	}
	onMultiUpload(id, files) {
		console.log("multiupload", id, files);
		let offset = 0;
		Global.engine.sounds.forEach((s, idx) => {
			if (id === s.id) offset = idx;
		});
		files.forEach((f, idx) => {
			if (Global.engine.sounds.length < offset + idx) return;
			const id = Global.engine.sounds[offset + idx].id;
			const objURL = URL.createObjectURL(new Blob([f.contents]), {
				type: Global.fileToMimeType(f.filename),
			});
			Global.engine.replace(id, objURL, f.filename);
		});
	}
	onFullscreen(on) {
		if (on) screenfull.request();
		else screenfull.exit();

		this.setState({ fullscreen: on });
	}
	toggleFullScreen(on) {}
	onColumnFullscreen(id, on) {
		const cols = this.state.cols;
		cols[id].fullscreen = on;
		cols[id]._volume = cols[id].volume;
		this.setState({ cols }, () => {
			if (on) {
				console.log("vol 1.0", id);
				Global.engine.mute(id, false);
				Global.engine.volume(id, 1.0);
				Global.engine.rate(id, 1.0);
			} else Global.engine.volume(id, cols[id]._volume);
		});
		console.log("fullscreen", id, on);
	}

	onPause(on) {
		Global.engine.master.pause(on);
	}
	onVolume(id, vol) {
		Global.engine.volume(id, vol);
	}
	onLoop(id, on, offset = {}) {
		Global.engine.loop(id, on, offset);
	}
	onLocked(id, on) {
		Global.engine.lock(id, on);
	}
	onLockedAll(on) {
		Global.engine.master.locked(on);
	}
	onReverse(id, on) {
		Global.engine.reverse(id, on);
	}
	onEffectBypass(id, type, on) {
		Global.engine.effectBypass(id, type, on);
	}

	onEffectsEnabled(id, on) {
		if (on) Global.engine.enableEffects(id);
		else Global.engine.disableEffects(id);
	}
	onMidiMapMode(id, on, unmap) {
		console.log("midi map mode", id, on);
		if (unmap) return Global.engine.unmapMidiNote(id);
		Global.engine.midiMapMode(id, on);
	}
	onSwipe(e, start) {
		const touch = e.changedTouches[0];
		if (start) this.touchStart = { x: touch.pageX, y: touch.pageY, t: Date.now() };
		else {
			const dist = touch.pageX - this.touchStart.x;
			const elapsed = Date.now() - this.touchStart.t;
			if (dist > 200 && elapsed < 500) this.setState({ hud: false });
			//var swiperightBol = (elapsed <= allowedTime && dist >= threshold && Math.abs(touchobj.pageY - startY) <= 100)
		}
		e.preventDefault();
	}
	onSwipeStart(e) {
		const touch = e.changedTouches[0];
		this.touchStart = { x: touch.pageX, y: touch.pageY, t: Date.now() };
	}
	onSwipeEnd(e) {
		const touch = e.changedTouches[0];
		const dist = touch.pageX - this.touchStart.x;
		const elapsed = Date.now() - this.touchStart.t;
		this.touchStart = null;
		//if(dist >200 && elapsed < 500) this.setState({hud:false})

		console.log(elapsed, dist);
	}
	onControls(active) {
		this.setState({ controls: !this.state.controls });
	}
	handleError(err) {
		const error = typeof err === "string" ? err : err.message || err.toString();
		this.setState({ error: error });
		console.error(err);
	}
	onErrorClose() {
		this.setState({ error: null });
	}
	onCancelEncodeAudio() {
		Global.engine.cancelEncodeAudio();
		this.setState({ notification: null });
	}
	render() {
		const {
			init,
			rows,
			cols,
			recording,
			recordingProgress,
			hud,
			controls,
			model,
			notification,
			inputDevices,
			inputDeviceId,
			inputNotAllowed,
			outputDevices,
			outputDeviceId,
			midiDevices,
			midiDeviceId,
			midiSupported,
			fullscreen,
			error,
			ios,
			saveDialog,
			newDialog,
			recordingDialog,
			helpDialog,
			masterstate,
			notsupported,
			sampling,
		} = this.state;

		if (notsupported) return <NotSupported />;

		const points = rows.map((row, rowidx) => {
			const columns = row.map((c, idx) => (
				<Column
					id={c.id}
					key={c.id}
					controls={controls}
					midiSupported={midiSupported}
					fullscreen={cols[c.id].fullscreen}
					sampling={sampling === c.id}
					isSampling={sampling}
					heat={cols[c.id].data && cols[c.id].data.heat}
					onActive={(active) => this.onActive(c.id, active)}
					onMove={(data) => this.onMove(data)}
					onUpload={(buffer, filename) => this.onUpload(c.id, buffer, filename)}
					onMultiUpload={(files) => this.onMultiUpload(c.id, files)}
					onPlay={(opt) => Global.engine.play(c.id, opt)}
					onPause={() => Global.engine.pause(c.id)}
					onStop={() => Global.engine.stop(c.id)}
					onSolo={(on) => Global.engine.solo(c.id, on, false)}
					onVolume={(vol) => this.onVolume(c.id, vol)}
					onRate={(rate) => this.onRate(c.id, rate)}
					onLoop={(on, offset) => this.onLoop(c.id, on, offset)}
					onMute={(on) => Global.engine.mute(c.id, on)}
					onSampleRecord={(on) => this.onSampleRecord(c.id, on)}
					onCancelSampleRecord={() => this.onCancelSampleRecord(c.id)}
					onMetronome={() => Global.engine.metronome()}
					onEffectBypass={(type, active) => this.onEffectBypass(c.id, type, active)}
					onEffectParams={(type, params) => this.onEffectParams(c.id, type, params)}
					onDownload={() => this.onDownloadSample(c.id)}
					onLocked={(on) => this.onLocked(c.id, on)}
					onMidiMapMode={(on, unmap) => this.onMidiMapMode(c.id, on, unmap)}
					onReverse={(on) => this.onReverse(c.id, on)}
					onEffectsEnabled={(on) => this.onEffectsEnabled(c.id, on)}
					onFullscreen={(on) => this.onColumnFullscreen(c.id, on)}
				/>
			));
			return (
				<div key={"r" + rowidx} className={"sound-canvas-row"}>
					{columns}
				</div>
			);
		});

		return (
			<div id="container">
				<Home
					init={init}
					inputDevices={inputDevices}
					inputDeviceId={inputDeviceId}
					midiDeviceId={midiDeviceId}
					midiDevices={midiDevices}
					midiSupported={midiSupported}
					onRequestInput={() => this.onRequestInput()}
					onStart={() => this.onStart()}
					inputNotAllowed={inputNotAllowed}
					onDeviceChange={(deviceId) => this.onDeviceChange(deviceId)}
					onMidiDeviceChange={(deviceId) => this.onMidiDeviceChange(deviceId)}
				/>
				{isElectron() && !fullscreen && <TitleBar title={"purplepurples"} />}
				<form
					ref={this.fileUploaderFormRef}
					style={{ display: "none" }}
					onSubmit={(e) => this.onUploadModelFromFile(e)}
				>
					 
					<input
						type="file"
						id="upload"
						accept={"application/zip"}
						ref={this.fileUploaderRef}
						style={{ display: "none" }}
					/>
				</form>
				{error && (
					<div id={"error"}>
						<div id={"error-box"}>
							<div id={"error-header"}>Error</div>
							<div id={"error-message"}>{error.toString()}</div>
							<div id={"error-buttons"}>
								<button onClick={() => this.onErrorClose()}>Close</button>
							</div>
						</div>
					</div>
				)}
				{notification && (
					<div id={"notification"} onMouseMove={(e) => e.stopPropagation()}>
						<div id={"notification-box"}>
							<div>{notification.message}</div>
							{notification.description && <div>{notification.description}</div>}
							{notification.loading && (
								<div id="notification-loading">
									<AiOutlineLoading />
								</div>
							)}
							{notification.close && (
								<div id="notification-close">
									<button onClick={() => this.onCancelEncodeAudio()}>Cancel</button>
								</div>
							)}
						</div>
					</div>
				)}

				<div
					ref={this.canvasRef}
					id={"sound-canvas"}
					onTouchMove={(e) => this.onSwipe(e)}
					onMouseMove={(e) => {
						if (!ios) this.onMouseMove(e);
					}}
				>
					{points}
					{recording && <div id={"sound-canvas-rec"}>{recording ? "[REC]" : ""}</div>}
					{saveDialog && (
						<SaveDialog
							model={model}
							onSubmit={(model) => this.saveModel(model)}
							onClose={() => this.onToggleSave()}
						/>
					)}
					{newDialog && (
						<NewDialog
							model={model}
							onSubmit={(model, cols, row) => this.createModel(model, cols, row)}
							onClose={() => this.onToggleNewSet()}
						/>
					)}
					{helpDialog && <HelpDialog model={model} onClose={() => this.onToggleHelp()} />}
					<RecordingsDialog
						recordings={this.recordings}
						show={recordingDialog}
						onDeleteRecording={(id) => this.onDeleteRecording(id)}
						onDownload={(id, type) => this.onDownload(id, type)}
						onClose={() => this.onToggleRecordings(false)}
					/>
				</div>
				<Controls
					init={init}
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
					models={this.models}
					recording={masterstate.recording}
					recordings={this.recordings}
					recordingProgress={recordingProgress}
					showRecordings={recordingDialog}
					showHelp={helpDialog}
					inputDevices={inputDevices}
					outputDevices={outputDevices}
					inputDeviceId={inputDeviceId}
					outputDeviceId={outputDeviceId}
					midiDevices={midiDevices}
					midiDeviceId={midiDeviceId}
					fullscreen={fullscreen}
					controls={controls}
					midiSupported={midiSupported}
					onRequestInput={() => this.onRequestInput()}
					onFullscreen={(on) => this.onFullscreen(on)}
					onLoadModel={(model, opt) => this.onLoadModel(model, opt)}
					onVolume={(vol) => Global.engine.master.volume(vol)}
					onMute={(on) => Global.engine.master.mute(on)}
					onLoop={(on) => Global.engine.master.loop(on)}
					onPlay={() => Global.engine.master.play()}
					onPause={(on) => this.onPause(on)}
					onStop={() => Global.engine.master.stop()}
					onLocked={(on) => this.onLockedAll(on)}
					onRecord={(on) => this.onRecord(on)}
					onDeviceChange={(deviceId) => this.onDeviceChange(deviceId)}
					onOutputDeviceChange={(deviceId) => this.onOutputDeviceChange(deviceId)}
					onMidiDeviceChange={(midiDeviceId) => this.onMidiDeviceChange(midiDeviceId)}
					onControls={(active) => this.onControls(active)}
					onSave={() => this.onToggleSave()}
					onLoad={() => this.onUploadModelFromFile()}
					onToggleNewSet={() => this.onToggleNewSet()}
					onToggleRecordings={() => this.onToggleRecordings()}
					onToggleHelp={() => this.onToggleHelp()}
				/>
			</div>
		);
	}
	randomValues() {
		Global.engine.master.stop();

		this.randomRates();
		this.randomMutes();
		this.randomVolumes();
		this.randomPans();
		this.randomLoops();
		this.randomReverse();
		//Global.engine.master.locked(true)
		Global.engine.master.play();
	}
	randomRates() {
		Object.keys(this.state.cols).forEach((k) => {
			const channel = this.state.cols[k];
			const rand = Math.random() * (1.0 - 0.0) + 0.0;
			Global.engine.rate(channel.id, rand);
		});
	}
	randomMutes() {
		Object.keys(this.state.cols).forEach((k) => {
			const channel = this.state.cols[k];
			const rand = Math.random() * (1 - 0.0) + 0.0;
			Global.engine.mute(channel.id, rand > 0.5);
		});
	}
	randomVolumes() {
		Object.keys(this.state.cols).forEach((k) => {
			const channel = this.state.cols[k];
			const rand = Math.random() * (1 - 0.0) + 0.0;
			Global.engine.volume(channel.id, rand);
		});
	}
	randomPans() {
		Object.keys(this.state.cols).forEach((k) => {
			const channel = this.state.cols[k];
			const rand = Math.random() * (180 - 0.0) + 0.0;
			Global.engine.pan(channel.id, rand - 90);
		});
	}
	randomLoops() {
		Global.engine.sounds.forEach((s) => {
			const sound = s.sound;
			const start = Math.random() * (sound._duration - 0.0) + 0.0;
			const end = Math.random() * (sound._duration - start - 0.0) + 0.0;
			const rand = parseInt(Math.random() * (2 - 0) + 0);
			Global.engine.loop(s.id, true, { start: start, end: end });
			if (rand) sound._loop = true;
			else sound._loop = false;
		});
	}
	randomReverse() {
		Global.engine.sounds.forEach((s) => {
			const sound = s.sound;
			const rand = parseInt(Math.random() * (2 - 0) + 0);
			if (rand) Global.engine.reverse(s.id, true);
		});
	}
}

export default PurplePurples;
