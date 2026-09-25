// @ts-nocheck
//import { AudioContext, OfflineAudioContext } from 'standardized-audio-context';
import Global from '../Global';
import Master from './Master';
import AudioUtils from './utils';
import Sound from './Sound';
import { WebMidi } from 'webmidi';
import { createEncoderWorker } from './workers';
import Recorder from './Recorder';
import Analyser from './Analyser';
import extractPeaks from 'webaudio-peaks';
import moment from 'moment';
import { EFFECTS, createEffect } from './effects';
import { ensureEffectsWorklet } from './effects/worklet';
import BPM from 'bpm';
import { EventEmitter } from 'events';

class AudioEngine extends EventEmitter {
	constructor(
		opt = {
			channels: 2,
			volume: 0.2,
			electron: false,
			enableAnalysers: false,
			enableLoops: false,
			enableElapsed: false,
			processSample: false,
		},
	) {
		super(opt);
		this.context = new AudioContext();
		//this.clock = new WAAClock(this.context)
		this.sampleRate = this.context.sampleRate;
		this.enableAnalysers = opt.enableAnalysers;
		this.enableLoops = opt.enableLoops;
		this.enableElapsed = opt.enableElapsed;
		this.processSample = opt.processSample;
		this.utils = AudioUtils;
		this.sounds = [];
		this.soundMap = {};
		this.midiMap = {};
		this.meters = {};
		this.analysers = [];
		this._volume = opt.volume;

		this.channels = opt.channels;
		this.electron = opt.electron;
		this.bpmCounter = new BPM();

		this.effects = EFFECTS;
		this.EFFECTS = EFFECTS;
		this.inputStream = null;
		this.inputStreamSource = null;
		this.inputMeter = null;
		this.outputStream = null;
		this.recordingId = 0;
		this.trimThreshold = 0.05;
		this.onMidiNoteOn = this.onMidiNoteOn.bind(this);
		this.onMidiNoteOff = this.onMidiNoteOff.bind(this);
		this.masterGain = this.context.createGain();
		this.masterGain.gain.value = this._volume;
		this.masterGain.connect(this.context.destination);
		this.outputAnalyser = new Analyser('output', this.context, this.masterGain);
		this.inputAnalyser = null;

		this.masterRecorder = new Recorder(this.context, {
			numChannels: 2,
			sampleRate: this.sampleRate,
			sampler: false,
		})
			.on('recording', (on) => {
				this.emitMasterState({
					recording: on,
				});
				this.emit('recording', on);
			})
			.on('progress', (prog) => {
				this.emit('recordingprogress', prog);
			});
		this.sampleRecorder = new Recorder(this.context, {
			numChannels: 2,
			sampleRate: this.sampleRate,
			sampler: true,
			processSample: this.processSample || false,
		})
			.on('sampling', (id, on) => {
				this.emitMasterState({
					sampling: on,
				});
				this.get(id).sound.sampling(on);
				this.emit('sampling', id, on);
			})
			.on('processing', (on) => {
				//this.emitMasterState({sampling:on})
			})
			.on('progress', (id, prog) => {
				this.emit('samplingprogress', id, prog);
				//this.emitMasterState({sampling:on})
			});

		this.master = new Master(this, this._volume);

		// Effects run on an AudioWorklet: register their processors early so
		// the first addEffect() (even during model load) can create a node
		// without waiting for a lazy module load.
		ensureEffectsWorklet(this.context);

		navigator.mediaDevices.addEventListener('devicechange', (event) => {
			console.log('DEVICECHNAGE', event);
			this.listDevices().then((devices) => {
				this.emit('inputdevices', devices);
			});
		});
	}
	emitMasterState(opt = {}) {
		if (!Object.keys(opt).length) return;
		this.master.state = { ...this.master.state, ...opt };
		this.emit('masterstate', this.master.state, opt);
	}
	init(lastInput, lastMidiInput) {
		return new Promise((resolve, reject) => {
			return this.initInputDevices(lastInput, lastMidiInput)
				.then((devices) => {
					resolve(devices);
					this.emit('masterstate', this.master.state);
				})
				.catch((err) => reject(err));
		});
	}
	initInputDevices(lastDeviceId) {
		if (!navigator.mediaDevices) return Promise.reject('NOTSUPPORTED');

		const baseConstraints = {
			audio: {
				autoGainControl: false,
				echoCancellation: false,
				noiseSuppression: false,
				sampleSize: 512,
			},
		};
		let constraints = {
			audio: {
				autoGainControl: false,
				echoCancellation: false,
				noiseSuppression: false,
				sampleSize: 512,
			},
		};

		if (lastDeviceId) constraints.audio.deviceId = { exact: lastDeviceId };

		return new Promise((resolve, reject) => {
			navigator.mediaDevices
				.getUserMedia(constraints)
				.then((stream) => {
					return this.listDevices().then((devices) => {
						const label = stream.getTracks()[0].label;
						const device = devices.filter((d) => d.label === label)[0];
						this.createInputSource(stream, device.deviceId);
						resolve({
							devices,
							selected: device.deviceId,
						});
					});
				})
				.catch((err) => {
					const notAllowed =
						err.toString().toLowerCase().indexOf('permission denied') > -1 ||
						err.name === 'NotAllowedError' ||
						err.name === 'OverconstrainedError';
					if (notAllowed) {
						navigator.mediaDevices
							.getUserMedia(baseConstraints)
							.then((stream) => {
								const label = stream.getTracks()[0].label;
								return this.listDevices().then((devices) => {
									const deviceId = devices.filter((d) => d.label === label)[0].deviceId;
									this.createInputSource(stream, deviceId);
									resolve({
										devices,
										selected: deviceId,
									});
								});
							})
							.catch((err) => {
								const notAllowed =
									err.toString().toLowerCase().indexOf('permission denied') > -1 ||
									err.name === 'NotAllowedError';
								reject(notAllowed ? 'NOTALLOWED' : err);
							});
					} else reject(err);
				});
		});
	}
	listDevices() {
		return new Promise((resolve, reject) => {
			navigator.mediaDevices
				.enumerateDevices()
				.then((devices) => {
					this.inputDevices = devices
						.filter((d) => d.kind === 'audioinput')
						.map((d) => {
							return {
								deviceId: d.deviceId,
								groupId: d.groupId,
								kind: d.kind,
								label: d.label,
							};
						});
					console.log('AVAILABLE INPUT DEVICES', this.inputDevices);
					this.emit('inputdevices', this.inputDevices);
					resolve(this.inputDevices);
				})
				.catch((err) => reject(err));
		});
	}
	initInputSource(deviceId) {
		const device = this.inputDevices.filter((i) => i.deviceId === deviceId)[0];
		this.closeInputStream();
		return new Promise((resolve, reject) => {
			navigator.mediaDevices
				.getUserMedia({
					audio: {
						deviceId: {
							exact: deviceId,
						},
					},
				})
				.then((stream) => {
					this.createInputSource(stream, deviceId);
					resolve();
				})
				.catch((err) => reject(err));
		});
	}
	createInputSource(stream, deviceId) {
		const analyserEnabled = this.analysers.input && this.analysers.input.connected;
		this.closeInputStream();

		const device = this.inputDevices.filter((i) => i.deviceId === deviceId)[0];
		this.inputStream = stream;
		this.inputStreamSource = this.context.createMediaStreamSource(this.inputStream);
		if (!this.inputAnalyser)
			this.inputAnalyser = new Analyser('input', this.context, this.inputStreamSource);
		else this.inputAnalyser.setNode(this.inputStreamSource);
		this.inputDeviceId = deviceId;
		localStorage.setItem('lastInputDevice', deviceId);
		console.log('INIT INPUT SOURCE', device.label);
	}
	closeInputStream() {
		if (this.inputStream) this.inputStream.getAudioTracks().forEach((t) => t.stop());
	}
	initInput(label) {
		const device = this.inputDevices.filter(
			(d) => d.label.toLowerCase().indexOf(label.toLowerCase()) > -1,
		)[0];
		if (device) this.initInputSource(device.deviceId);
	}
	createSound(id, url, filename, opt = {}) {
		const sound = new Sound(id, url, this, {
			filename: filename,
			local: this.electron,
			enableLoops: this.enableLoops,
			enableAnalyser: this.enableAnalyser,
			enableElapsed: this.enableElapsed,
			...opt,
		});
		sound.on('state', (state, updated) => {
			this.emit('state' + id, state, updated);
		});
		sound.on('state' + id, (state, updated) => {
			this.emit('state' + id, state, updated);
		});
		sound.on('effectparams', (id, type, opt) => {
			this.emit('effectparams', id, type, opt);
		});
		sound.on('load', () => {
			console.log('loaded sound', id);
			this.onLoad(id);
			this.master._updateDuration();
		});
		sound.on('change', () => {
			console.log('sound updated', id);
			this.emit('change' + id, sound.duration());
			this.emit('change', id, sound.duration());
			this.master._updateDuration();
		});

		sound.on('ready', (id) => {
			const status = {
				total: this.sounds.length,
				ready: this.ready(),
			};
			this.emit('ready', id, status);
		});
		sound.on('rate', () => {
			if (this.enableElapsedd) this.master._updateDuration();
		});
		sound.on('playing', () => {
			const isPlaying = this.master.isPlaying();
			this.emitMasterState({
				playing: isPlaying,
			});
			isPlaying ? this.outputAnalyser.unpause() : this.outputAnalyser.pause();
		});
		sound.on('stop', () => {
			const isPlaying = this.master.isPlaying();
			this.emitMasterState({
				playing: this.master.isPlaying(),
			});
			isPlaying ? this.outputAnalyser.unpause() : this.outputAnalyser.pause();
		});
		sound.on('elapsed', (elapsed) => {
			this.emit('elapsed' + id, elapsed);
		});
		sound.on('muted', (on) => {});
		sound.on('loopend', (on) => {
			this.emit('loopend' + id, on);
		});
		sound.on('loaderror', (err) => {
			this.emit('loaderror', err, id);
			this.onLoad(id, url);
		});
		sound.on('loop', (on) => {
			this.emit('loop', id, on);
			this.emit('loop' + id, {
				loop: on,
				loopStart: sound._loopStart,
				loopEnd: sound._loopEnd,
			});
			this.master._updateDuration();
		});
		sound.on('ended', () => {
			this.emit('ended', sound.id);
			this.emit('ended' + sound.id);
			const isPlaying = this.master.isPlaying();
			this.emitMasterState({
				playing: isPlaying,
			});
			isPlaying ? this.outputAnalyser.unpause() : this.outputAnalyser.pause();
		});
		sound.on('solo', (on) => {
			this.emit('solo', sound.id, on);
			this.emitMasterState({
				solo: this.master.solo(),
			});
		});
		this.emit('create', id, sound);
		return sound;
	}
	add(id, url, filename, opt) {
		if (this.soundMap[id]) throw new Error('ID ' + id + ' already exists');

		const sound = this.createSound(id, url, filename, opt);
		const item = {
			id: id,
			url: url,
			filename: filename,
			sound: sound,
		};
		this.sounds.push(item);
		this.soundMap[id] = item;
		this.emit('add', item.sound.id, item.sound);
		sound.emitState('add', id);
		console.log('add sound', id);
		return item;
	}
	remove(id) {
		console.log('remove sound', id);
		const item = this.soundMap[id];
		if (!item) return;
		item.sound.destroy();
		delete this.soundMap[id];
		this.sounds = this.sounds.filter((s) => s.id !== id);
		this.emit('remove', id);
	}
	removeAll() {
		this.sounds.forEach((s) => this.remove(s.id));
	}
	replace(id, url, filename) {
		this.unload(id);
		const has = this.sounds.some((i) => i.id === id);
		if (!has) {
			// uploading into a column that has no sound yet → create it
			this.add(id, url, filename);
			return;
		}
		const sounds = this.sounds.map((i, idx) => {
			if (i.id === id) {
				console.log('replace sound', id, idx);
				const effectParams = i.sound._currentEffectParams();
				i.sound = this.createSound(id, url, filename, i.sound.getSaveState());
				i.sound.load();
				if (effectParams && effectParams.length)
					effectParams.forEach((e) => this.addEffect(id, e.type, !e.bypassed, e.params));
			}
			return i;
		});
		this.sounds = sounds;
	}
	copy(id, newId, opt = {}) {
		const sound = this.get(id).sound;
		const buffer = sound.buffer;
		let data =
			buffer.numberOfChannels === 1
				? [buffer.getChannelData(0)]
				: [buffer.getChannelData(0), buffer.getChannelData(1)];

		if (opt.start || opt.end) {
			const start = parseInt(opt.start * this.sampleRate);
			const end = parseInt(end * this.sampleRate);
			const length = data[0].length;
			const cropped = AudioUtils.slice(data, start, end > length - 1 ? length - 1 : end);
			const copy = new AudioBuffer({
				length: cropped[0].length,
				numberOfChannels: buffer.length,
				sampleRate: this.sampleRate,
			});
			cropped.forEach((channelData, idx) => {
				copy.copyToChannel(channelData, idx);
			});
			data = cropped;
		}
		const objURL = URL.createObjectURL(new Blob([data], { type: sound._mimeType }));
		const newSound = this.add(newId, objURL, sound._filename);
		return newSound;
	}
	exist(id) {
		return this.soundMap[id] !== undefined;
	}
	reset(id) {
		this.get(id).sound.reset();
	}
	ready() {
		return this.sounds.filter((s) => s.sound._ready).length;
	}
	load(id) {
		if (id) this.get(id).sound.load();
		else this.get().forEach((s) => s.sound.load());
	}
	soundForEach(id, fn) {
		if (id) {
			const item = this.soundMap[id];
			if (item) fn(item.sound, id);
		} else {
			this.get().forEach((item) => fn(item.sound, item.id));
		}
	}
	unload(id) {
		if (!id) return this.get().forEach((s) => this.unload(s.id));

		const s = this.soundMap[id];
		if (!s) return;
		if (s.sound.source) this.stop(id);

		URL.revokeObjectURL(s.url);
		s.sound.buffer = null;
		s.sound._buffer = null;
		s.sound.source = null;
	}
	play(id, opt) {
		this.soundForEach(id, (sound) => sound.play(opt));
	}
	stop(id) {
		this.soundForEach(id, (sound) => sound.stop());
	}
	pause(id, on) {
		if (id) {
			return this.get(id).sound.pause(on);
		}
		this.get().forEach((s) => s.sound.pause(on));
		return on;
	}
	unpause(id) {
		this.soundForEach(id, (sound) => sound.unpause());
	}
	loop(id, on, offset) {
		if (id) {
			return this.get(id).sound.loop(on, offset);
		} else {
			this.sounds.forEach((s) => {
				s.sound.loop(on, offset);
				if (!on) this.stop(s.id);
			});
		}
	}
	loopStart(id, offset) {
		return this.get(id).sound._loopStart;
	}
	loopEnd(id, offset) {
		return this.get(id).sound._loopEnd;
	}
	volume(id, vol) {
		if (vol === undefined) {
			const s = this._sound(id);
			return s ? s.volume() : undefined;
		}
		if (!Number.isFinite(vol)) return;

		if (id) {
			const s = this._sound(id);
			if (s && !s._muted) s.volume(vol);
		} else {
			this.get().forEach((s) => {
				if (!s.sound._muted) s.sound.volume(vol);
			});
		}
	}
	gain(id, gain) {
		if (id) {
			const s = this._sound(id);
			return s && s.gain(gain);
		}
		this.get().forEach((s) => s.sound.gain(gain));
	}
	rate(id, rate) {
		this.soundForEach(id, (sound) => sound.rate(rate));
	}
	pitch(id, pitch) {
		this.soundForEach(id, (sound) => sound.pitch(pitch));
	}
	mute(id, on = true) {
		this.soundForEach(id, (sound) => sound.mute(on));
	}

