/**
 * Find the zero-crossing cut point nearest to `from`, scanning in `dir`
 * direction (1 = forward, -1 = backward) for up to `maxLook` samples.
 *
 * A crossing is an exact 0 sample, or a sign change between two consecutive
 * samples (the zero lies between them). Returns the index of the crossing
 * member CLOSEST to zero, so slicing there starts/stops on a stationary,
 * near-zero point instead of mid-cycle (no click). Returns -1 when no
 * crossing is found within the window.
 *
 * Callers treat the return value as a "retained" index:
 *   - left edge (start):  start = zc      (first sample kept = data[zc])
 *   - right edge (end):   end   = zc + 1  (last  sample kept = data[zc])
 *
 * `from` must be within [0, data.length - 1].
 */
const findZeroCrossing = (data, from, dir = 1, maxLook = 256) => {
	const n = data.length;
	if (n < 2 || from < 0 || from > n - 1) return -1;
	const limit = Math.min(maxLook, n);
	for (let i = 0; i < limit; i++) {
		const idx = from + i * dir;
		if (idx < 0 || idx > n - 2) break;
		const a = data[idx];
		const b = data[idx + 1];
		// exact zero sample: the perfect stationary point to cut at
		if (a === 0) return idx;
		if (b === 0) return idx + 1;
		// sign change between idx and idx+1: pick the member closest to zero
		if ((a > 0 && b <= 0) || (a < 0 && b >= 0))
			return Math.abs(a) <= Math.abs(b) ? idx : idx + 1;
	}
	return -1;
};

export default findZeroCrossing;