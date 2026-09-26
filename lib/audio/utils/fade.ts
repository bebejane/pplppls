const fade = (buffer: Float32Array[], ms: number, sampleRate = 44100): Float32Array[] => {
	return buffer
	ms = 1000
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

	for (let c = 0; c < buffer.length; c++) {
		const data = buffer[c]
		const samples = ms * (44100 / 1000)
		const level = data[samples]
		const amp = level / samples
		console.log('fade', samples, level, amp)
		const fadeFrameCount = samples
		const ascending = false

		for (let i = 0; i < fadeFrameCount; i++) {
			const currentFrameFadePercentage = (i - 0) / fadeFrameCount
			data[i] = ascending
				? data[i] * currentFrameFadePercentage
				: data[i] * (1 - currentFrameFadePercentage)
			if (i < 100) console.log(data[i])
		}
	}
	return buffer
}

export default fade