	unmute(id) {
		this.soundForEach(id, (sound) => sound.unmute(false));
	}
	pan(id, deg) {
		const s = this._sound(id);
		return s ? s.pan(deg) : undefined;
	}
	duration(id) {
		return this.get(id).sound._duration;
	}
	jump(id, sec) {
		return this.get(id).sound.jump(sec);
	}
	solo(id, on, multi = true) {
		this.sounds.forEach((s) => {
			if (s.id === id) s.sound.solo(on, false);
			else s.sound.solo(multi ? s.sound._solo : false, multi ? !s.sound._solo : on);
		});
	}
	lock(id, on) {
		if (id) {
			const s = this._sound(id);
			return s ? s.lock(on) : undefined;
		}
		this.get().forEach((s) => s.sound.lock(on));
	}
	reverse(id, on) {
		this.get(id).sound.reverse(on);
	}
	crop(id, start, end) {
		this.get(id).sound.crop(start, end);
	}
	playing(id) {
		return this.get(id).sound._playing;
	}
	toggleplay(id) {
		if (id) this.get(id).playing() ? this.pause(id) : this.play(id);
		else
			this.get().forEach((s) => {
				if (s.playing()) this.pause(id);
				else this.play(s.id);
			});
	}
	togglemute(id) {
		if (id) this.get(id).mute() ? this.mute(id) : this.unmute(id);
		else
			this.get().forEach((s) => {
				if (s.sound.mute()) this.unmute(id);
				else this.mute(s.id);
			});
	}
	onLoad(id) {
		this.emit('load', id);
		this.emit('load' + id, id, true);
	}
	onUnload(id, url) {
		this.emit('unloaded', id);
		if (this.sounds.filter((s) => !s.loaded).length) this.emit('unloadedall', true);
	}
	onPlay(id) {
		this.emit('playing', id);
	}
	onPause(id) {
		this.emit('pause', id);
	}
	onStop(id) {
		this.emit('stop', id);
	}
	onRate(id, rate) {
		this.emit('rate', id, rate);
	}
	onVolume(id, vol) {
		this.emit('volume', id, vol);
	}
	onEnd(id) {
		this.emit('loopend', id);
	}
	onError(id, err) {
		this.emit('error', err, id);
	}
	// safe per-id sound lookup — missing ids return undefined instead of throwing,
	// so id-based accessors can no-op on columns that have state but no sound
	_sound(id) {
		if (!id) return undefined;
		const item = this.soundMap[id];
		return item ? item.sound : undefined;
	}
	get(id) {
		if (!id) return this.sounds;
		if (!this.soundMap[id]) throw new Error("ID '" + id + "' doesn't exist!");

		return this.soundMap[id];
	}
	destroy(force) {
		console.log('DESTROY ENGINE');

		this.sounds.forEach((s) => s.sound.destroy());

		this.get().forEach((s) => {
			this.unload(s.id);
		});
		this.sounds = [];
		this.soundMap = {};
		this.destroyAnalysers();

		if (force) {
			if (this.masterRecorder) this.masterRecorder.destroy();
			if (this.sampleRecorder) this.sampleRecorder.destroy();

			try {
				WebMidi.disable();
			} catch (err) {}

			this.removeAllListeners();
			this.closeInputStream();
		}
	}

