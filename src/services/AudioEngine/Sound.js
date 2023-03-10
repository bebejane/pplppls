import AudioUtils from './utils';
import arrayMove from 'array-move';
const EventEmitter = require("events")

const defaults = {
	url: null,
	rate: 1.0,
	pitch: 1.0,
	volume: 0.5,
	gain: 0.0,
	duration: 0,
	pan: 0,
	panWidth: 50,
	panX: 0,
	panZ: 0,
	loop: false,
	loopStart: 0,
	loopEnd: 0,
	sampling: false,
	solo: false,
	locked: false,
	paused: false,
	pausedAt: 0,
	loaded: false,
	loading: false,
	ready: false,
	playing: false,
	muted: false,
	midiNote: 0,
	midiMapMode: false,
	reversed: false,
	effectsEnabled: true,
	elapsed: 0,
	error: null
}

class Sound extends EventEmitter {
	constructor(id, url, engine, opt = {
		filename: null,
		local: false,
		enableLoops: false,
		enableMeter: false,
		enableElapsed: false
	}) {
		super();
		this.DEBUG = true;
		Object.keys(defaults).forEach((k) => this['_' + k] = opt[k] !== undefined ? opt[k] : defaults[k])
		this.id = id
		this.engine = engine;
		this.context = engine.context;
		this.sampleRate = this.context.sampleRate
		this.node = typeof this.context.createGain === "undefined" ? this.context.createGainNode() : this.context.createGain();
		this.buffer = null;
		this._buffer = null;
		this._org_buffer = null;
		this._filename = opt.filename ? opt.filename : this._url ? this._url.substring(this._url.lastIndexOf('/') + 1) : opt.filename;
		this._mimeType = this.urlToMimeType(this._filename)
		this._url = url
		this.local = opt.local
		this.enableLoops = opt.enableLoops;
		this.enableMeter = opt.enableMeter;
		this.enableElapsed = opt.enableElapsed;
		this.node.gain.setValueAtTime(this._volume, this.context.currentTime);
		this.node.paused = true;
		this.effects = []
		this.spillOver = true
		this.panner = this.context.createPanner({
			panningModel: 'equalpower'
		})
		this.source = null;
		this.effectsInputNode = this.context.createGain()
		this.effectsOutputNode = this.context.createGain()
		this.chain = []
		this.onEnded = this.onEnded.bind(this);

	}
	play(options = {}) {
		const opt = {
			start: 0,
			duration: 0,
			enableElapsed: false,
			noStop:false,
			fadeIn:0,
			fadeOut:0,
			fadeType:'linear',
			...options
		}

		if (!this._ready || !this.buffer || this._sampling) return

		if (this._paused)
			return this.pause(false)

		if (this.source){
			this.source.removeEventListener('ended', this.onEnded)
			clearInterval(this.loopEndTimeout)
		}
		

		if (this._playing && this.source) this.source.stop()
		//if (this._playing){
			console.log('stopplay')
		//	this.stop()
		//}

		const soloOn = this.engine.master.solo()

		this.source = this.context.createBufferSource();
		this.source.buffer = this.buffer;

		if (!this._muted && (soloOn ? this._solo : true))
			this._connectChain(this.source, this.node)
			

		const ct = this.context.currentTime
		this._offset = opt.start || this._pausedAt || this._loopStart || 0
		this.source.loop = this._loop
		this.source.loopStart = this._loopStart || this.source.loopStart
		this.source.loopEnd = this._loopEnd || this.source.loopEnd
		this.source.playbackRate.value = this._rate;
		this.source.addEventListener('ended', this.onEnded)

		if(opt.volume !== undefined)
			this.node.gain.setValueAtTime(opt.volume, this.context.currentTime + 0.005)// this.volume(opt.volume)
		
		this.source.start(0, this._offset)//, opt.duration && !this._loop ? opt.duration : this._duration - this._offset);
		
		if(opt.fadeIn !== undefined && opt.fadeIn !== 0.0) 
			this.fadeIn(opt.fadeIn, opt.fadeType, 0.00001, opt.volume || this._volume)
		if(opt.fadeOut !== undefined && opt.fadeOut !== 0.0 && !this._loop) 
			this.fadeOut(opt.fadeOut, opt.fadeType, 0.00001, opt.duration || this._duration)


		this._startedAt = this.context.currentTime
		this._playing = true
		this._emit('playing', true)

		
		if (this.enableElapsed || opt.enableElapsed) {
			this._clearElapsed()
			this.once('ended', () => this._clearElapsed())
			this.emit('elapsed', this._offset)
			this._checkElapsed()
		}
		
		if (this.enableLoops || (opt.enableElapsed && this._loop))
			this._checkLoopEnd()
		//console.log('play', this._offset, 'muted', this._muted, 'loop', this._loopStart + ' > ' + this._loopEnd, 'dur=', opt.duration, opt.fadeIn, opt.fadeOut)	

	}
	_connectChain(){
		if(!this.source)
			return
		
		this._disconnectChain()
		const effects = this.effects;
		let lastOutput = this.source
		effects.filter((e) => !e.bypassed).forEach((e, idx) => {
			lastOutput.connect(e.effect.inputNode)
			lastOutput = e.effect
		})
		lastOutput.connect(this.node)
		this.node.connect(this.panner)
		this.panner.connect(this.engine.masterGain)
		this._connected = true;
	}
	_disconnectChain(){
		if(this._connected){
			const effects = this.effects;
			this.source.disconnect()
			effects.forEach((e)=>e.effect.disconnect())
			this.node.disconnect(this.panner)
			this.panner.disconnect(this.masterGain)
		}
		this._connected = false;
	}
	addEffect(type, eff, bypass) {
		console.log('adding effect', type)
		const idx = this.effects.length;
		const effect = {
			id: type,
			type: type,
			effect: eff,
			bypassed: true,
			idx: idx,
			defaults: eff.defaults
		}
		this.effects.push(effect)

		this._emit('addeffect', type, idx)
		this.effectBypass(idx, bypass)
		return this._currentEffectParams(idx)
	}
	effectBypass(idx, bypass) {
		
		if (idx < 0 || idx > this.effects.length-1 || !this.effects[idx]) 
			throw new Error('effect not found at idx=' + idx)
		else if (bypass === undefined)
			return this.effects[idx]
		const e = this.effects[idx]
		e.bypassed = bypass
		this._connectChain()
		this._emit('effectbypass', idx, bypass)
		return e
	}
	removeEffect(idx) {
		const effects = this.effects.filter((e, i) => i !== idx);
		effects.forEach((eff, idx) => eff.idx = idx)
		this.effects = effects || []
		this._connectChain()
		this._emit('removeeffect', idx)
		return this._currentEffectParams();
	}
	moveEffect(id, idx, toIdx) {
		
		this.effects = arrayMove(this.effects, idx, toIdx)
		this.effects.forEach((e, idx)=>e.idx =idx)		
		this._connectChain()
		return this._currentEffectParams()
	}
	
