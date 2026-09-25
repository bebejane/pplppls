import clamp from 'clamp'

const fade = (buffer, ms, sampleRate = 44100)=>{
	return buffer
	ms = 1000
	var isNeg = function (number) {
		return number === 0 && (1 / number) === -Infinity;
	};

	var nidx = function negIdx (idx, length) {
		return idx == null ? 0 : isNeg(idx) ? length : idx <= -length ? 0 : idx < 0 ? (length + (idx % length)) : Math.min(length, idx);
	}
	
	for (var c = 0; c < buffer.length; c++) {
		var data = buffer[c]
		const samples = ms*(44100/1000)
		const level = data[samples];
		const amp = level/samples
		console.log('fade', samples, level, amp)
		const fadeFrameCount = samples;
		const ascending = false

        for (let i = 0; i < fadeFrameCount; i++) {
            const currentFrameFadePercentage = (i - 0) / fadeFrameCount;
            buffer[c][i] = ascending ?   buffer[i] * currentFrameFadePercentage : buffer[i] * (1 - currentFrameFadePercentage);
            if(i < 100)
            	console.log(buffer[c][i])
        }
        /*
		for (var i =  0, a = 0; i < samples; i++, a+=amp) {
			buffer[c][i] = a
			//console.log('.')
			if(i < 20)
				console.log(a)
		}
		*/
	}
	/*
	for (var c = 0; c < buffer.length; c++) {
		var data = buffer[c]
		for (var i = 0; i < data.length; i++)
			normalized[c][i] = clamp(data[i] * amp, -1, 1)
		
	}
	console.log('NORMALIZED', amp, normalized.length)
	*/
	return buffer
}

export default fade
/*
export class Fader {
    
        const fadeFrameCount = this.endFrame - this.startFrame;
        for (let i = this.startFrame; i < this.startFrame + fadeFrameCount; i++) {
            const currentFrameFadePercentage = (i - this.startFrame) / fadeFrameCount;
            buffer[i] = this.ascending ? buffer[i] * currentFrameFadePercentage : buffer[i] * (1 - currentFrameFadePercentage);
        }
    }
}
*/