	async addEffect(id, type, bypass, opt) {
		const effect = await createEffect(type, this.context, opt);
		return this.get(id).sound.addEffect(type, effect, bypass);
	}
	removeEffect(id, idx) {
		return this.get(id).sound.removeEffect(idx);
	}
	moveEffect(id, idx, toIdx) {
		return this.get(id).sound.moveEffect(id, idx, toIdx);
	}
	effectBypass(id, idx, on) {
		return this.get(id).sound.effectBypass(idx, on);
	}
	effectParams(id, idx, params) {
		const s = this._sound(id);
		return s ? s.effectParams(idx, params) : undefined;
	}
	disableEffects(id) {
		return this.get(id).sound.disableEffects();
	}
	enableEffects(id) {
		return this.get(id).sound.enableEffects();
	}
	info() {
		const info = {};
		info.count = this.get().length;
		info.playing = this.sounds.filter((s) => s.sound._playing).length > 0;
		info.looping = this.sounds.filter((s) => s.sound._loop).length > 0;
		info.muted = this.sounds.filter((s) => s.sound._muted).length > 0;
		info.locked = this.sounds.filter((s) => s.sound._locked).length > 0;
		info.volume = this.masterGain.gain.value;
		info.pan = 0;
		info.rate = 1.0;
		return info;
	}

