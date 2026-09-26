/**
 * Effects AudioWorklet processor source, loaded via a Blob URL by
 * `ensureEffectsWorklet` (see worklet.ts). Kept as a string — exactly like the
 * recorder worklet — because `audioWorklet.addModule` requires a JS MIME type,
 * which raw `.ts` assets don't get.
 *
 * `EFFECTS_WORKLET_SOURCE` registers one processor per effect. Each processor
 * runs the effect DSP off the main audio thread. Parameter values arrive via
 * `AudioWorkletNode.parameters` (an ordinary `AudioParam`, so the engine-side
 * `setTargetAtTime` / ramp smoothing keeps working); `pp-reverb` and
 * `pp-convolver` receive their impulse response through `port` messages.
 *
 * This file intentionally has NO imports and the template literal below must
 * not contain backticks or `${` — it is shipped verbatim to the audio thread.
 */
export const EFFECTS_WORKLET_SOURCE = `

// ---------------------------------------------------------------- helpers --

function ppv(p, i) {
	return p && p.length > 1 ? p[i] : p && p.length ? p[0] : 0;
}

// dry/wet mix levels matching Utils.getDryLevel/getWetLevel
function ppMixLevels(mix) {
	var dry = 1;
	var wet = 1;
	if (mix <= 0.5) {
		dry = 1;
		wet = 1 - (0.5 - mix) * 2;
	} else {
		wet = 1;
		dry = 1 - (mix - 0.5) * 2;
	}
	return { dry: dry, wet: wet };
}

// one-pole/T60-ish smoothing coefficient
function ppSlew(time, sr) {
	if (!(time > 0)) return 1;
	return 1 - Math.exp(-1 / (sr * time));
}

// RBJ biquad (lowpass / highpass / bandpass, constant-skirt)
function ppBiquad() {
	var a0 = 1, a1 = 0, a2 = 0, b0 = 1, b1 = 0, b2 = 0;
	var x1 = 0, x2 = 0, y1 = 0, y2 = 0;
	function set(type, f, q, sr) {
		// clamp Q up: RBJ biquads become (marginally) unstable for Q -> 0 and
		// the Filters effect defaults peak to 0.0001
		if (!(q > 0.5)) q = 0.5;
		var w0 = 2 * Math.PI * Math.max(1, f) / sr;
		var cosw = Math.cos(w0);
		var alpha = Math.sin(w0) / (2 * Math.max(0.0001, q));
		if (type === 'lowpass') {
			var half = (1 - cosw) / 2;
			b0 = half; b1 = 2 * half; b2 = half;
		} else if (type === 'highpass') {
			var hhalf = (1 + cosw) / 2;
			b0 = hhalf; b1 = -(2 * hhalf); b2 = hhalf;
		} else {
			b0 = alpha; b1 = 0; b2 = -alpha;
		}
		a0 = 1 + alpha;
		a1 = -2 * cosw;
		a2 = 1 - alpha;
		// note: do NOT reset x/y history here — set() is called every block
		// while coefficients barely change, and resetting would restart the
		// filter's transient every 128 samples (breaking DC + low-freq response)
	}
	function process(x) {
		var y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
		x2 = x1; x1 = x;
		y2 = y1; y1 = y;
		return y;
	}
	return { set: set, process: process };
}

// fractional-delay line
function ppDelayLine(maxSamples) {
	var size = maxSamples + 1;
	var buf = new Float32Array(size);
	var pos = 0;
	function write(x) {
		buf[pos] = x;
		pos += 1;
		if (pos >= size) pos = 0;
	}
	function read(d) {
		if (d < 0) d = 0;
		var r = pos - d;
		var i0 = Math.floor(r);
		var f = r - i0;
		var ia = i0 % size;
		if (ia < 0) ia += size;
		var ib = ia + 1;
		if (ib >= size) ib = 0;
		var a = buf[ia];
		var b = buf[ib];
		return a + f * (b - a);
	}
	return { write: write, read: read, size: size };
}

// iterative radix-2 complex FFT (in place, interleaved real+imag arrays)
function ppFft(n) {
	var levels = 0;
	var m = n;
	while (m > 1) { m = m >> 1; levels++; }
	var rev = new Uint32Array(n);
	for (var i = 0; i < n; i++) {
		var r = 0;
		var x = i;
		for (var k = 0; k < levels; k++) {
			r = (r << 1) | (x & 1);
			x = x >> 1;
		}
		rev[i] = r;
	}
	function transform(re, im, inv) {
		var i, j, len, len2, ang, wr, wi, cr, ci, uRe, uIm, vRe, vIm, ncr;
		for (i = 0; i < n; i++) {
			j = rev[i];
			if (j > i) {
				var tr = re[i]; re[i] = re[j]; re[j] = tr;
				var ti = im[i]; im[i] = im[j]; im[j] = ti;
			}
		}
		for (len = 2; len <= n; len = len << 1) {
			len2 = len >> 1;
			ang = (inv ? -2 : 2) * Math.PI / len;
			wr = Math.cos(ang);
			wi = Math.sin(ang);
			for (i = 0; i < n; i += len) {
				cr = 1; ci = 0;
				for (j = 0; j < len2; j++) {
					uRe = re[i + j];
					uIm = im[i + j];
					vRe = re[i + j + len2] * cr - im[i + j + len2] * ci;
					vIm = re[i + j + len2] * ci + im[i + j + len2] * cr;
					re[i + j] = uRe + vRe;
					im[i + j] = uIm + vIm;
					re[i + j + len2] = uRe - vRe;
					im[i + j + len2] = uIm - vIm;
					ncr = cr * wr - ci * wi;
					ci = cr * wi + ci * wr;
					cr = ncr;
				}
			}
		}
		if (inv) {
			for (i = 0; i < n; i++) {
				re[i] /= n;
				im[i] /= n;
			}
		}
	}
	return { transform: transform };
}

// uniform partitioned overlap-save convolution (Gardner's UPOLS), block=128,
// FFT=256, partition=128. Exact linear convolution of the stream with ir.
function ppConvolver() {
	var block = 128;
	var N = 256;
	var fft = ppFft(N);
	var H = [];
	var Xfd = [];
	var ring = new Float32Array(N);
	var timeRe = new Float32Array(N);
	var timeIm = new Float32Array(N);
	var freqRe = new Float32Array(N);
	var freqIm = new Float32Array(N);
	function setIr(ir) {
		var nBlocks = Math.max(1, Math.ceil(ir.length / block));
		H = [];
		for (var i = 0; i < nBlocks; i++) {
			timeRe.fill(0);
			timeIm.fill(0);
			var off = i * block;
			var ln = Math.min(block, ir.length - off);
			for (var s = 0; s < ln; s++) timeRe[s] = ir[off + s];
			fft.transform(timeRe, timeIm, false);
			var st = new Float32Array(N * 2);
			for (var q = 0; q < N; q++) {
				st[q * 2] = timeRe[q];
				st[q * 2 + 1] = timeIm[q];
			}
			H.push(st);
		}
		Xfd = [];
		for (i = 0; i < nBlocks; i++) Xfd.push(new Float32Array(N * 2));
		ring.fill(0);
	}
	function processBlock(inBlock, outBlock) {
		if (!H.length) {
			// no impulse loaded yet: emit silence (dry still passes through
			// the processor-level mix)
			outBlock.fill(0);
			return;
		}
		ring.copyWithin(0, block);
		ring.set(inBlock, block);
		var i, j;
		for (i = Xfd.length - 1; i >= 1; i--) Xfd[i].set(Xfd[i - 1]);
		timeRe.set(ring);
		timeIm.fill(0);
		fft.transform(timeRe, timeIm, false);
		for (i = 0; i < N; i++) {
			Xfd[0][i * 2] = timeRe[i];
			Xfd[0][i * 2 + 1] = timeIm[i];
		}
		freqRe.fill(0);
		freqIm.fill(0);
		for (i = 0; i < H.length; i++) {
			var xd = Xfd[i];
			var hc = H[i];
			for (j = 0; j < N; j++) {
				var a = xd[j * 2], b = xd[j * 2 + 1];
				var c = hc[j * 2], d = hc[j * 2 + 1];
				freqRe[j] += a * c - b * d;
				freqIm[j] += a * d + b * c;
			}
		}
		fft.transform(freqRe, freqIm, true);
		for (i = 0; i < block; i++) outBlock[i] = freqRe[block + i];
	}
	return { setIr: setIr, processBlock: processBlock };
}

// feed-forward compressor (threshold dB, ratio, knee dB, attack/release s)
function ppCompressorState() {
	var env = -120;
	return function process(x, sr, threshold, knee, ratio, attack, release) {
		var absx = Math.abs(x);
		var xdb = 20 * Math.log(Math.max(absx, 1e-9)) / Math.LN10;
		var atk = ppSlew(attack, sr);
		var rel = ppSlew(release, sr);
		if (xdb > env) env += (xdb - env) * atk;
		else env += (xdb - env) * rel;
		var over = env - threshold;
		var khalf = knee / 2;
		var g = 0;
		if (over > khalf) g = (1 / ratio - 1) * over;
		else if (over > -khalf) g = (1 / ratio - 1) * over * over / (2 * knee);
		var gain = Math.pow(10, g / 20);
		return x * gain;
	};
}

// diode saturator used by pp-ringmodulator (even function, like the shared
// WaveShaper curve: d(-v) == d(v))
function ppDiode(h, v) {
	var a = Math.abs(v);
	var vb = 0.2;
	var vl = 0.4;
	if (a <= vb) return 0;
	if (a <= vl) return h * ((a - vb) * (a - vb)) / (2 * (vl - vb));
	return h * a - h * vl + h * ((vl - vb) * (vl - vb)) / (2 * (vl - vb));
}

// distortion curve shared by pp-distortion and pp-quadrafuzz
function ppDistort(x, gain) {
	var g = gain | 0;
	if (g <= 0) return (3 * x * 20 * Math.PI / 180) / Math.PI;
	return (3 + g) * x * 20 * Math.PI / 180 / (Math.PI + g * Math.abs(x));
}

// granular pitch-shift pipeline, ported from the original "pitch-shift" module
// (frame-hop + overlap-add + scaled-grain splicing).
function ppCreateWindow(n) {
	var result = new Float32Array(n);
	for (var i = 0; i < n; i++) {
		var t = i / (n - 1);
		result[i] = 0.5 * (1 - Math.cos(2 * Math.PI * t));
	}
	return result;
}
function ppNormalizeWindow(w, hop) {
	var n = w.length;
	var nh = (n / hop) | 0;
	var scale = new Float32Array(n);
	for (var i = 0; i < n; i++) {
		var s = 0;
		for (var j = 0; j < nh; j++) s += w[(i + j * hop) % n];
		scale[i] = s;
	}
	for (i = 0; i < n; i++) w[i] /= scale[i];
}
function ppApplyWindow(out, w, frame) {
	for (var i = 0; i < frame.length; i++) out[i] = w[i] * frame[i];
}
function ppScalePitch(out, x, nx, scale, shift, w) {
	var no = out.length;
	for (var i = 0; i < no; i++) {
		var t = i * scale + shift;
		var ti = Math.floor(t);
		var tf = t - ti;
		var i0 = ((ti % nx) + nx) % nx;
		var i1 = ((ti + 1) % nx + nx) % nx;
		var v = (1 - tf) * x[i0] + tf * x[i1];
		out[i] = w[i] * v;
	}
}
function ppFindMatch(x, start, step) {
	var a = x[0], b = x[step], c = x[2 * step];
	var n = x.length;
	var bestD = 8;
	var bestI = start;
	for (var i = start; i < n - 2 * step; i++) {
		var s = x[i] - a, t = x[i + step] - b, u = x[i + 2 * step] - c;
		var d = s * s + t * t + u * u;
		if (d < bestD) {
			bestD = d;
			bestI = i;
		}
	}
	return bestI;
}
function ppFrameHop(frameSize, hopSize, onFrame, maxDataSize) {
	maxDataSize = maxDataSize || frameSize;
	var buffer = new Float32Array(2 * frameSize + maxDataSize);
	var ptr = 0;
	var frameSlices = [];
	for (var j = 0; j + frameSize <= buffer.length; j += hopSize) {
		frameSlices.push(buffer.subarray(j, j + frameSize));
	}
	return function processHopData(data) {
		var i, j, k;
		buffer.set(data, ptr);
		ptr += data.length;
		for (i = 0, j = 0; j + frameSize <= ptr; i++, j += hopSize) {
			onFrame(frameSlices[i]);
		}
		for (k = 0; j < ptr; ) {
			buffer.set(frameSlices[i], k);
			var nhops = Math.ceil((k + frameSize) / hopSize) | 0;
			var nptr = nhops * hopSize;
			if (nptr !== k + frameSize) {
				nhops -= 1;
				nptr -= hopSize;
			}
			i += nhops;
			j += nptr - k;
			k = nptr;
		}
		ptr += k - j;
	};
}
function ppOverlapAdd(frameSize, hopSize, onFrame) {
	var buffer = new Float32Array(2 * frameSize);
	var firstSlice = buffer.subarray(0, frameSize);
	var secondSlice = buffer.subarray(frameSize);
	var sptr = 0, eptr = 0;
	return function processOverlapAdd(data) {
		var n = frameSize;
		var i, j, k;
		k = eptr;
		for (i = 0, j = sptr; j < k && i < n; i++, j++) buffer[j] += data[i];
		for (; i < n; i++, j++) buffer[j] = data[i];
		sptr += hopSize;
		eptr = j;
		if (sptr >= frameSize) {
			onFrame(firstSlice);
			firstSlice.set(secondSlice);
			sptr -= frameSize;
			eptr -= frameSize;
		}
	};
}

// --------------------------------------------------------------- effects --

// Scratch silence for processors whose input has gone away: a stopped source
// leaves an EMPTY input array in some browsers (Safari), which used to mute the
// effect and cut delay/reverb tails the moment the source stopped. Feeding
// zeros keeps the processor running so feedback effects can ring out. Safe to
// share — no processor writes to its input buffers.
var ppSilence = null;
function ppSetupStereo(inputs, outputs) {
	var ip = inputs[0] || [];
	var op = outputs[0] || [];
	var outL = op[0];
	if (!outL) return null;
	var outR = op[1];
	var n = outL.length;
	var inL = (ip[0] && ip[0].length) ? ip[0] : null;
	var inR = (ip[1] && ip[1].length) ? ip[1] : inL;
	if (!inL) {
		if (!ppSilence || ppSilence.length !== n) ppSilence = new Float32Array(n);
		inL = ppSilence;
		inR = ppSilence;
	}
	return { inL: inL, inR: inR, outL: outL, outR: outR, n: n };
}

// parameter descriptor builder (name, default, min, max)
function ppDesc(list) {
	return list.map(function (d) {
		return { name: d[0], defaultValue: d[1], minValue: d[2], maxValue: d[3] };
	});
}

class PPDelayProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		var maxSamp = Math.ceil(sampleRate * 2);
		this.dlyL = ppDelayLine(maxSamp);
		this.dlyR = ppDelayLine(maxSamp);
	}
	process(inputs, outputs, parameters) {
		var s = ppSetupStereo(inputs, outputs);
		if (!s) return true;
		var fb = ppv(parameters.feedback, 0);
		var mix = ppv(parameters.mix, 0);
		var levels = ppMixLevels(mix);
		var maxDelay = this.dlyL.size - 2;
		var i;
		for (i = 0; i < s.n; i++) {
			var tSamp = Math.max(0, Math.min(maxDelay, ppv(parameters.time, i) * sampleRate));
			var dL = this.dlyL.read(tSamp);
			var dR = this.dlyR.read(tSamp);
			this.dlyL.write(s.inL[i] + fb * dL);
			this.dlyR.write(s.inR[i] + fb * dR);
			s.outL[i] = s.inL[i] * levels.dry + dL * levels.wet;
			if (s.outR) s.outR[i] = s.inR[i] * levels.dry + dR * levels.wet;
		}
		return true;
	}
}
PPDelayProcessor.parameterDescriptors = ppDesc([['feedback', 0.5, 0, 1], ['time', 0.1, 0, 2], ['mix', 0.5, 0, 1]]);
registerProcessor('pp-delay', PPDelayProcessor);

class PPDubDelayProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.dlyL = ppDelayLine(Math.ceil(sampleRate * 2));
		this.dlyR = ppDelayLine(Math.ceil(sampleRate * 2));
		this.lpL = ppBiquad();
		this.lpR = ppBiquad();
	}
	process(inputs, outputs, parameters) {
		var s = ppSetupStereo(inputs, outputs);
		if (!s) return true;
		var fb = ppv(parameters.feedback, 0);
		var mix = ppv(parameters.mix, 0);
		var cutoff = ppv(parameters.cutoff, 0);
		var levels = ppMixLevels(mix);
		var maxDelay = this.dlyL.size - 2;
		this.lpL.set('lowpass', cutoff, 1, sampleRate);
		this.lpR.set('lowpass', cutoff, 1, sampleRate);
		var i;
		for (i = 0; i < s.n; i++) {
			var tSamp = Math.max(0, Math.min(maxDelay, ppv(parameters.time, i) * sampleRate));
			var dL = this.dlyL.read(tSamp);
			var dR = this.dlyR.read(tSamp);
			var fL = this.lpL.process(fb * (s.inL[i] + dL));
			var fR = this.lpR.process(fb * (s.inR[i] + dR));
			this.dlyL.write(fL);
			this.dlyR.write(fR);
			s.outL[i] = s.inL[i] * levels.dry + (s.inL[i] + dL) * levels.wet;
			if (s.outR) s.outR[i] = s.inR[i] * levels.dry + (s.inR[i] + dR) * levels.wet;
		}
		return true;
	}
}
PPDubDelayProcessor.parameterDescriptors = ppDesc([['feedback', 0.6, 0, 1], ['time', 0.7, 0, 2], ['mix', 0.5, 0, 1], ['cutoff', 700, 0, 4000]]);
registerProcessor('pp-dubdelay', PPDubDelayProcessor);

class PPPingPongProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.dlyA = ppDelayLine(Math.ceil(sampleRate * 2));
		this.dlyB = ppDelayLine(Math.ceil(sampleRate * 2));
	}
	process(inputs, outputs, parameters) {
		var s = ppSetupStereo(inputs, outputs);
		if (!s) return true;
		var fb = ppv(parameters.feedback, 0);
		var mix = ppv(parameters.mix, 0);
		var levels = ppMixLevels(mix);
		var maxDelay = this.dlyA.size - 2;
		var i;
		for (i = 0; i < s.n; i++) {
			var tSamp = Math.max(0, Math.min(maxDelay, ppv(parameters.time, i) * sampleRate));
			// single mono chain (like the native mono node graph): the input is
			// downmixed, fed into line A, whose output feeds line B (the ping-pong)
			var m = (s.inL[i] + s.inR[i]) * 0.5;
			var a = this.dlyA.read(tSamp);
			var b = this.dlyB.read(tSamp);
			this.dlyA.write(m + fb * b);
			this.dlyB.write(a);
			s.outL[i] = s.inL[i] * levels.dry + a * levels.wet;
			if (s.outR) s.outR[i] = s.inR[i] * levels.dry + b * levels.wet;
		}
		return true;
	}
}
PPPingPongProcessor.parameterDescriptors = ppDesc([['feedback', 0.5, 0, 1], ['time', 0.3, 0, 2], ['mix', 0.5, 0, 1]]);
registerProcessor('pp-pingpongdelay', PPPingPongProcessor);

class PPFlangerProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		var maxSamp = Math.ceil(sampleRate * 0.05);
		this.dlyL = ppDelayLine(maxSamp);
		this.dlyR = ppDelayLine(maxSamp);
		this.frame = 0;
	}
	process(inputs, outputs, parameters) {
		var s = ppSetupStereo(inputs, outputs);
		if (!s) return true;
		var time = ppv(parameters.time, 0);
		var speed = ppv(parameters.speed, 0);
		var depth = ppv(parameters.depth, 0);
		var fb = ppv(parameters.feedback, 0);
		var mix = ppv(parameters.mix, 0);
		var levels = ppMixLevels(mix);
		var base = 0.001 + 0.019 * time;
		var rate = 0.5 + 4.5 * speed;
		var dep = 0.0005 + 0.0045 * depth;
		var feed = 0.8 * fb;
		var i;
		for (i = 0; i < s.n; i++) {
			var t0 = this.frame + i;
			var mod = Math.sin(2 * Math.PI * rate * t0 / sampleRate);
			var tSamp = Math.max(0, (base + dep * mod) * sampleRate);
			var dL = this.dlyL.read(tSamp);
			var dR = this.dlyR.read(tSamp);
			var inFB = s.inL[i] + feed * dL;
			this.dlyL.write(inFB);
			var inFBR = s.inR[i] + feed * dR;
			this.dlyR.write(inFBR);
			s.outL[i] = s.inL[i] * levels.dry + (inFB + dL) * levels.wet;
			if (s.outR) s.outR[i] = s.inR[i] * levels.dry + (inFBR + dR) * levels.wet;
		}
		this.frame += s.n;
		return true;
	}
}
PPFlangerProcessor.parameterDescriptors = ppDesc([['time', 0.45, 0, 1], ['speed', 0.2, 0, 1], ['depth', 0.1, 0, 1], ['feedback', 0.5, 0, 1], ['mix', 0.5, 0, 1]]);
registerProcessor('pp-flanger', PPFlangerProcessor);

class PPTremoloProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.frame = 0;
	}
	process(inputs, outputs, parameters) {
		var s = ppSetupStereo(inputs, outputs);
		if (!s) return true;
		var speed = ppv(parameters.speed, 0);
		var depth = ppv(parameters.depth, 0);
		var mix = ppv(parameters.mix, 0);
		var levels = ppMixLevels(mix);
		var i;
		for (i = 0; i < s.n; i++) {
			var t0 = this.frame + i;
			var g = (1 - depth) + depth * (0.5 * (1 + Math.sin(2 * Math.PI * speed * t0 / sampleRate)));
			s.outL[i] = s.inL[i] * levels.dry + s.inL[i] * g * levels.wet;
			if (s.outR) s.outR[i] = s.inR[i] * levels.dry + s.inR[i] * g * levels.wet;
		}
		this.frame += s.n;
		return true;
	}
}
PPTremoloProcessor.parameterDescriptors = ppDesc([['speed', 4, 0, 20], ['depth', 0.5, 0, 1], ['mix', 0.5, 0, 1]]);
registerProcessor('pp-tremolo', PPTremoloProcessor);

class PPDistortionProcessor extends AudioWorkletProcessor {
	process(inputs, outputs, parameters) {
		var s = ppSetupStereo(inputs, outputs);
		if (!s) return true;
		var gain = ppv(parameters.gain, 0) * 100;
		var i;
		for (i = 0; i < s.n; i++) {
			s.outL[i] = ppDistort(s.inL[i], gain);
			if (s.outR) s.outR[i] = ppDistort(s.inR[i], gain);
		}
		return true;
	}
}
PPDistortionProcessor.parameterDescriptors = ppDesc([['gain', 0.5, 0, 1]]);
registerProcessor('pp-distortion', PPDistortionProcessor);

class PPCompressorProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.compL = ppCompressorState();
		this.compR = ppCompressorState();
	}
	process(inputs, outputs, parameters) {
		var s = ppSetupStereo(inputs, outputs);
		if (!s) return true;
		var threshold = ppv(parameters.threshold, 0);
		var knee = ppv(parameters.knee, 0);
		var ratio = ppv(parameters.ratio, 0);
		var attack = ppv(parameters.attack, 0);
		var release = ppv(parameters.release, 0);
		var i;
		for (i = 0; i < s.n; i++) {
			s.outL[i] = this.compL(s.inL[i], sampleRate, threshold, knee, ratio, attack, release);
			if (s.outR) s.outR[i] = this.compR(s.inR[i], sampleRate, threshold, knee, ratio, attack, release);
		}
		return true;
	}
}
PPCompressorProcessor.parameterDescriptors = ppDesc([['threshold', -24, -100, 0], ['knee', 30, 0, 40], ['attack', 0, 0, 1], ['release', 0.25, 0, 1], ['ratio', 1, 0, 20]]);
registerProcessor('pp-compressor', PPCompressorProcessor);

class PPStereoPannerProcessor extends AudioWorkletProcessor {
	process(inputs, outputs, parameters) {
		var s = ppSetupStereo(inputs, outputs);
		if (!s) return true;
		var pan = ppv(parameters.pan, 0);
		var ang = (pan + 1) * Math.PI / 4;
		var gL = Math.cos(ang);
		var gR = Math.sin(ang);
		var i;
		for (i = 0; i < s.n; i++) {
			s.outL[i] = s.inL[i] * gL;
			if (s.outR) s.outR[i] = s.inR[i] * gR;
		}
		return true;
	}
}
PPStereoPannerProcessor.parameterDescriptors = ppDesc([['pan', 0, -1, 1]]);
registerProcessor('pp-stereopanner', PPStereoPannerProcessor);

function ppFilterProcess(instance, s, parameters) {
	var freq = ppv(parameters.frequency, 0);
	var peak = ppv(parameters.peak, 0);
	var i;
	instance.bqL.set(instance.type, freq, peak, sampleRate);
	instance.bqR.set(instance.type, freq, peak, sampleRate);
	for (i = 0; i < s.n; i++) {
		s.outL[i] = instance.bqL.process(s.inL[i]);
		if (s.outR) s.outR[i] = instance.bqR.process(s.inR[i]);
	}
}
class PPLowPassProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.type = 'lowpass';
		this.bqL = ppBiquad();
		this.bqR = ppBiquad();
	}
	process(inputs, outputs, parameters) {
		var s = ppSetupStereo(inputs, outputs);
		if (!s) return true;
		ppFilterProcess(this, s, parameters);
		return true;
	}
}
PPLowPassProcessor.parameterDescriptors = ppDesc([['frequency', 350, 10, 22050], ['peak', 0.0001, 0, 1000]]);
registerProcessor('pp-lowpassfilter', PPLowPassProcessor);

class PPHighPassProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.type = 'highpass';
		this.bqL = ppBiquad();
		this.bqR = ppBiquad();
	}
	process(inputs, outputs, parameters) {
		var s = ppSetupStereo(inputs, outputs);
		if (!s) return true;
		ppFilterProcess(this, s, parameters);
		return true;
	}
}
PPHighPassProcessor.parameterDescriptors = ppDesc([['frequency', 350, 10, 22050], ['peak', 0.0001, 0, 1000]]);
registerProcessor('pp-highpassfilter', PPHighPassProcessor);

class PPQuadrafuzzProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.lpL = ppBiquad();
		this.bp1L = ppBiquad();
		this.bp2L = ppBiquad();
		this.hpL = ppBiquad();
		this.lpR = ppBiquad();
		this.bp1R = ppBiquad();
		this.bp2R = ppBiquad();
		this.hpR = ppBiquad();
	}
	process(inputs, outputs, parameters) {
		var s = ppSetupStereo(inputs, outputs);
		if (!s) return true;
		var low = ppv(parameters.lowGain, 0) * 150;
		var midLow = ppv(parameters.midLowGain, 0) * 150;
		var midHigh = ppv(parameters.midHighGain, 0) * 150;
		var high = ppv(parameters.highGain, 0) * 150;
		this.lpL.set('lowpass', 147, 0.7071, sampleRate);
		this.bp1L.set('bandpass', 587, 0.7071, sampleRate);
		this.bp2L.set('bandpass', 2490, 0.7071, sampleRate);
		this.hpL.set('highpass', 4980, 0.7071, sampleRate);
		this.lpR.set('lowpass', 147, 0.7071, sampleRate);
		this.bp1R.set('bandpass', 587, 0.7071, sampleRate);
		this.bp2R.set('bandpass', 2490, 0.7071, sampleRate);
		this.hpR.set('highpass', 4980, 0.7071, sampleRate);
		var i;
		for (i = 0; i < s.n; i++) {
			var xL = s.inL[i];
			var yL = xL
				+ ppDistort(this.lpL.process(xL), low)
				+ ppDistort(this.bp1L.process(xL), midLow)
				+ ppDistort(this.bp2L.process(xL), midHigh)
				+ ppDistort(this.hpL.process(xL), high);
			s.outL[i] = yL;
			if (s.outR) {
				var xR = s.inR[i];
				s.outR[i] = xR
					+ ppDistort(this.lpR.process(xR), low)
					+ ppDistort(this.bp1R.process(xR), midLow)
					+ ppDistort(this.bp2R.process(xR), midHigh)
					+ ppDistort(this.hpR.process(xR), high);
			}
		}
		return true;
	}
}
PPQuadrafuzzProcessor.parameterDescriptors = ppDesc([['lowGain', 0.6, 0, 1], ['midLowGain', 0.8, 0, 1], ['midHighGain', 0.5, 0, 1], ['highGain', 0.6, 0, 1]]);
registerProcessor('pp-quadrafuzz', PPQuadrafuzzProcessor);

// ------------------------------------------------------- stone phaser --
//
// 4-stage analog phaser, ported from the Faust DSP in
// github.com/jpcima/stone-phaser (BSL-1.0 / CC0-1.0), itself a gray-box model
// of a real pedal following Kiiski, Esqueda & Valimaki, "Time-variant gray-box
// modeling of a phaser pedal" (DAFx-16).
//
// Mono chain, run twice for stereo:
//   x -> HPF(33 Hz) -> (+) -> allpass x4 -> out
//   feedback: out -> HPF(feedbackBassCut) * colorGain -> (+)
//
// Every control is one-pole smoothed with a 100 ms time constant (Faust
// "tsmooth"). Two things are deliberate and must not be "fixed": all four
// allpass stages share a single coefficient, and that coefficient is Faust's
// approximation a = -1 + 2*PI*f/SR rather than the textbook tan() form.
//
// The recurrences below are a direct transcription of the Faust-generated C++
// (plugins/stone-phaser/gen/StonePhaserDsp.cpp) -- note that the right channel
// of the stereo build is the same mono phaser with the LFO phase offset by the
// (smoothed) "phase" control.
function ppHzToMidi(f) {
	return 69 + 12 * Math.log2(f / 440);
}
// Faust "sineTri"(0.95, pos) wavetable: a rounded triangle, 1 at pos 0
// dipping to ~0 at pos 0.5. Faust uses a 128-entry rdtable + linear
// interpolation; kept here so the sweep matches sample for sample.
function ppPhaserTriTable() {
	var n = 128;
	var a = 0.975;
	var asin = Math.asin(a);
	var t = new Float32Array(n);
	for (var i = 0; i < n; i++) {
		var x = i / n;
		t[i] = 1 - Math.sin(2 * (x < 0.5 ? x : 1 - x) * asin) / a;
	}
	return t;
}
function ppPhaserState() {
	return { hp: 0, fbp: 0, r5: 0, r4: 0, r3: 0, r2: 0, r1: 0 };
}
// one sample of the mono phaser; st is per-channel, the rest are shared
// per-sample coefficients
function ppPhaserSample(st, x, p33, hpGain, pfb, fbGain, colorGain, a) {
	var hp1 = st.hp;
	st.hp = x + p33 * hp1;
	var inHpf = hpGain * (st.hp - hp1);
	var fbp1 = st.fbp;
	st.fbp = st.r1 + pfb * fbp1;
	var inFb = colorGain * fbGain * (st.fbp - fbp1);
	var p5 = st.r5, p4 = st.r4, p3 = st.r3, p2 = st.r2;
	st.r5 = inHpf + inFb - a * p5;
	st.r4 = p5 + a * (st.r5 - p4);
	st.r3 = p4 + a * (st.r4 - p3);
	st.r2 = p3 + a * (st.r3 - p2);
	// fourth allpass output; note there is deliberately NO recursive term here
	// (Faust: "fRec1[i] = fRec2[i-1] + fRec2[i] * a") -- adding one turns the
	// wet path into a resonant one-pole cascade instead of an allpass
	st.r1 = p2 + a * st.r2;
	return st.r1;
}
function ppPhaserCoef(tbl, loKey, hiKey, pos, sr, c8, kl) {
	var fidx = 128 * pos;
	var i0 = fidx | 0;
	var fr = fidx - i0;
	var t0 = tbl[i0];
	var t1 = tbl[(i0 + 1) & 127];
	var key = loKey + (hiKey - loKey) * (t0 + (t1 - t0) * fr);
	// a = -1 + 2*PI*f/SR, f = midikey2hz(key)
	var a = c8 * Math.exp(kl * (key - 69)) - 1;
	// keep every pole (-a) inside the unit circle; only reachable below
	// ~11.5 kHz sample rate, where the pedal itself would blow up
	if (a > 0.999) a = 0.999;
	else if (a < -0.999) a = -0.999;
	return a;
}
// one-pole smoother in Faust's "si.smooth(tau2pole(0.1))" form: the state is
// seeded with its target so the effect does not fade in on start
function ppSmoother(init, pole) {
	var s = init;
	return function (target) {
		s = (1 - pole) * target + pole * s;
		return s;
	};
}

class PPStonePhaserProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.tbl = ppPhaserTriTable();
		this.stL = ppPhaserState();
		this.stR = ppPhaserState();
		this.p33 = Math.exp(-6.283185307179586 * 33 / sampleRate);
		this.hpGain = 0.5 * (1 + this.p33);
		this.c8 = 2764.6015655503763 / sampleRate; // 2*PI*440 / SR
		this.kl = 0.05776226504666211; // ln(2)/12
		this.MIDI_LO_COLOR = ppHzToMidi(80);
		this.MIDI_HI_COLOR = ppHzToMidi(2200);
		this.MIDI_LO_PLAIN = ppHzToMidi(300);
		this.MIDI_HI_PLAIN = ppHzToMidi(6000);
		var pole = 1 - ppSlew(0.1, sampleRate);
		// seeded with the parameter defaults (see ppDesc below)
		this.smLf = ppSmoother(0.2, pole);
		this.smFb = ppSmoother(0.01 * 0.75, pole);
		this.smColorFb = ppSmoother(0.01 * 0.75, pole);
		this.smFbCut = ppSmoother(500, pole);
		this.smW = ppSmoother(Math.sin(0.5 * Math.PI / 2), pole);
		this.smD = ppSmoother(Math.cos(0.5 * Math.PI / 2), pole);
		this.smPhase = ppSmoother(1, pole);
		this.smLo = ppSmoother(this.MIDI_LO_COLOR, pole);
		this.smHi = ppSmoother(this.MIDI_HI_COLOR, pole);
		this.phaseL = 0;
		this.phaseR = 0;
	}
	process(inputs, outputs, parameters) {
		var s = ppSetupStereo(inputs, outputs);
		if (!s) return true;
		var fb = ppv(parameters.feedback, 0);
		var mix = ppv(parameters.mix, 0);
		var fbCut = ppv(parameters.feedbackBassCut, 0);
		var color = ppv(parameters.color, 0) >= 0.5;
		var phase = ppv(parameters.phase, 0);
		// block-constant targets, smoothed per sample below
		var tgtLf = ppv(parameters.speed, 0);
		var tgtFb = 0.01 * fb;
		var tgtMixF = mix * Math.PI / 2;
		var tgtW = Math.sin(tgtMixF);
		var tgtD = Math.cos(tgtMixF);
		var tgtPhase = 1 + phase / 360;
		var tgtLo = color ? this.MIDI_LO_COLOR : this.MIDI_LO_PLAIN;
		var tgtHi = color ? this.MIDI_HI_COLOR : this.MIDI_HI_PLAIN;
		var tbl = this.tbl;
		var c8 = this.c8;
		var kl = this.kl;
		var p33 = this.p33;
		var hpGain = this.hpGain;
		var i;
		for (i = 0; i < s.n; i++) {
			var lf = this.smLf(tgtLf);
			var fbBase = this.smFb(tgtFb);
			var colorGain = this.smColorFb(color ? fbBase : 0.1 * fbBase);
			var fbCutS = this.smFbCut(fbCut);
			var w = this.smW(tgtW);
			var d = this.smD(tgtD);
			var loKey = this.smLo(tgtLo);
			var hiKey = this.smHi(tgtHi);
			var pfb = Math.exp(-6.283185307179586 * fbCutS / sampleRate);
			var fbGain = 0.5 * (1 + pfb);
			this.phaseL += lf / sampleRate;
			if (this.phaseL >= 1) this.phaseL -= Math.floor(this.phaseL);
			var phR = this.phaseL + this.smPhase(tgtPhase);
			phR -= Math.floor(phR);
			var aL = ppPhaserCoef(tbl, loKey, hiKey, this.phaseL, sampleRate, c8, kl);
			var aR = ppPhaserCoef(tbl, loKey, hiKey, phR, sampleRate, c8, kl);
			var xL = s.inL[i];
			var yL = ppPhaserSample(this.stL, xL, p33, hpGain, pfb, fbGain, colorGain, aL);
			s.outL[i] = xL * d + yL * w;
			if (s.outR) {
				var xR = s.inR[i];
				var yR = ppPhaserSample(this.stR, xR, p33, hpGain, pfb, fbGain, colorGain, aR);
				s.outR[i] = xR * d + yR * w;
			}
		}
		return true;
	}
}
PPStonePhaserProcessor.parameterDescriptors = ppDesc([
	['speed', 0.2, 0.01, 5],
	['feedback', 0.75, 0, 0.99],
	['feedbackBassCut', 500, 10, 5000],
	['mix', 0.5, 0, 1],
	['color', 1, 0, 1],
	['phase', 0, -180, 180],
]);
registerProcessor('pp-stonephaser', PPStonePhaserProcessor);

class PPRingModulatorProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.frame = 0;
		this.compL = ppCompressorState();
		this.compR = ppCompressorState();
	}
	process(inputs, outputs, parameters) {
		var s = ppSetupStereo(inputs, outputs);
		if (!s) return true;
		var speed = Math.max(0.001, ppv(parameters.speed, 0));
		var h = ppv(parameters.distortion, 0);
		var mix = ppv(parameters.mix, 0);
		var levels = ppMixLevels(mix);
		var i;
		for (i = 0; i < s.n; i++) {
			var t0 = this.frame + i;
			var c = Math.sin(2 * Math.PI * speed * t0 / sampleRate);
			var g = 0.5 * c;
			var carrier = -(ppDiode(h, g) + ppDiode(h, -g));
			var wL = this.compL(
				carrier + ppDiode(h, g + s.inL[i]) + ppDiode(h, -(g + s.inL[i])),
				sampleRate, -24, 30, 16, 0.003, 0.25,
			) * 3;
			s.outL[i] = s.inL[i] * levels.dry + wL * levels.wet;
			if (s.outR) {
				var wR = this.compR(
					carrier + ppDiode(h, g + s.inR[i]) + ppDiode(h, -(g + s.inR[i])),
					sampleRate, -24, 30, 16, 0.003, 0.25,
				) * 3;
				s.outR[i] = s.inR[i] * levels.dry + wR * levels.wet;
			}
		}
		this.frame += s.n;
		return true;
	}
}
PPRingModulatorProcessor.parameterDescriptors = ppDesc([['speed', 30, 0, 2000], ['distortion', 0.2, 0.2, 50], ['mix', 0.5, 0, 1]]);
registerProcessor('pp-ringmodulator', PPRingModulatorProcessor);

class PPConvolverProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.convL = ppConvolver();
		this.convR = null;
		this.pending = null;
		this.port.onmessage = function (e) {
			if (e.data && e.data.type === 'ir') {
				var ch = e.data.channels || [];
				if (!this.convR && ch.length > 1) this.convR = ppConvolver();
				this.convL.setIr(ch[0] || new Float32Array(1));
				if (this.convR) this.convR.setIr(ch[1] || ch[0] || new Float32Array(1));
			}
		}.bind(this);
	}
	process(inputs, outputs, parameters) {
		var s = ppSetupStereo(inputs, outputs);
		if (!s) return true;
		var mix = ppv(parameters.mix, 0);
		var levels = ppMixLevels(mix);
		this.convL.processBlock(s.inL, s.outL);
		var i;
		for (i = 0; i < s.n; i++) s.outL[i] = s.inL[i] * levels.dry + s.outL[i] * levels.wet;
		if (s.outR) {
			if (this.convR) {
				this.convR.processBlock(s.inR, s.outR);
				for (i = 0; i < s.n; i++) s.outR[i] = s.inR[i] * levels.dry + s.outR[i] * levels.wet;
			} else {
				for (i = 0; i < s.n; i++) s.outR[i] = s.inR[i] * levels.dry + s.inR[i] * levels.wet;
			}
		}
		return true;
	}
}
PPConvolverProcessor.parameterDescriptors = ppDesc([['mix', 0.5, 0, 1]]);
registerProcessor('pp-convolver', PPConvolverProcessor);

class PPReverbProcessor extends PPConvolverProcessor {
	constructor() {
		super();
	}
}
PPReverbProcessor.parameterDescriptors = ppDesc([['mix', 0.5, 0, 1]]);
registerProcessor('pp-reverb', PPReverbProcessor);

class PPPitchShiftProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		var frameSize = 512;
		var hopSize = 128;
		this.frameSize = frameSize;
		this.hopSize = hopSize;
		this.aWindow = ppCreateWindow(frameSize);
		var sWindow = ppCreateWindow(frameSize);
		ppNormalizeWindow(sWindow, hopSize);
		this.sWindow = sWindow;
		this.cur = new Float32Array(frameSize);
		this.t = 0;
		this.delay = 0;
		this.shiftOffset = 1.0;
		this.chunks = [];
		this.chunkIdx = 0;
		this.chunkPos = 0;
		var self = this;
		this.addFrame = ppOverlapAdd(frameSize, hopSize, function (slice) {
			self.chunks.push(new Float32Array(slice));
		});
		this.hop = ppFrameHop(frameSize, hopSize, function (frame) {
			self.pitch(frame);
		}, frameSize);
		var silence = new Float32Array(frameSize);
		for (var i = 0; i < 6; i++) this.hop(silence);
	}
	pitch(frame) {
		var hop = this.hopSize;
		ppApplyWindow(this.cur, this.aWindow, frame);
		var scaleF = this.shiftOffset;
		var fsize = (frame.length >> 1) | 0;
		fsize = ppFindMatch(frame, fsize, 1);
		this.delay = ((this.delay % fsize) + fsize) % fsize;
		ppScalePitch(this.cur, frame, fsize, scaleF, this.delay, this.sWindow);
		this.delay += hop * (scaleF - 1);
		this.t += hop;
		this.addFrame(this.cur);
	}
	next() {
		while (this.chunkIdx >= this.chunks.length) return 0;
		if (this.chunkPos >= this.chunks[this.chunkIdx].length) {
			this.chunkIdx++;
			this.chunkPos = 0;
			if (this.chunkIdx >= this.chunks.length) return 0;
		}
		var v = this.chunks[this.chunkIdx][this.chunkPos++];
		if (this.chunkPos >= this.chunks[this.chunkIdx].length) {
			this.chunkIdx++;
			this.chunkPos = 0;
		}
		return v;
	}
	process(inputs, outputs, parameters) {
		var p = parameters.pitchShift;
		if (p && p.length) this.shiftOffset = p[p.length - 1];
		var s = ppSetupStereo(inputs, outputs);
		if (!s) return true;
		var inL = s.inL;
		if (inL.length) this.hop(inL.subarray(0));
		var i;
		for (i = 0; i < s.n; i++) {
			var v = this.next();
			s.outL[i] = v;
			if (s.outR) s.outR[i] = v;
		}
		return true;
	}
}
PPPitchShiftProcessor.parameterDescriptors = ppDesc([['pitchShift', 1, 0.25, 4]]);
registerProcessor('pp-pitchshift', PPPitchShiftProcessor);
`;