const concat = (buffers)=>{
	let length = 0;
	for (var i = 0; i < buffers.length; i++)
		length += buffers[i][0].length
	
	const buff = [new Float32Array(length), new Float32Array(length)]

	for (var i = 0, pos = 0; i < buffers.length; i++) {
		const b = buffers[i]
		for (var c = 0; c < b.length; c++){
			const chan = b[c]
			for (var x = 0; x < chan.length; x++, pos++)
				buff[c][pos] = chan[x]
			pos = pos - chan.length

		}
	}
	return buff;
}
export default concat