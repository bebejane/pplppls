const reverse = (buffer)=>{
	
	for (var i = 0, c = buffer.numberOfChannels; i < c; ++i)
		buffer.getChannelData(i).reverse();
	return buffer
}
export default reverse;