	effectParams(idx, params) {
		if (params === undefined && idx === undefined)
			return this._currentEffectParams()
		if (idx !== undefined && !this.effects[idx])
			return {}
		if (params === undefined && idx !== undefined)
			return this._currentEffectParams(idx)


		const effect = this.effects[idx].effect

		Object.keys(effect.defaults).forEach((k) => {
			if (params[k] !== undefined)
				effect[k] = params[k]
		})
		const newParams = this._currentEffectParams(idx)
		this._emit('effectparams', newParams)
		return newParams;
	}
	disableEffects() {
		this.effects.forEach((e, idx) => e.bypassed=true)
		this._connectChain()
		this._effectsEnabled = false
		console.log('disable all effects')
		this._emit('effectsenabled', false)
		
	}
	enableEffects() {
		this.effects.forEach((e, idx) => e.bypassed=false)
		this._effectsEnabled = true
		this._connectChain()
		console.log('enable all effects')
		this._emit('effectsenabled', true)
	}
	fadeIn(time, type, fromVolume, toVolume){		
		this.node.gain.setValueAtTime(fromVolume, this.context.currentTime)
		const endTime = this.context.currentTime + time - 0.001;
		
		if(type === 'linear')
			this.node.gain.linearRampToValueAtTime(toVolume, endTime);
		else if(type === 'exponential')
			this.node.gain.exponentialRampToValueAtTime(toVolume, endTime);
		else if(type === 'logarithmic')
			this.node.gain.linearRampToValueAtTime(toVolume, endTime);
		else if(type === 'scurve')
			this.node.gain.linearRampToValueAtTime(toVolume, endTime);

		//console.log('fadein', time, type, fromVolume, toVolume,this.context.currentTime,time)
	
	}
	fadeOut(time, type, toVolume, offset = 0){
		const delay = time > offset ? 0 : (offset-time)
		clearTimeout(this.fadeOutTimeout)
		//console.log('fadeout', time, type, toVolume, offset, delay*1000)
		this.fadeOutTimeout = setTimeout(()=>{
			const endTime = this.context.currentTime + time	
			if(type === 'linear')
				this.node.gain.linearRampToValueAtTime(toVolume, endTime);
			else if(type === 'exponential')
				this.node.gain.exponentialRampToValueAtTime(toVolume, endTime)
			else if(type === 'logarithmic')
				this.node.gain.linearRampToValueAtTime(toVolume, endTime)
			else if(type === 'scurve')
				this.node.gain.linearRampToValueAtTime(toVolume, endTime)	
			//console.log('fade out', time, type, toVolume, offset, delay)
		}, delay*1000)
	}
	_currentEffectParams(idx) {
		if (idx !== undefined && !this.effects[idx]) return {}
		const effects = idx !== undefined ? [this.effects[idx]] : this.effects;
		const params = effects.map((e, i) => {
			return {
				idx: idx !== undefined ? idx : i,
				id: e.type,
				type: e.type,
				bypassed: e.bypassed,
				params: e.effect.params(),
				defaults: e.effect.defaults
			}
		})
		return idx !== undefined ? params[0] : params;
	}
	_checkElapsed() {
		if (!this._playing || this._paused) return
		this._elapsed = (this.context.currentTime - this._startedAt) + this._offset
		this.emit('elapsed', this._elapsed)
		this.elapseTimeout = setTimeout(() => this._checkElapsed(), 30)
	}
	_clearElapsed() {
		clearTimeout(this.elapseTimeout)
		this._elapsed = 0;
		this.emit('elapsed', 0)
	}
	_checkLoopEnd() {
		clearInterval(this.loopEndTimeout)
		if (this._loop) {
			//console.log('check loop end', this._loopStart + ' > ' + this._loopEnd)
			this.loopEndTimeout = setTimeout(() => this._loopEndReached(), (this._loopEnd - this._loopStart) * 1000)
		}
	}
	_clearLoopEnd() {
		clearTimeout(this.loopEndTimeout)
	}
	_loopEndReached() {

		this._clearLoopEnd()

		this._elapsed = 0;
		this._startedAt = this.context.currentTime;
		this._checkLoopEnd()
		this.emit('loopend', true)
		//console.log('loop end reached')
	}
	stop() {
		console.log('stop')
		if (!this.source) return;

		this._clearElapsed()
		this._clearLoopEnd()
		clearTimeout(this.fadeOutTimeout)
		clearTimeout(this.fadeInTimeout)

		if (this.source && this._playing)
			this.source.stop();

		//if (!this.spillOver) this.effects.filter((e) => !e.bypassed).forEach((e) => e.effect.disconnect())

		this._pausedAt = 0;
		this._startedAt = 0;
		this._playing = false
		this._emit('ended')
		this._emit('stop')
		this._emit('playing', false)
	}
	_emit(event, val, val2) {
		this.emitState(event, val);
		this.emit(event, this.id, val, val2);

	}
	emitState(event, val) {

		const updated = {};
		if (typeof val === 'object') {
			Object.keys(val).forEach((k) => {
				this['_' + k] = val[k]
				updated[k] = val[k]
			})
		} else
			updated[event] = val

		this.emit('state', {
			id: this.id,
			ready: this._ready,
			loaded: this._loaded,
			loading: this._loading,
			playing: this._playing,
			volume: this._volume,
			gain: this._gain,
			pan: this._pan,
			panWidth: this._panWidth,
			rate: this._rate,
			pitch: this._pitch,
			loop: this._loop,
			loopStart: this._loopStart,
			loopEnd: this._loopEnd,
			muted: this._muted,
			mutedVol: this._mutedVol,
			paused: this._paused,
			pausedAt: this._pausedAt,
			solo: this._solo,
			soloOn: this._soloOn,
			locked: this._locked,
			duration: this._duration,
			sampling: this._sampling,
			filename: this._filename,
			elapsed: this._elapsed,
			midiNote: this._midiNote,
			midiMapMode: this._midiMapMode,
			reversed: this._reversed,
			effectsEnabled: this._effectsEnabled,
			effects: this._currentEffectParams(),
			error: this._error,
			_event: event
		}, updated)
	}
	getState() {
		const state = {}
		Object.keys(defaults).forEach((k) => {
			state[k] = this['_' + k]
		})
		return state;
	}
	getSaveState() {
		return {
			volume: this._volume,
			rate: this._rate,
			pan: this._pan,
			panZ: this._panZ,
			panX: this._panX,
			panWidth: this._panWidth,
			loop: this._loop,
			loopStart: this._loopStart,
			loopEnd: this._loopEnd,
			solo: this._solo,
			locked: this._locked,
			muted: this._muted,
			pause: this._paused,
			pausedAt: this._pausedAt,
			reversed: this._reversed,
			effectsEnabled: this._effectsEnabled,
			effects: this._currentEffectParams()
		}
	}
	reset() {
		const {
			_duration,
			_loaded,
			_ready
		} = this;
		
		this.stop()
		this.effects.forEach((e) => {
			e.effect.disconnect()
			e.effect.reset()
			e.connected = false
		})
		Object.keys(defaults).forEach((k) =>
			this['_' + k] = defaults[k]
		)
		this._loaded = _loaded
		this._duration = _duration
		this._loopEnd = _duration;
		this._ready = _ready;
		this.loop(false)
		this.mute(defaults.muted)
		this.solo(defaults.solo)
		this.volume(defaults.volume)
		this.rate(defaults.rate)
		this.pan(defaults.pan)
		this.reverse(defaults.reversed)
		this.lock(defaults.locked)
		this._emit('reset', this.id)
	}



