const copy = (buffer)=>{
	const buff = [new Float32Array(buffer[0].length), new Float32Array(buffer[1].length)]
	for (var c = 0; c < buffer.length; c++) {
		var data = buffer[c]
		for (var i = 0; i < data.length; i++){
			buff[c][i] = data[i]
		}
	}
	return buff;
}
export default copy