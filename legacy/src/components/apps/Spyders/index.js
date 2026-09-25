import Global from "../../../Global";
import React, { Component } from "react";
import "./index.css";
import AudioEngine from "../../../services/AudioEngine";
import FrequencyVisualizer from "../../visualizers/FrequencyVisualizer";
import VolumeVisualizer from "../../visualizers/VolumeVisualizer";
import OscilloscopeVisualizer from "../../visualizers/OscilloscopeVisualizer";
import FileUploader from "../../util/FileUploader";
import Waveform from "../../util/Waveform";
import Select from "../../util/Select";
import Switch from "react-switch";
import isElectron from "is-electron";

const IS_ELECTRON = isElectron();

class Spyders extends Component {
	constructor(props) {
		super(props);

		this.state = {
			inputDevices: [],
			midiDevices: [],
			inputDeviceId: 0,
			midiSupported: false,
			ready: false,
			loading: false,
			volume: 0.5,
			playing: false,
			playId: null,
			sampling: false,
			recording: false,
			duration: 0,
			waveformData: [],
			waveformLength: 0,
			selectedId: -1,
			config: {
				levelCheck: 50,
				recCheck: 300,
				threshold: -58,
			},
			waves: [],
		};
		this.levels = [];
		this.id = 0;
		this.lastCheck = null;
		this.recording = false;
		this.recordings = [];
		this.analyser = null;
		Global.engine = new AudioEngine({
			channels: 2,
			volume: 0.5,
			electron: IS_ELECTRON,
			enableAnalysers: true,
			//enableElapsed:true,
			//enableLoops:true,
			processSample: {
				trim: { level: 0.1, trimLeft: true, trimRight: true },
				normalize: false,
			},
		});

		Global.engine.on("masterstate", (state, updated) => {
			this.setState({
				playing: updated.playing !== undefined ? updated.playing : this.state.playing,
				volume: state.volume,
			});
		});
		Global.engine.on("sampling", (id, on) => {
			this.setState({ sampling: on });
		});
		Global.engine.on("samplingprogress", (id, prog) => {
			//this.setState({elapsed:prog.elapsed.toFixed(0)})
		});
		Global.engine.on("inputdevices", (devices) => {
			this.setState({ inputDevices: devices });
		});
		Global.engine.on("mididevices", (devices) => {
			this.setState({ midiDevices: devices });
		});
	}
	setConfig(key, val) {
		const { config } = this.state;
		config[key] = val;
		this.setState({ config });
	}
	initAnalyser() {
		this.log("INIT ANALYSER");
		this.analyser = Global.engine.analyse("input", "volume");
		this.analyser.addEventListener("volume", { fftSize: 32, interval: 50 }, (volume) => {
			//this.log('.')
			if (this.lastCheck === null) this.lastCheck = Date.now();
			this.levels.push(volume);
			if (
				Date.now() - this.lastCheck >
				(this.recording ? this.state.config.recCheck : this.state.config.levelCheck)
			) {
				const avg = this.levels.reduce((a, b) => a + b) / this.levels.length;
				this.levels = [];
				this.lastCheck = Date.now();
				const threshold = 100 + parseInt((this.state.config.threshold / 60) * 100);
				if (!this.recording && avg > threshold) {
					this.startTime = Date.now() - this.state.config.levelCheck;
					this.recording = true;
					this.setState({ recording: true });
					this.log("innputcheck");
				} else if (this.recording && avg < threshold) {
					this.endTime = Date.now() - this.state.config.recCheck + 500;
					this.recording = false;
					this.setState({ recording: false });
					this.log("reccheck");
					this.stopRecord();
				}
			}
		});
	}
	async loopRecorder() {
		if (this.running) return console.error("alrady running");
		this.log("######### START LOOP REC ###########");
		this.running = true;

		this.analyser.unpause();
		try {
			for (var i = 0; !this.stopped; i++) await this.record();
		} catch (err) {
			console.error("SpyderLog", err);
		}
		this.running = false;
		this.analyser.pause();
		this.log("######### FINISHED LOOP REC ###########");
	}
	async record() {
		this.log("######### REC ###########@");
		this.analyser.unpause();
		return new Promise(async (resolve, reject) => {
			const id = "spyder" + ++this.id;
			Global.engine.add(id, null, null);

			let recording = null;
			try {
				recording = await Global.engine.sample(id, true);
			} catch (err) {
				console.error(err);
				return reject(err);
			}
			if (this.stopped || !recording) return reject();
			this.log("------------------- DONE REC ------");
			this.recordings.push(recording);
			Global.engine.once("load", () => {
				const duration = Global.engine.duration(id);
				console.log("load", duration);
				this.setState(
					{ duration: duration, waves: this.state.waves.concat({ id, duration }) },
					() => {
						this.setupWave(id);
						resolve();
					}
				);
			});
		});
	}
	stopRecord() {
		this.log("STOP REC");
		this.analyser.pause();
		Global.engine.sample("spyder" + this.id, false);
	}
	cancelRecord() {
		this.log("CANCEL REC");
		this.analyser.pause();
		Global.engine.cancelSample("spyder" + this.id);
	}
	setupWave(id) {
		Global.engine.on("state" + id, (state) => {
			const waves = this.state.waves.map((wave) => {
				return wave.id === id ? (wave = { ...state }) : wave;
			});
			this.setState({ waves, playId: id });
		});
	}
	toggle(on) {
		this.log("TOGGLE", on);
		if (on === true) {
			this.stopped = false;
			Global.engine.master.stop();
			//this.setState({playing:false, playId:null})
			this.loopRecorder();
		} else if (on === false) {
			this.stopped = true;
			this.cancelRecord();
		}
	}
	clear() {
		this.toggle(false);
		this.state.waves.forEach((wave) => {
			Global.engine.remove(wave.id);
		});
		Global.engine.master.stop();
		this.setState({ waves: [], playId: null, playing: false });
	}
	padClick(e, id, down) {
		e.stopPropagation();
		if (Global.engine.loop(id)) {
			Global.engine.loop(id, false);
			Global.engine.stop(id);
		} else {
			this.cancelRecord();
			Global.engine.loop(id, true);
			Global.engine.play(id);
		}

		this.setState({ selectedId: id });
	}
	componentDidMount() {
		this.init();
	}
	componentWillUnmount() {
		this.props.onQuit();
	}
	log(m1, m2, m3, m4, m5) {
		const args = [m1, m2, m3, m4, m5];
		console.log("SpyderLog: " + args.join(" "));
	}

