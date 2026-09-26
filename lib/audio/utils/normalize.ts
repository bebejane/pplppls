import clamp from 'clamp'

const normalize = (buffer: Float32Array[], start?: number, end?: number): Float32Array[] => {
	const isNeg = (number: number): boolean => {
		return number === 0 && 1 / number === -Infinity
	}

	const nidx = (idx: number | null | undefined, length: number): number =>
		idx == null
			? 0
			: isNeg(idx)
				? length
				: idx <= -length
					? 0
					: idx < 0
						? length + (idx % length)
						: Math.min(length, idx)

	start = start == null ? 0 : nidx(start, buffer.length)
	end = end == null ? buffer.length : nidx(end, buffer.length)

	// for every channel bring it to max-min amplitude range
	const normalized: Float32Array[] = []
	let max = 0

	for (let c = 0; c < buffer.length; c++) {
		const data = buffer[c]

		for (let i = 0; i < data.length; i++) {
			max = Math.max(Math.abs(data[i]), max)
		}
		normalized.push(new Float32Array(buffer[c].length))
	}

	const amp = Math.max(1 / max, 1)

	for (let c = 0; c < buffer.length; c++) {
		const data = buffer[c]
		for (let i = 0; i < data.length; i++) normalized[c][i] = clamp(data[i] * amp, -1, 1)
	}
	console.log('NORMALIZED', amp, normalized.length)
	return normalized
}

export default normalize