	playSound(url, opt = {}) {
		const sound = new Sound(Date.now(), url, this, {
			filename: 'Temp.wav',
			...opt,
		});
		/*
		this.masterGain = typeof this.context.createGain === 'undefined' ? this.context.createGainNode() : this.context.createGain();
		this.masterGain.gain.value = this._volume;
		this.masterGain.connect(this.context.destination);
		*/
		return sound;
	}

	metronome(tap) {
		if (!tap) return this.metronomeSound.play();

		this.taps = !this.taps ? 1 : ++this.taps;
		let bpm = this.bpmCounter.tap();
		this.lastTap = Date.now();
		this.bpm = bpm.avg;
		Global.bpm = bpm.avg;

		if (this.taps > 7) {
			this.taps = null;
			this.bpmCounter.reset();
		}
		this.metronomeSound.play();

		// = this.setTimeout(() => this.stopMetronome(), 1000);
	}

	playMetronome() {
		if (this.metronomeSoundPlaying === undefined) {
		}
		this.metronomeSoundPlaying = true;
		let time = parseInt(((Global.bpm / 60) * 1000) / 2) + Date.now();
		let ms = parseInt(((Global.bpm / 60) * 1000) / 2);

		this.metronomeTo = setInterval(() => {
			if (!this.metronomeSoundPlaying) return;
			setTimeout(() => {
				console.log(Date.now() - time);
				this.metronomeSound.play(time);
				this.metronomeSoundPlaying = true;
			}, time - Date.now());
		}, ms);
	}
	toggleMetronome() {
		this.metronomeSoundPlaying = !this.metronomeSoundPlaying;
		if (!this.metronomeSoundPlaying) {
			clearTimeout(this.metronomeTo);
			this.metronomeSound.stop();
		}
	}