	init() {
		this.setState({ init: false });

		const lastInputDevice = localStorage.getItem("lastInputDevice");
		const lastMidiDevice = localStorage.getItem("lastMidiDevice");

		Global.engine
			.init(lastInputDevice, lastMidiDevice)
			.then((info) => {
				if (info.devices) {
					const device =
						info.devices.filter((d) => d.deviceId === lastInputDevice)[0] ||
						info.devices.filter((d) => d.label.toLowerCase().includes("microphone"))[0] ||
						info.devices[0];
					this.setState({ inputDeviceId: device.deviceId, inputDevices: info.devices });
				}
				this.setState({ init: true });
				this.initAnalyser();
				this.loopRecorder();
			})
			.catch((err) => {
				this.handleError(err);
			});

		Global.engine
			.initMidi()
			.then((devices) => {
				const device = devices.filter((d) => d.deviceId === lastMidiDevice)[0] || devices[0];
				this.onMidiDeviceChange(device.deviceId);
				this.setState({ midiDevices: devices, midiSupported: true });
			})
			.catch((err) => {
				this.log("MIDI NOT AVAILABLE");
				this.setState({ midiSupported: false });
			});
		this.initKeyboard();
	}

	initKeyboard() {
		document.body.addEventListener("keydown", (e) => {
			const key = e.key;
			if (e.target.tagName === "INPUT") return;

			switch (key) {
				case " ":
					this.toggle();
					break;
				default:
					break;
			}
		});
	}
	async sleep(ms) {
		return new Promise((resolve, rekect) => {
			setTimeout(() => resolve(), ms);
		});
	}

