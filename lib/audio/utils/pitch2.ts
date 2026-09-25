import slice from './slice'
import concat from './concat'
const PaulStretch = require("./paulstretch");
const pitch2 = (buffer, steps, direction, sampleRate)=>{
	console.time('pitchtime')
	const data = [buffer.getChannelData(0), buffer.getChannelData(1)]
	const numberOfChannels = 2
	const blockSize = 4096//data[0].length
	const batchSize = 4
    const winSize = 4096 * 4
    const blocksOut = []
    
    for (var i = 0; i < batchSize; i++) {
      blocksOut.unshift([])
      for (var ch = 0; ch < numberOfChannels; ch++)
        blocksOut[0].push(new Float32Array(blockSize))
    }
	
	const paulStretch = new PaulStretch(numberOfChannels, steps, winSize)
	const blocks = [[],[]]
	for (var b = 0, i=0; b < data[0].length; b+=blockSize, i++){
		blocksOut.push([new Float32Array(blockSize), new Float32Array(blockSize)])
		const chunk = slice(data,b, (b+blockSize))
		paulStretch.write(chunk)
		
	}
	
	while(paulStretch.process() !== 0){}
	for (var i = 0; i < blocksOut.length; i++) paulStretch.read(blocksOut[i])
	
	const pitched = concat(blocksOut)
	const buff = new AudioBuffer({length:pitched[0].length, numberOfChannels:2, sampleRate:sampleRate})
	buff.copyToChannel(pitched[0],0)
	buff.copyToChannel(pitched[1],1)
	console.timeEnd('pitchtime')
    return buff;
}

export default pitch2;