	record(start) {
		if (start) {
			console.log('START RECORDER ------');
			return this.masterRecorder
				.record(this.masterGain)
				.then((recording) => {
					return recording;
				})
				.catch((err) => {
					this.emit('error', err);
				});
		} else {
			console.log('STOP RECORDER ------');
			this.masterRecorder.stop();
		}
		return;
	}
	cancelRecord() {
		this.masterRecorder.cancel();
		this.recording = false;
		this.emit('recording', false);
		this.emitMasterState({
			recording: false,
		});
	}
	sample(id, start) {
		if (!this.inputStreamSource) return Promise.reject('No audio input source selected');

		if (start) {
			console.log('START SAMPLER -----');
			this.stop(id);
			return this.sampleRecorder
				.record(this.inputStreamSource, id)
				.then((recording) => {
					console.log('SAMPLER DONE -----');
					const sound = this.get(id) ? this.get(id).sound : null;
					if (!sound) return console.error('NO SOUND there anymore', id);

					this.replace(id, recording.url, recording.filename);
					return recording;
				})
				.catch((err) => {
					console.error(err);
					throw err;
				});
		} else {
			console.log('SAMPLER STOP ----');
			this.sampleRecorder.stop();
		}
		return;
	}
	cancelSample(id) {
		this.sampleRecorder.cancel();
		this.sampling = false;
		this.emit('sampling', id, false);
		if (this.get(id).sound) this.get(id).sound.sampling(false);
		this.emitMasterState({
			sampling: false,
		});
	}

