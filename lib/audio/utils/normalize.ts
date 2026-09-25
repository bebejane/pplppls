import clamp from 'clamp'

const normalize = (buffer, start, end)=>{
	
	var isNeg = function (number) {
		return number === 0 && (1 / number) === -Infinity;
	};

	var nidx = function negIdx (idx, length) {
		return idx == null ? 0 : isNeg(idx) ? length : idx <= -length ? 0 : idx < 0 ? (length + (idx % length)) : Math.min(length, idx);
	}
	start = start == null ? 0 : nidx(start, buffer.length);
	end = end == null ? buffer.length : nidx(end, buffer.length);

	//for every channel bring it to max-min amplitude range
	const normalized = []
	let max = 0
	
	for (var c = 0; c < buffer.length; c++) {
		var data = buffer[c]

		for (var i =  0; i < data.length; i++) {
			max = Math.max(Math.abs(data[i]), max)
		}
		normalized.push(new Float32Array(buffer[c].length))
	}

	const amp = Math.max(1 / max, 1)

	for (var c = 0; c < buffer.length; c++) {
		var data = buffer[c]
		for (var i = 0; i < data.length; i++)
			normalized[c][i] = clamp(data[i] * amp, -1, 1)
		
	}
	console.log('NORMALIZED', amp, normalized.length)
	return normalized
}

export default normalize