	onDeviceChange(inputDeviceId) {
		this.log("change device", inputDeviceId);
		Global.engine
			.initInputSource(inputDeviceId)
			.then((inputSource) => {
				localStorage.setItem("lastInputDevice", inputDeviceId);
				this.setState({ inputDeviceId });
			})
			.catch((err) => this.handleError(err));
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
	handleError(err) {
		console.error(err);
	}
	handleSelection(id, sel) {
		if (sel.start == 0 && sel.end === 0) return Global.engine.loop(id, false);

		Global.engine.loop(id, true, sel);
		Global.engine.play(id);
		//this.pause(true)
	}
	handleSelectionStart() {
		this.log("start selection");
		//this.pause(true)
	}
	handleSelectionChange(sel) {
		return;
		Global.engine.stop("spyder");
		Global.engine.loop("spyder", true, sel);
		Global.engine.play("spyder");
	}
	onUpload(buffer, filename) {
		const objURL = URL.createObjectURL(new Blob([buffer]), {
			type: Global.fileToMimeType(filename),
		});
		Global.engine.replace("spyder", objURL, filename);
	}

	render() {
		const {
			init,
			sampling,
			duration,
			playing,
			recording,
			inputDeviceId,
			inputDevices,
			playId,
			selectedId,
			waves,
			config,
		} = this.state;
		const background = playing
			? "spyder-playing"
			: sampling
			? "spyder-recording"
			: "spyder-waiting";

		return (
			<div id={"spyder-container"} className={background}>
				<div className={"spyder-input-middle"}>
					<div className={"spyder-freq"}>
						{!playing && (
							<OscilloscopeVisualizer
								id={"input"}
								color={recording ? "rgb(255, 0, 0)" : "rgb(140, 138, 138)"}
								ready={init}
								options={{ fftSize: 1024 }}
							/>
						)}
						{playing && (
							<FrequencyVisualizer
								id={"master"}
								color={"rgb(255, 31, 31)"}
								ready={init}
								options={{ fftSize: 1024 }}
							/>
						)}
					</div>
					<div className={"spyder-waveform"}>
						{playId ? (
							<Waveform
								id={playId}
								key={playId}
								spp={100}
								bits={8}
								duration={Global.engine.duration(playId)}
								loop={Global.engine.loop(playId)}
								loopEnd={Global.engine.loopEnd(playId)}
								loopStart={Global.engine.loopStart(playId)}
								moveWithoutModifier={true}
								color={"rgb(255, 31, 31)"}
								bgcolor={"rgba(255, 31, 31,0.2)"}
								onSelection={(selection) => this.handleSelection(playId, selection)}
								onSelectionStart={() => this.handleSelectionStart()}
								onSelectionChange={(selection) => this.handleSelectionChange(playId, selection)}
							/>
						) : (
							<div id={"spyder-emptywave"}></div>
						)}
					</div>
					<div id={"spyder-pads"}>
						{waves.map((wave, idx) => (
							<div
								key={idx}
								className={wave.loop && wave.playing ? "spyder-pad-loop" : "spyder-pad"}
								style={{
									border:
										"1px solid " +
										(selectedId === wave.id ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.0)"),
								}}
								onClick={(e) => this.padClick(e, wave.id, true)}
							>
								<Waveform
									id={wave.id}
									key={"k" + wave.id}
									spp={100}
									bits={8}
									duration={wave.duration}
									disabled={true}
									color={"rgb(255, 31, 31)"}
									bgcolor={"rgba(255, 31, 31,0.2)"}
								/>
							</div>
						))}
					</div>
				</div>
				<div className={"spyder-input-volume"}>
					<VolumeVisualizer
						id={"input"}
						numChannels={2}
						color={"rgb(255, 31, 31, 0.4)"}
						ready={true}
					/>

					<div className={"spyder-input-db"}>
						{new Array(60).fill(0).map((e, i) => (
							<div></div>
						))}
					</div>
					<div className={"spyder-input-db-labels"}>
						{[0, 10, 20, 30, 40, 50, 60].map((e, i) => (
							<div
								style={{
									top: e === 0 ? 0 : e === 60 ? "unset" : `calc(${e * 2}% - 10px)`,
									bottom: e === 60 ? 0 : "unset",
								}}
							>
								-{e}
							</div>
						))}
					</div>
				</div>
				<div className={"spyder-input-config"}>
					<div className={"spyder-slider-config"}>
						<div>Threshold</div>
						<div>
							<input
								type="range"
								min="-60"
								max="0"
								value={config.threshold}
								reverse={"true"}
								onChange={(e) => this.setConfig("threshold", parseInt(e.target.value))}
							/>
						</div>
						<div>{config.threshold} db</div>
					</div>
					<div className={"spyder-slider-config"}>
						<div>Silence start</div>
						<div>
							<input
								type="range"
								min="0"
								max="2000"
								value={config.levelCheck}
								reverse={"true"}
								onChange={(e) => this.setConfig("levelCheck", parseInt(e.target.value))}
							/>
						</div>
						<div>{config.levelCheck} ms</div>
					</div>
					<div className={"spyder-slider-config"}>
						<div>Silence end</div>
						<div>
							<input
								type="range"
								min="0"
								max="5000"
								value={config.recCheck}
								reverse={"true"}
								onChange={(e) => this.setConfig("recCheck", parseInt(e.target.value))}
							/>
						</div>
						<div>{config.recCheck} ms</div>
					</div>
					<div
						className={sampling ? "spyder-stop" : "spyder-start"}
						onClick={() => this.toggle(!sampling)}
					>
						{sampling ? "STOP" : "START"}
					</div>
					<div className={"spyder-button"} onClick={() => this.clear()}>
						{"CLEAR"}
					</div>
				</div>
				<div className={"spyder-input-bottom"}>
					<Select
						value={inputDeviceId}
						options={inputDevices.map((d) => {
							return { value: d.deviceId, label: d.label };
						})}
						center={true}
						direction={"up"}
						onChange={(val) => this.onDeviceChange(val)}
					/>
				</div>
			</div>
		);
	}
}

export default Spyders;