	encodeAudio(buffer, format, opt) {
		this.encoderPromise = new Promise((resolve, reject) => {
			this.worker = createEncoderWorker();
			this.worker.reject = reject;
			this.worker.addEventListener('message', (event) => {
				if (event.data.progress) return this.emit('encodingprogress', event.data.progress);

				if (this.worker) this.worker.terminate();
				this.worker = null;
				resolve(event.data);
			});
			this.worker.addEventListener('error', (err) => {
				if (this.worker && this.worker.terminate) {
					this.worker.terminate();
					this.worker = null;
					console.error('terminated encoding worker wit error', err);
				}
				reject(err);
			});

			this.worker.postMessage({
				buffer,
				format,
				options: opt,
			});
		});
		return this.encoderPromise;
	}
	cancelEncodeAudio() {
		if (!this.worker) return;
		this.worker.reject('CANCELLED');
		this.worker.terminate();
		this.worker = null;
	}
	processSample(id, buffer) {
		console.time('processsample');
		this.emit('sampleprocess', id, true);
		return new Promise((resolve, reject) => {
			let data = buffer;
			if (this.processSample.trim)
				data = AudioUtils.trim(buffer, {
					level: this.trimThreshold,
					trimLeft: true,
					trimRight: true,
					sampleRate: this.sampleRate,
				});
			if (!data || !data[0].length) return reject('Sample is silent!');
			if (this.processSample.normalize)
				data = AudioUtils.normalize(data, {
					sampleRate: this.sampleRate,
				});
			return this.encodeAudio(data, 'wav', {
				sampleRate: this.sampleRate,
				numChannels: data.length,
			}).then((b) => {
				const blob = new Blob([b], {
					type: 'audio/wav',
				});
				resolve({
					blob: blob,
					buffer: data,
				});
			});
		}).then((data) => {
			//this.emit('sampleprocess', id, false)
			console.timeEnd('processsample');
			return data;
		});
	}

