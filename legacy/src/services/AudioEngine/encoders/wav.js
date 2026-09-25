const wavEncoder = (buffer, opt = { sampleRate: 44100, numChannels: 2 }) => {
    
    return new Promise((resolve, reject)=>{
        try{
            const blob = encodeWAV(buffer, opt)
            resolve(blob)
        }catch(err){
            reject(err)
        }
    })

    function interleave(inputL, inputR) {
        let length = inputL.length + inputR.length;
        let result = new Float32Array(length);

        let index = 0,
            inputIndex = 0;

        while (index < length) {
            result[index++] = inputL[inputIndex];
            result[index++] = inputR[inputIndex];
            inputIndex++;
        }
        return result;
    }
    function floatTo16BitPCM(output, offset, input) {
        for (let i = 0; i < input.length; i++, offset += 2) {
            let s = Math.max(-1, Math.min(1, input[i]));
            output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    function encodeWAV(samples, opt = { sampleRate: 44100, numChannels: 2 }){
        
        console.log("ENCODE WAV", opt.sampleRate, opt.numChannels)
        if (opt.numChannels === 2)
            samples = interleave(samples[0], samples[1]);
        else
            samples = samples[0];
        
        let buffer = new ArrayBuffer(44 + samples.length * 2);
        let view = new DataView(buffer);

        /* RIFF identifier */
        writeString(view, 0, 'RIFF');

        /* RIFF chunk length */
        view.setUint32(4, 36 + samples.length * 2, true);
        /* RIFF type */
        writeString(view, 8, 'WAVE');
        /* format chunk identifier */
        writeString(view, 12, 'fmt ');
        /* format chunk length */
        view.setUint32(16, 16, true);
        /* sample format (raw) */
        view.setUint16(20, 1, true);
        /* channel count */
        view.setUint16(22, opt.numChannels, true);
        /* sample rate */
        view.setUint32(24, opt.sampleRate, true);
        /* byte rate (sample rate * block align) */
        view.setUint32(28, opt.sampleRate * 4, true);
        /* block align (channel count * bytes per sample) */
        view.setUint16(32, opt.numChannels * 2, true);
        /* bits per sample */
        view.setUint16(34, 16, true);
        /* data chunk identifier */
        writeString(view, 36, 'data');
        /* data chunk length */
        view.setUint32(40, samples.length * 2, true);

        floatTo16BitPCM(view, 44, samples);
        
        let audioBlob = new Blob([view], {type: 'audio/wav'});
        return audioBlob
    }
    
};

export default wavEncoder