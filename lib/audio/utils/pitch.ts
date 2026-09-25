import slice from './slice'
const PitchShifter = require("pitch-shift");
const pitch = (buffer, opt={steps:1, direction:'up'})=>{
	let transposedData = new Array(buffer.numberOfChannels);
    const numSteps = opt.direction === "up" ? opt.steps : -opt.steps;
    
    for (let i = 0; i < buffer.numberOfChannels; i++) {
        const channelData = buffer.getChannelData(i);
        const transposedChannel = new Float32Array(channelData.length);
        const frame_size = 512
        let pointer = 0;
        const shifter = new PitchShifter(
            function onData(frame) {
                transposedChannel.set(frame, pointer);
                pointer += frame.length;
                
            },
            function onTune(t, pitch) {
                return Math.pow(2, numSteps / 12);
            }
        );

        for (let j = 0; j + frame_size < channelData.length; j += frame_size)
            shifter(channelData.subarray(j, j + frame_size));
        
        transposedData[i] = transposedChannel;
    }
    buffer.copyToChannel(transposedData[0], 0)
    if(buffer.numberOfChannels > 1)
        buffer.copyToChannel(transposedData[1], 1)
    console.timeEnd('pitchconvert')
    return buffer;
}

export default pitch;