	onEnded() {
		
		this._startedAt = 0;
		if (!this._loop) {
			this._playing = false
			this._emit('playing', false)
		}
		this.emit('ended')
	}
	pause(on) {
		if (on) {
			
			if (this.source) {
				this._pausedAt = this._startedAt ? this.source.context.currentTime - this._startedAt : 0;
				this.source.stop();
			}
			this._paused = true;
		} else {

			this._paused = false
			if (this._pausedAt) {

				this.play({
					start: this._pausedAt
				})
			}
			this._pausedAt = 0

		}

		this._emit('pause', this._paused)
		return this._paused
	}

	jump(sec) {
		const nextTime = (this.context.currentTime - this._startedAt) + (sec * 1)
		this.pause()
		this.play({
			start: nextTime >= 0 ? nextTime : 0
		})
	}
	mute(on) {
		if(on === undefined) return this._mute
		if (this.source) {
			if (on)
				this._disconnectChain()
			else{
				this._connectChain()
			}
		}
		this._muted = on;
		this._emit('muted', on)
	}

	volume(vol) {
		//console.log(this.id, vol, this._volume)
		if (vol !== undefined) {
			//vol = parseFloat(vol.toFixed(2))
			//console.log(this.id, vol)
			this.node.gain.cancelScheduledValues(this.context.currentTime);
			this.node.gain.setValueAtTime(this._volume, this.context.currentTime + 0.01)
			this.node.gain.linearRampToValueAtTime(vol, this.context.currentTime + 0.05);
		}
		this._volume = vol !== undefined ? vol : this._volume;
		this._emit('volume', this._volume)
		return this._volume
	}
	gain(gain) {
		if (gain !== undefined) {
			this.node.gain.cancelScheduledValues(this.context.currentTime);
			this.node.gain.setValueAtTime(this._volume * (this._gain + 1), this.context.currentTime)
			this.node.gain.linearRampToValueAtTime(this._volume * (this._gain + 1), this.context.currentTime + 0.20);

		}
		this._gain = gain !== undefined ? gain : this._gain;
		this._emit('gain', this._gain)
		return this._gain
	}
	rate(rate) {

		if (rate !== undefined && this.source && this._rate !== rate) {

			this.source.playbackRate.cancelScheduledValues(this.context.currentTime);
			this.source.playbackRate.setValueAtTime(this._rate, this.context.currentTime + 0.01);
			this.source.playbackRate.linearRampToValueAtTime(rate, this.context.currentTime + 0.05);

		}

		this._rate = rate !== undefined ? parseFloat(rate) : this._rate;
		this._emit('rate', this._rate)
		//if(this._playing) this.play()
		return this._rate
	}


