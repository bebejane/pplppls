// @ts-nocheck
/**
 * Master transport controller. Extracted from AudioEngine so the engine
 * class no longer carries a ~160-line inline object. Every method keeps the
 * exact same behavior (including events and masterstate emission), with
 * engine access via `this.engine`.
 */
class Master {
	constructor(engine, initialVolume) {
		this.engine = engine;
		this.state = {
			volume: initialVolume,
			startedAt: 0,
			elapsed: 0,
			duration: 0,
			rate: 1.0,
			locked: false,
			muted: false,
			playing: false,
			looping: false,
			paused: false,
			stopped: true,
			recording: false,
			sampling: false,
			solo: false,
			midiMapMode: false,
		};
	}

	stop() {
		this._clearElapsed();
		this.engine.sounds.forEach((s) => this.engine.stop(s.id));
		this.engine.emit('stopall');
		this.engine.emitMasterState({ stopped: true, playing: true });
		this._updateDuration();
	}

	play(opt = { enableElapsed: false }) {
		this.engine.sounds.forEach((s) => this.engine.play(s.id));
		this.engine.emit('playall');
		this.engine.emitMasterState({
			stopped: false,
			playing: true,
			startedAt: this.engine.context.currentTime,
			duration: this.duration(),
		});
		if (opt.enableElapsed || this.engine.enableElapsed)
			this.elapsedInterval = setInterval(() => this._checkElapsed(), 50);
	}

	isPlaying() {
		return this.engine.sounds.filter((s) => s.sound._playing).length > 0;
	}

	mute(on) {
		this.engine.sounds.forEach((s) => {
			this.engine.mute(s.id, on);
		});
		this.engine.emit('muteall', on);
		this.engine.emitMasterState({ muted: on });
		return this.state.muted;
	}

	muted() {
		if (this.engine.sounds.filter((s) => !s.sound.muted).length) return false;
		else return true;
	}

	pause(on) {
		this.engine.sounds.forEach((s) => this.engine.pause(s.id, on));
		this.engine.emit('pauseall', on);
		this.engine.emitMasterState({ paused: on, playing: this.isPlaying() });
	}

	loop(on) {
		if (on === undefined) return this.state.looping;

		this.engine.sounds.forEach((s) => {
			s.sound.loop(on);
		});
		this.engine.emit('loopall', on);
		this.engine.emitMasterState({ looping: on });
		return this.state.looping;
	}

	volume(vol) {
		if (vol) {
			this.engine.masterGain.gain.value = vol;
			this.engine._volume = vol;
			this.engine.emit('mastervolume', vol);
		}
		if (vol) this.engine.emitMasterState({ volume: parseFloat(vol) });
		return vol;
	}

	pan(deg) {
		this.engine.emitMasterState({ pan: deg });
		return this.state.pan;
	}

	rate(rate) {
		this.engine.sounds.forEach((s) => s.sound.rate(rate));
		this.engine.emitMasterState({ rate: rate });
		this._updateDuration();
		return 0;
	}

	jump(sec) {
		this.engine.sounds.forEach((s) => s.sound.jump(sec));
		this.engine.emitMasterState();
		return sec;
	}

	locked(on) {
		if (on !== undefined) {
			this.engine.sounds.forEach((s) => s.sound.lock(on));
			this.engine.emitMasterState({ locked: on });
		}
		return this.engine.sounds.filter((s) => s.sound._locked).length > 0;
	}

	duration() {
		let duration = 0;
		this.engine.sounds.forEach((s) => {
			if (s.sound.realDuration() > duration) duration = s.sound.realDuration();
		});
		return duration;
	}

	solo() {
		return this.engine.sounds.filter((s) => s.sound._solo).length > 0;
	}

	reset() {
		this.engine.sounds.forEach((s) => s.sound.reset());
		this._updateDuration();
	}

	_checkElapsed() {
		if (!this.state.playing) return this._clearElapsed();

		const elapsed = this.engine.context.currentTime - this.state.startedAt;
		const masterDur = this.duration();
		const el = masterDur > elapsed ? elapsed : masterDur;
		this.engine.emit('masterelapsed', el);
	}

	_clearElapsed() {
		clearInterval(this.elapsedInterval);
		this.engine.emitMasterState({ elapsed: 0, startedAt: 0 });
	}

	_updateDuration() {
		const dur = this.duration();
		this.engine.emitMasterState({ duration: dur });
	}
}

export default Master;