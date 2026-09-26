const reverse = (buffer: AudioBuffer): AudioBuffer => {
	for (let i = 0, c = buffer.numberOfChannels; i < c; ++i) buffer.getChannelData(i).reverse()
	return buffer
}
export default reverse