	pan(deg) {

		var xDeg = parseInt(deg);
		var zDeg = xDeg + 90;
		if (zDeg > 90)
			zDeg = 180 - zDeg;

		var x = Math.sin(xDeg * (Math.PI / 180));
		var z = Math.sin(zDeg * (Math.PI / 180));

		if (this.source && this.panner) {

			if (this._panX !== x && this.panner.positionX) {
				this.panner.positionX.cancelScheduledValues(this.context.currentTime);
				this.panner.positionX.setValueAtTime(this._panX, this.context.currentTime);
				this.panner.positionX.linearRampToValueAtTime(x, this.context.currentTime + 0.30);

			} else if (this._panZ !== z && this.panner.positionZ) {
				this.panner.positionZ.cancelScheduledValues(this.context.currentTime);
				this.panner.positionZ.setValueAtTime(this._panZ, this.context.currentTime);
				this.panner.positionZ.linearRampToValueAtTime(z, this.context.currentTime + 0.30);
			}
		}

		const panWidth = deg <= 0 ? (((-90 + Math.abs(-deg)) / -90) * 100) / 2 : 50 + (((deg / 90) * 100) / 2)
		this._pan = deg
		this._panWidth = parseInt(panWidth);
		this._panX = x
		this._panZ = z
		this._emit('pan', this._pan)
		return {
			x: x,
			z: z
		};

	}
	loop(on, offset = {}) {
		if (on === undefined) return this._loop;
		this._loopStart = offset.start !== undefined ? offset.start : this._loopStart || 0
		this._loopEnd = offset.end !== undefined ? offset.end : on ? this._duration : this.LoopEnd || 0
		this._loop = on

		if (this.source) {
			this.source.loopStart = this._loopStart
			this.source.loopEnd = this._loopEnd
			this.source.loop = on;
		}
		if (!this._loop)
			this._clearLoopEnd()
		this._emit('loop', on)
		return this._loop;
	}

