// Offline DSP harness for the effects AudioWorklet source. Runs each processor
// in a simulated audio-thread environment and asserts behavior.
import { EFFECTS_WORKLET_SOURCE } from './lib/audio/effects/workletSource.ts';

const SR = 44100;
const BLOCK = 128;

globalThis.AudioWorkletProcessor = class {
	constructor() {
		this.port = {
			postMessage: () => {},
		};
	}
};
globalThis.sampleRate = SR;
globalThis.currentTime = 0;
globalThis.currentFrame = 0;
globalThis.registerProcessor = (name, cls) => {
	registered[name] = cls;
};

const registered = {};
new Function(EFFECTS_WORKLET_SOURCE)();
const names = Object.keys(registered);
console.log('registered processors:', names.length);

let failures = 0;
const check = (label, cond, extra = '') => {
	if (cond) console.log('  ok  -', label);
	else {
		failures++;
		console.log('  FAIL-', label, extra);
	}
};

// -- driver ----------------------------------------------------------------
function makeProc(name, params = {}) {
	const proc = new registered[name]();
	const p = { ...params };
	const chunks = [];
	const run = (inL, inR) => {
		const L = new Float32Array(BLOCK);
		const R = new Float32Array(BLOCK);
		if (inL) L.set(inL);
		if (inR) R.set(inR);
		const outL = new Float32Array(BLOCK);
		const outR = new Float32Array(BLOCK);
		const paramsObj = {};
		for (const k of Object.keys(p)) {
			paramsObj[k] = p[k] instanceof Float32Array ? p[k] : Float32Array.from([p[k]]);
		}
		proc.process([[L, R], []], [[outL, outR], []], paramsObj);
		chunks.push([Float32Array.from(outL), Float32Array.from(outR)]);
		return [outL, outR];
	};
	const drain = () => {
		const n = chunks.length * BLOCK;
		const L = new Float32Array(n);
		const R = new Float32Array(n);
		chunks.forEach((c, i) => {
			L.set(c[0], i * BLOCK);
			R.set(c[1], i * BLOCK);
		});
		return { L, R };
	};
	return { proc, run, drain, set: (k, v) => (p[k] = v) };
}
function sine(freq, amp = 1, n = SR) {
	const a = new Float32Array(n);
	for (let i = 0; i < n; i++) a[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
	return a;
}
function impulse(n = SR) {
	const a = new Float32Array(n);
	a[0] = 1;
	return a;
}
// Naive DFT magnitude at a single frequency
function dftBin(x, freq, start = 0, len = 8192) {
	let re = 0;
	let im = 0;
	for (let i = 0; i < len; i++) {
		const v = x[start + i] || 0;
		const ph = (2 * Math.PI * freq * i) / SR;
		re += v * Math.cos(ph);
		im -= v * Math.sin(ph);
	}
	return Math.sqrt(re * re + im * im);
}
function maxIdx(x) {
	let m = -1;
	let idx = 0;
	for (let i = 0; i < x.length; i++) {
		if (Math.abs(x[i]) > m) {
			m = Math.abs(x[i]);
			idx = i;
		}
	}
	return { m, idx };
}

// -- pp-delay --------------------------------------------------------------
console.log('\npp-delay');
{
	const d = makeProc('pp-delay', { feedback: 0, time: 0.1, mix: 0.5 });
	const blocks = 100; // 12800 samples > 4410 delay
	for (let b = 0; b < blocks; b++) {
		const buf = new Float32Array(BLOCK);
		if (b === 0) buf[0] = 1;
		d.run(buf);
	}
	const { L } = d.drain();
	const { m, idx } = maxIdx(L.subarray(100, 12800));
	check('delayed impulse ~4410 samples', Math.abs(idx + 100 - 4410) <= 1, `idx=${idx + 100} m=${m.toFixed(3)}`);
	check('dry impulse preserved', Math.abs(L[0] - 1) < 1e-6, `L[0]=${L[0]}`);
	check('finite', Number.isFinite(L.reduce((a, v) => a + Math.abs(v), 0)));
}

// -- pp-stereopanner -------------------------------------------------------
console.log('\npp-stereopanner');
{
	const d = makeProc('pp-stereopanner', { pan: -1 });
	const s = sine(220, 0.8, BLOCK * 8);
	for (let b = 0; b < 8; b++) d.run(s.subarray(b * BLOCK, (b + 1) * BLOCK), s.subarray(b * BLOCK, (b + 1) * BLOCK));
	const { L, R } = d.drain();
	check('pan=-1 => left full', maxIdx(L).m > 0.75, `L=${maxIdx(L).m.toFixed(3)}`);
	check('pan=-1 => right silent', maxIdx(R).m < 1e-6, `R=${maxIdx(R).m.toFixed(3)}`);
	const d2 = makeProc('pp-stereopanner', { pan: 1 });
	for (let b = 0; b < 8; b++) d2.run(s.subarray(b * BLOCK, (b + 1) * BLOCK), s.subarray(b * BLOCK, (b + 1) * BLOCK));
	const r2 = d2.drain();
	check('pan=1 => right full', maxIdx(r2.R).m > 0.75, `R=${maxIdx(r2.R).m.toFixed(3)}`);
	check('pan=1 => left silent', maxIdx(r2.L).m < 1e-6);
}

// -- pp-tremolo ------------------------------------------------------------
console.log('\npp-tremolo');
{
	const d = makeProc('pp-tremolo', { speed: 20, depth: 1, mix: 0.5 });
	const one = new Float32Array(BLOCK).fill(1);
	const outs = [];
	for (let b = 0; b < 40; b++) {
		const [oL] = d.run(one);
		outs.push(...oL);
	}
	const mn = Math.min(...outs);
	const mx = Math.max(...outs);
	// depth=1, mix=0.5 -> output = x*(1+g) with g in [0,1] (native shaper range)
	check('amplitude modulated 1..2', Math.abs(mn - 1) < 0.05 && Math.abs(mx - 2) < 0.05, `min=${mn.toFixed(2)} max=${mx.toFixed(2)}`);
}

// -- pp-lowpassfilter ------------------------------------------------------
console.log('\npp-lowpassfilter');
{
	const d = makeProc('pp-lowpassfilter', { frequency: 100, peak: 0.0001 });
	const dc = new Float32Array(BLOCK).fill(1);
	const outDC = [];
	for (let b = 0; b < 10; b++) {
		const [o] = d.run(dc);
		outDC.push(...o);
	}
	const dcg = outDC.slice(500, 1000).reduce((a, v) => a + v, 0) / 500;
	check('DC passes' , Math.abs(dcg - 1) < 0.05, `dcg=${dcg.toFixed(3)}`);
	const hi = sine(4400, 1, BLOCK * 10);
	const outHi = [];
	for (let b = 0; b < 10; b++) {
		const [o] = d.run(hi.subarray(b * BLOCK, (b + 1) * BLOCK));
		outHi.push(...o);
	}
	const hiPeak = maxIdx(Float32Array.from(outHi.slice(BLOCK * 5, BLOCK * 10))).m; // steady region
	check('4.4k attenuated at 100Hz cutoff', hiPeak < 0.15, `peak=${hiPeak.toFixed(4)}`);
}

// -- pp-distortion ---------------------------------------------------------
console.log('\npp-distortion');
{
	const d = makeProc('pp-distortion', { gain: 0 });
	const s = sine(200, 0.9, BLOCK * 8);
	for (let b = 0; b < 8; b++) d.run(s.subarray(b * BLOCK, (b + 1) * BLOCK));
	const { L } = d.drain();
	const p0 = maxIdx(L).m;
	check('gain=0 => x/3 curve', Math.abs(p0 - 0.3) < 0.02, `peak=${p0.toFixed(3)}`);
	const d2 = makeProc('pp-distortion', { gain: 1 });
	for (let b = 0; b < 8; b++) d2.run(s.subarray(b * BLOCK, (b + 1) * BLOCK));
	const q = d2.drain();
	const p1 = maxIdx(q.L).m;
	check('gain=1 => hotter/nonzero', p1 > p0 && p1 > 0.3, `peak=${p1.toFixed(3)}`);
}

// -- pp-compressor ---------------------------------------------------------
console.log('\npp-compressor');
{
	const d = makeProc('pp-compressor', { threshold: -24, knee: 30, attack: 0, release: 0.25, ratio: 20 });
	const s = sine(220, 1, BLOCK * 16);
	for (let b = 0; b < 16; b++) d.run(s.subarray(b * BLOCK, (b + 1) * BLOCK));
	const { L } = d.drain();
	const steady = maxIdx(L.subarray(BLOCK * 8, BLOCK * 16)).m;
	check('loud input compressed hard', steady < 0.15, `steady peak=${steady.toFixed(4)}`);
	const d2 = makeProc('pp-compressor', { threshold: -24, knee: 30, attack: 0, release: 0.25, ratio: 1 });
	for (let b = 0; b < 16; b++) d2.run(s.subarray(b * BLOCK, (b + 1) * BLOCK));
	const q = d2.drain();
	const flat = maxIdx(q.L.subarray(BLOCK * 8, BLOCK * 16)).m;
	check('ratio=1 => unity', Math.abs(flat - 1) < 0.02, `peak=${flat.toFixed(3)}`);
}

// -- pp-flanger ------------------------------------------------------------
console.log('\npp-flanger');
{
	const d = makeProc('pp-flanger', { time: 0.5, speed: 0.2, depth: 0.5, feedback: 0.5, mix: 0.5 });
	const s = sine(400, 0.8, BLOCK * 40);
	for (let b = 0; b < 40; b++) d.run(s.subarray(b * BLOCK, (b + 1) * BLOCK));
	const { L } = d.drain();
	const m = maxIdx(L);
	check('no NaN', Number.isFinite(m.m));
	check('produces output', m.m > 0.1, `peak=${m.m.toFixed(3)}`);
	const env = [];
	for (let i = 0; i < L.length; i += 64) {
		let s2 = 0;
		for (let j = 0; j < 64; j++) s2 += L[i + j] * L[i + j];
		env.push(Math.sqrt(s2 / 64));
	}
	const envMin = Math.min(...env);
	const envMax = Math.max(...env);
	check('swirling envelope (varies)', envMax > envMin * 1.5, `envMax=${envMax.toFixed(2)} envMin=${envMin.toFixed(2)}`);
}

// -- pp-pingpongdelay ------------------------------------------------------
console.log('\npp-pingpongdelay');
{
	const d = makeProc('pp-pingpongdelay', { feedback: 0.5, time: 0.3, mix: 0.5 });
	const blocks = 300; // 38400 samples; delay=13230
	for (let b = 0; b < blocks; b++) {
		const buf = new Float32Array(BLOCK);
		if (b === 0) buf[0] = 1;
		d.run(buf);
	}
	const { L, R } = d.drain();
	const l1 = maxIdx(L.subarray(BLOCK * 100, BLOCK * 130)); // around 12800-16640
	const r1 = maxIdx(R.subarray(BLOCK * 200, BLOCK * 260)); // around 25600-33280
	check('first tap on L', Math.abs(l1.idx + BLOCK * 100 - 13230) < 40, `L idx≈${l1.idx + BLOCK * 100}`);
	check('first R tap after ~2x delay', Math.abs(r1.idx + BLOCK * 200 - 26460) < 80, `R idx≈${r1.idx + BLOCK * 200}`);
	check('R tap nonzero', r1.m > 0.3, `m=${r1.m.toFixed(3)}`);
}

// -- pp-quadrafuzz ---------------------------------------------------------
console.log('\npp-quadrafuzz');
{
	const d = makeProc('pp-quadrafuzz', {
		lowGain: 0, midLowGain: 0, midHighGain: 0, highGain: 0,
	});
	const s = sine(100, 0.8, BLOCK * 8);
	for (let b = 0; b < 8; b++) d.run(s.subarray(b * BLOCK, (b + 1) * BLOCK));
	const { L } = d.drain();
	const peak = maxIdx(L.subarray(BLOCK * 2, BLOCK * 8)).m;
	// dry + low band (147Hz lowpass passes 100Hz): ~ x*(1+1/3)
	check('dry + lowband', peak > 0.8 && peak < 1.3, `peak=${peak.toFixed(3)}`);
}

// -- pp-ringmodulator ------------------------------------------------------
console.log('\npp-ringmodulator');
{
	const d = makeProc('pp-ringmodulator', { speed: 30, distortion: 0.2, mix: 0.5 });
	const n = SR; // 1 second
	const s = sine(100, 0.8, n);
	const sig = new Float32Array(Math.ceil(n / BLOCK) * BLOCK + BLOCK);
	for (let b = 0; b < Math.ceil(n / BLOCK); b++) {
		const [o] = d.run(s.subarray(b * BLOCK, (b + 1) * BLOCK));
		sig.set(o, b * BLOCK);
	}
	const skip = BLOCK * 8;
	const at = (f) => dftBin(sig, f, skip, 16384);
	const a100 = at(100);
	const side = Math.max(at(70), at(130));
	check('sidebands present (ring modulation)', side > a100 * 0.25, `|100|=${a100.toFixed(1)} side=${side.toFixed(1)}`);
}

// -- pp-reverb (convolution) -----------------------------------------------
console.log('\npp-reverb / pp-convolver');
{
	// deterministic "IR": two taps; mix=1 => wet only (all-pass dry removed)
	const ir = new Float32Array(512);
	ir[0] = 1;
	ir[200] = 0.5;
	const d = makeProc('pp-reverb', { mix: 1 });
	d.proc.port.onmessage({ data: { type: 'ir', channels: [ir, ir] } });
	const imp = impulse();
	const out = new Float32Array(512 * 4);
	for (let b = 0; b < 16; b++) {
		const [oL] = d.run(imp.subarray(b * BLOCK, (b + 1) * BLOCK));
		out.set(oL, b * BLOCK);
	}
	check('convolution reproduces IR taps', Math.abs(out[200] - 0.5) < 0.05 && Math.abs(out[0] - 1) < 0.05,
		`out[0]=${out[0].toFixed(3)} out[200]=${out[200].toFixed(3)}`);
	check('no NaN', out.every((v) => Number.isFinite(v)));

	// delay-by-128 with delta IR
	const d2 = makeProc('pp-convolver', { mix: 1 });
	d2.proc.port.onmessage({ data: { type: 'ir', channels: [new Float32Array([1])] } });
	const ramp = new Float32Array(BLOCK * 8);
	for (let i = 0; i < ramp.length; i++) ramp[i] = (i % 37) - 18;
	const o2 = new Float32Array(ramp.length + BLOCK);
	for (let b = 0; b < 9; b++) {
		const [oL] = d2.run(ramp.subarray(b * BLOCK, (b + 1) * BLOCK));
		o2.set(oL, b * BLOCK);
	}
	// delta IR => zero-latency passthrough (convolver partitions the IR but the
	// first tap lands immediately, as the two-tap IR test above confirms)
	let corr = true;
	for (let i = 0; i < o2.length - BLOCK; i += 7) {
		if (Math.abs(o2[i] - ramp[i]) > 0.01) corr = false;
	}
	check('delta IR => passthrough', corr);
}

// -- pp-pitchshift ---------------------------------------------------------
console.log('\npp-pitchshift');
{
	const up = makeProc('pp-pitchshift', { pitchShift: 1 });
	const n = SR * 2;
	const s = sine(440, 0.9, n);
	const out = new Float32Array(Math.ceil(n / BLOCK) * BLOCK);
	for (let b = 0; b < Math.ceil(n / BLOCK); b++) {
		const [oL] = up.run(s.subarray(b * BLOCK, (b + 1) * BLOCK));
		out.set(oL, b * BLOCK);
	}
	const start = Math.floor(BLOCK * 20); // skip latency
	const a440 = dftBin(out, 440, start, 32768);
	const a880 = dftBin(out, 880, start, 32768);
	check('unity shift keeps 440 dominant', a440 > a880 * 3, `|440|=${a440.toFixed(0)} |880|=${a880.toFixed(0)}`);

	const up2 = makeProc('pp-pitchshift', { pitchShift: 2 });
	const out2 = new Float32Array(Math.ceil(n / BLOCK) * BLOCK);
	for (let b = 0; b < Math.ceil(n / BLOCK); b++) {
		const [oL] = up2.run(s.subarray(b * BLOCK, (b + 1) * BLOCK));
		out2.set(oL, b * BLOCK);
	}
	const b440 = dftBin(out2, 440, start, 32768);
	const b880 = dftBin(out2, 880, start, 32768);
	check('shift=2 => 880 dominant', b880 > b440 * 3, `|440|=${b440.toFixed(0)} |880|=${b880.toFixed(0)}`);
}

// -- all processors: silence + noise smoke, no NaN/crash -------------------
console.log('\nsmoke (all processors)');
{
	for (const name of names) {
		try {
			const d = makeProc(name);
			const noise = new Float32Array(BLOCK).fill(0.1);
			for (let b = 0; b < 4; b++) d.run(noise);
			const { L, R } = d.drain();
			const nan = [...L, ...R].some((v) => Number.isNaN(v) || !Number.isFinite(v));
			check(name + ' runs clean', !nan);
		} catch (e) {
			check(name + ' runs clean', false, 'THREW: ' + e.message);
		}
	}
}

console.log('\n' + (failures === 0 ? 'ALL DSP CHECKS PASSED' : failures + ' CHECKS FAILED'));
process.exit(failures === 0 ? 0 : 1);