	initMidi() {
		return this.initMidiDevices();
	}
	async initMidiDevices() {
		console.log('init midi');
		try {
			// WebMidi v3: enable() is a promise; the old callback form no longer
			// receives an error (failures reject instead)
			await WebMidi.enable();
		} catch (err) {
			throw 'MIDI not supported';
		}

		this.midiDevices = WebMidi.inputs.map((i) => {
			return {
				deviceId: i.id,
				name: i.name,
				connection: i.connection,
				state: i.state,
				manufacturer: i.manufacturer,
			};
		});

		WebMidi.addListener('connected', (event) => {
			const i = event.port;
			if (i.type === 'output') return;
			const device = {
				deviceId: i.id,
				name: i.name,
				connection: i.connection,
				state: i.state,
				manufacturer: i.manufacturer,
			};
			if (this.midiDevices.filter((d) => d.deviceId === device.deviceId).length) return;
			this.midiDevices.push(device);
			this.emit('mididevices', this.midiDevices);
		});
		WebMidi.addListener('disconnected', (event) => {
			const i = event.port;
			if (i.type === 'output') return;
			const device = {
				deviceId: i.id,
				name: i.name,
				connection: i.connection,
				state: i.state,
				manufacturer: i.manufacturer,
			};
			this.midiDevices = this.midiDevices.filter((d) => d.deviceId !== device.deviceId);
			this.emit('mididevices', this.midiDevices);
		});
		console.log('AVAILABLE MIDI DEVICES', this.midiDevices);
		this.emit('mididevices', this.midiDevices);
		return this.midiDevices;
	}
	initMidiSource(midiDeviceId) {
		try {
			if (this.midiDevice) {
				//console.log(this.midiDevice.hasListener(this.onMidiNoteOn))
				this.midiDevice.removeListener('noteon');
				this.midiDevice.removeListener('noteoff');
				console.log('removed listeners');
			}
			this.midiDevice = WebMidi.inputs.filter((d) => d.id === midiDeviceId)[0];

			this.midiDevice.addListener('noteon', 'all', this.onMidiNoteOn.bind(this));
			this.midiDevice.addListener('noteoff', 'all', this.onMidiNoteOff.bind(this));
		} catch (err) {
			return Promise.reject(err);
		}
		console.log('INIT MIDI SOURCE', this.midiDevice.name, this.midiDevice);
		return Promise.resolve();
	}
	onMidiNoteOn(e) {
		console.log(e);
		console.log(e.target.name, e.note.number);
		if (this.master.state.midiMapMode) {
			const sound = this.get().filter((s) => s.sound._midiMapMode)[0];
			if (sound) this.mapMidiNote(sound.id, e.note.number);
			this.emitMasterState({
				midiMapMode: false,
			});
			return;
		}
		this.playNote(e.note.number, e.rawVelocity);
		this.emit('noteon', e);
	}
	onMidiNoteOff(e) {
		this.emit('noteoff', e.note.number);
	}
	mapMidiNote(id, note) {
		if (!this.midiMap[note]) this.midiMap[note] = [];
		if (this.midiMap[note].filter((i) => i === id).length) return; //already mapped

		this.midiMap[note].push(id);

		const sound = this.get(id).sound;
		this.get().forEach((s) => s.sound.midiMapMode(false));
		sound.midiNote(note);
		sound.midiMapMode(false);
		console.log('mapped midi note', note, id);
	}
	unmapMidiNote(id, note) {
		if (this.midiMap[note]) {
			this.midiMap[note] = this.midiMap[note].filter((i) => {
				if (i === id) {
					this.get(id).sound.midiNote(0);
					this.get(id).sound.midiMapMode(false);
					return false;
				}
				return true;
			});
		}
	}
	midiMapMode(id, on) {
		this.get().forEach((s) => {
			s.sound.midiMapMode(s.id === id ? on : false);
		});
		this.emitMasterState({
			midiMapMode: on,
		});
	}
	playNote(note, velocity) {
		if (this.midiMap[note]) {
			this.midiMap[note].forEach((id) => {
				const sound = this.get(id).sound;
				const vol = (velocity / 127) * sound._volume;
				sound.play({
					volume: vol,
				});
				console.log('play midi', id, velocity, vol);
			});
		}
	}
	analyse(id, type, opt, cb) {
		if (id === 'input') return this.inputAnalyser;
		if (id === 'master') return this.outputAnalyser;

		const node = this.get(id).sound.node;
		const analyser = new Analyser(id, this.context, node, opt);
		this.analysers.push(analyser);
		return analyser;
	}
	destroyAnalysers() {
		this.analysers.forEach((analyser) => {
			analyser.destroy();
		});
		if (this.inputAnalyser) this.inputAnalyser.destroy();
		if (this.outputAnalyser) this.outputAnalyser.destroy();
	}
	extractPeaks(id, spp = 1000, opt = {}) {
		const s = this.get(id);
		const buffer = s.sound.buffer;
		if (!buffer) return null;

		const start =
			opt.start !== undefined ? parseInt((opt.start / buffer.duration) * buffer.length) : 0;
		const end =
			opt.end !== undefined
				? parseInt((opt.end / buffer.duration) * buffer.length)
				: buffer.length - 1;
		const mono = opt.mono !== undefined ? opt.mono : true;
		const bits = opt.bits !== undefined ? opt.bits : 8;
		//console.log('extract peaks', start, end, buffer.duration, buffer.length, opt)
		s.peaks = extractPeaks(buffer, spp, mono, start, end, bits);
		return s.peaks;
	}
}
export default AudioEngine;