	reverse(on) {
		if (on === undefined) return this._reverse;
		if (!this.buffer) return
		if (on && !this._reversed)
			AudioUtils.reverse(this.buffer)
		if (!on && this._reversed)
			AudioUtils.reverse(this.buffer)
		this._reversed = on
		this._emit('reversed', on)
		this.emit("change");
	}
	crop(start, end) {
		const s = parseInt(start * this.sampleRate)
		const e = parseInt(end * this.sampleRate)
		const data = this.buffer.getChannelData(0);
		const cropped = AudioUtils.slice([data], s, e > data.length - 1 ? data.length - 1 : e)
		const newBuff = new AudioBuffer({
			length: cropped[0].length,
			numberOfChannels: 1,
			sampleRate: this.sampleRate
		})
		newBuff.copyToChannel(cropped[0], 0)
		this.buffer = newBuff;
		this._duration = this.buffer.duration ///this.buffer.numberOfChannels;
		this._emit('duration', this._duration)
		this.emit("change");
	}
	async pitch(pitch, opt) {

		if (pitch !== undefined && this.buffer && pitch !== 1.0) {
			const dir = pitch > 1.0 ? 'up' : 'down'
			const step = pitch > 1.0 ? parseInt((pitch - 1.0) * 10) : parseInt((1.0 - pitch) * 10)
			if (!this._org_buffer) {
				this._org_buffer = new AudioBuffer(this.buffer)
				for (var i = 0; i < this._org_buffer.numberOfChannels; i++)
					this._org_buffer.copyToChannel(this.buffer.getChannelData(i), i)

			}
			
			const stretched = AudioUtils.stretch(this._org_buffer, {
				pitch: pitch,
				sampleRate: this.sampleRate
			})
			if (stretched.length) {
				const newBuff = new AudioBuffer({
					length: stretched.length,
					numberOfChannels: 1,
					sampleRate: this.sampleRate
				})
				newBuff.copyToChannel(stretched, 0)
				this.buffer = newBuff;
			}


			/*
				const stretched = AudioUtils.pitch2(this.buffer, {direction:dir, steps:step, sampleRate:this.sampeRate})
			*/
			//const stretched = AudioUtils.pitch(this.buffer, {direction:dir, steps:step, sampleRate:this.sampeRate})
			/*
				
			//this.buffer = await this.context.decodeAudioData(pitched)
			*/
		} else 
			this.buffer = this._org_buffer || this.buffer

		this._pitch = pitch !== undefined ? parseFloat(pitch) : this._pitch;
		this._emit('pitch', this._pitch)
		this.emit("change");
		return this._pitch
	}
	solo(on, mute) {
		if (on === undefined)
			return this._solo;
		this.mute(mute)
		this._solo = on
		this._emit('solo', on)
		return this._solo;
	}
	lock(on) {
		if (on === undefined)
			return this._locked;
		this._locked = on;
		this._emit('locked', on)

	}
	duration() {
		return this._duration;
	}
	realDuration() {
		if (this._duration === 0 || this._rate === 0) return 0;
		return ((this._loopEnd - this._loopStart) || this._duration) / this._rate;
	}
	sampling(on) {
		this._sampling = on;
		this._emit('sampling', on)
	}

	
	load(url) {
		console.log('load sound', this.id)
		this._clearElapsed()
		this._clearLoopEnd()
		this._loaded = false
		this._error = null;
		this._url = url !== undefined ? url : this._url

		if (!this._url || !this._filename) {
			this._ready = true;
			return this._emit('ready', true)
		}

		this._loading = true
		this._emit('loading', true)
		this._url = this._url.includes('blob:') ? this._url : encodeURIComponent(this._url);
		
		if (this.local && !this._url.includes('blob:'))
			return this._loadLocal()

		if (/^data:[^;]+;base64,/.test(url)) {
			let data = atob(url.split(",")[1]);
			let dataView = new Uint8Array(data.length);
			for (let i = 0; i < data.length; ++i)
				dataView[i] = data.charCodeAt(i);
			this.decodeAudioData(dataView.buffer);
		} else {
			let xhr = new XMLHttpRequest();
			xhr.open("GET", this._url, true);
			xhr.withCredentials = false;
			xhr.responseType = "arraybuffer";
			xhr.addEventListener("load", () => {
				let code = parseInt((xhr.status + "")[0]);
				if (code !== 0 && code !== 2 && code !== 3)
					return xhr.onerror("Failed loading audio file with status: " + xhr.status + ".")
				this.decodeAudioData(xhr.response);
			});
			xhr.addEventListener("error", (err) => {
				this._loading = false
				this._ready = true;
				this._url = null;
				this._error = err;
				this._emit('ready', true)
				this._emit("loaderror", err);
			});

			try {
				xhr.send();
			} catch (e) {
				xhr.onerror(e);
			}
		}
	}
	_loadLocal() {
		
		let url = this._url;
		const fs = window.require('fs')
		const root = window.require('electron').remote.app.getAppPath()
		const filePath = root + '/build' + url
		if (fs.existsSync(filePath)) {
			const data = fs.readFileSync(filePath, {
				binary: true
			})
			this.decodeAudioData(Uint8Array.from(data).buffer)
		} else {
			this._loading = false
			this._ready = true;
			this._error = 'File doesnt exist';
			this._emit('ready', true)
			this._emit("loaderror", 'File doesnt exist');
		}

	}
	decodeAudioData(arrayBuffer) {

		const error = (err) => {
			console.error('ERRROR decoding audio data', this._id, err)
			this._url = null;
			this._loading = false;
			this._loaded = false;
			this._ready = true;
			this._error = err
			this._emit('ready', true)
			this._emit("loaderror", this._error);
			this.sampling(false)
		};
		// Copy buffer
		let _buffer = new ArrayBuffer(arrayBuffer.byteLength);
		new Uint8Array(_buffer).set(new Uint8Array(arrayBuffer));

		const success = (buffer) => {
			if (buffer) {
				//console.log('decoded data', this.id, buffer.duration)

				this.buffer = this._reversed ? AudioUtils.reverse(buffer) : buffer;
				this._buffer = _buffer
				this._duration = buffer.duration ///buffer.numberOfChannels;
				//this._loopEnd = this._duration;
				this._loaded = true;
				this._loading = false;
				this._ready = true;
				this._error = null;
				this._emit('ready', true)
				this._emit('loaded', true)
				this.emit('load')
				this.emit("change");
				this.sampling(false)

			} else
				error();
		};

		/*
		this.context.decodeAudioData(arrayBuffer).then((buffer)=>{
			success(buffer)
		}).catch((err)=>error(err))
		return
		*/
		const p = this.context.decodeAudioData(arrayBuffer, (buffer) => {
			success(buffer)
		}, (err) => {
			if (!p)
				error(err)
		})
		if (p && p.catch)
			p.catch((err) => error(err))

	}
	urlToMimeType(url) {
		if (!url)
			return 'audio/mpeg'
		const src = url.toLowerCase()
		if (src.endsWith('.mp3'))
			return 'audio/mpeg'
		else if (src.endsWith('.wav'))
			return 'audio/wav'
		else if (src.endsWith('.m4a'))
			return 'audio/mp4'
		else
			return null
	}
	midiNote(number) {
		this._midiNote = number;
		this._emit('midinote', number)
	}
	midiMapMode(on) {
		this._midiMapMode = on;
		this._emit('midimapmode', on)
	}
	destroy() {
		this.emit = () =>{}

		if (this.source && this._playing) {
			this.source.removeEventListener('ended', this.onEnded)
			this.source.stop();

		}
		this.effects.forEach((e) => e.effect.disconnect())
		this.source = null
		this.buffer = null
		this._buffer = null
		this._clearElapsed()
		clearTimeout(this.loopEndTimeout)
		clearTimeout(this.fadeOutTimeout)
	}
	log(){
		if(!this.DEBUG) return
		//let caller_line = (new Error).stack.split("\n")[4]
		console.log('Sound.js', this.id, Array.prototype.slice.call(arguments).join(' '))

	}
	error(err){

	}
	
}

export default Sound;