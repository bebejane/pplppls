
    createAudioMeter(id, node, enable){
        //return this.createAudioMeter2(id,node,enable)
        if(!this.enableMeters) return

        if(this.meters[id])
            this.destroyAudioMeter(id)


        const channelCount = 2//node.numberOfOutputs;
        const meterWorker = new MeterWorker()
        
        const processorNode = this.context.createScriptProcessor(2048, channelCount, channelCount);
        processorNode.onaudioprocess = (e) => {
            
            if(this.meters[id] && !this.meters[id].connected) return
            
            const buffer = new Array(channelCount);
            
            for (var i = 0; i < channelCount; i++)
                buffer[i] = e.inputBuffer.getChannelData(i)
            meterWorker.postMessage({buffer:buffer});
            //console.log(buffer[1][0])
        }
        meterWorker.postMessage({channelCount:channelCount})
        meterWorker.addEventListener('message', (event)=>{
            this.emit('meter'+id, event.data.meter)
        })
        meterWorker.addEventListener('error', (event)=>{
            this.meterWorker.terminate()
        })
        /*
        const analyser = this.context.createAnalyser();
        analyser.smoothingTimeConstant = 0.8;
        analyser.fftSize = 1024;
        */
        this.meters[id] = {node:node, processor:processorNode, worker:meterWorker, connected:false };
        console.log('CREATED METER', id, channelCount, 'inputs', node.numberOfInputs, 'outputs', node.numberOfOutputs)

        if(enable)
            this.enableMeter(id, true)
        
        return processorNode;
    }
    createAudioMeter2(id, node, enable){
        if(id == 'master') return
        if(!this.enableMeters) return

        var audioStream = this.inputStreamSource//this.context.createMediaStreamSource( this.inputStream);
        var analyser = this.context.createAnalyser();
        var fftSize = 2048;
        analyser.smoothingTimeConstant = 0.3;
        analyser.fftSize = fftSize;
        audioStream.connect(analyser);

        var bufferLength = analyser.frequencyBinCount;
        var frequencyArray = new Uint8Array(bufferLength);
        setInterval(()=>{
            var array =  new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            var average = getAverageVolume(array)

            this.emit('meter'+id, [average/100,average/100])
            //console.log([average/100,average/100])
            console.log(array[1][0])
        },100)
        function getAverageVolume(array) {
            var values = 0;
            var average;

            var length = array.length;

            // get all the frequency amplitudes
            for (var i = 0; i < length; i++) {
                values += array[i];
            }

            average = values / length;
            return average;
      }
    }
    enableMeter(id, enable){
        if(!this.enableMeters || !this.meters[id]) return

        const meter = this.meters[id]

        if(enable){
            if(meter.connected) return
            meter.node.connect(meter.processor);
            meter.processor.connect(this.context.destination)
            this.meters[id].connected = true
        }
        else{
            if(!meter.connected) return 
            meter.processor.disconnect(this.context.destination)
            this.emit('meter'+id, [[0.0,0.0]])
            this.emit('meter'+id, [[0.0,0.0]])
            this.meters[id].connected = false
            
        }
        //console.log(enable ? 'enable' : 'disable' + ' meter', id)
    }
    destroyAudioMeter(id){
        
        if(!this.meters[id]) return
        try{
            console.log('DESTROY METER', id)
            this.enableMeter(id, false)
            this.meters[id].worker.terminate()
            delete this.meters[id]
        }catch(err){
            this.emit('error', err)
        }  
    }
    enableAnalyser(id, enable, opt = {}, callback){

        if(!this.enableAnalysers || !this.analysers[id]) return

        const analyser = this.analysers[id]
        const options = analyser.options = {...analyser.options, ...opt}
        const length = options.type === 'volume' ? options.fftSize : analyser.processor.frequencyBinCount
        const dataArray = options.bits === 32 ? new Float32Array(length) : new Uint8Array(length);
        let result = 0;

        if(enable){
            console.log('enable analyser', id, options.type)
            analyser.processor.fftSize = options.fftSize
            analyser.processor.minDecibels = options.minDecibels;
            analyser.processor.maxDecibels = options.maxDecibels;
            analyser.processor.smoothingTimeConstant = options.smoothingTimeConstant;
            
            if(!analyser.connected){
                
                //analyser.node.connect(analyser.gain)
                let range, next, tween, handle, last = 0;
                analyser.processorNode.onaudioprocess = (e) => {
                    if(options.type === 'frequency')
                        options.bits === 32 ? analyser.processor.getFloatFrequencyData(dataArray) : analyser.processor.getByteFrequencyData(dataArray);
                    else if(options.type === 'timedomain' || options.type === 'volume')
                        options.bits === 32 ? analyser.processor.getFloatTimeDomainData(dataArray) : analyser.processor.getByteTimeDomainData(dataArray);
                    console.log(dataArray)
                    if(options.lowcut !== undefined || options.hicut !== undefined){
                        const freqsPerBand = ((options.sampleRate/2)/dataArray.length)
                        const start = options.lowcut <= 0  ? 0 : parseInt(options.lowcut/freqsPerBand)
                        const end = options.hicut >= options.sampleRate/2  ? dataArray.length-1 : (dataArray.length - parseInt(((options.sampleRate/2) - options.hicut)/freqsPerBand)) -1
                        result = dataArray.slice(start,end)
                    }
                    if(options.type === 'volume'){
                        range = getDynamicRange(dataArray) * (Math.E - 1)
                        next = Math.floor(Math.log1p(range) * 100)
                        tween = next > last ? options.tweenIn : options.tweenOut
                        next = last = (last + (next - last) / tween)/analyser.node.numberOfOutputs
                        result = next;
                        //console.log(dataArray)
                        //console.log(result)
                    }else
                        result = dataArray;

                    this.emit('analyser'+id, result, options)

                    if(callback) 
                        callback(result, options)
                }
                analyser.node.connect(analyser.processorNode);
                analyser.processorNode.connect(analyser.processor);
                //analyser.gain.connect(analyser.processor);
                
                analyser.processorNode.connect(this.context.destination);

                analyser.connected = true
                console.log('connected analyser', id, options.type, 'inputs=', analyser.node.numberOfInputs, 'outputs=', analyser.node.numberOfOutputs)
            }
            return
            clearInterval(analyser.interval)
            
            let range, next, tween, handle, last = 0;

            analyser.interval = setInterval(()=>{
                if(options.type === 'frequency')
                    options.bits === 32 ? analyser.processor.getFloatFrequencyData(dataArray) : analyser.processor.getByteFrequencyData(dataArray);
                else if(options.type === 'timedomain' || options.type === 'volume')
                    options.bits === 32 ? analyser.processor.getFloatTimeDomainData(dataArray) : analyser.processor.getByteTimeDomainData(dataArray);
                
                if(options.lowcut !== undefined || options.hicut !== undefined){
                    const freqsPerBand = ((options.sampleRate/2)/dataArray.length)
                    const start = options.lowcut <= 0  ? 0 : parseInt(options.lowcut/freqsPerBand)
                    const end = options.hicut >= options.sampleRate/2  ? dataArray.length-1 : (dataArray.length - parseInt(((options.sampleRate/2) - options.hicut)/freqsPerBand)) -1
                    result = dataArray.slice(start,end)
                }
                if(options.type === 'volume'){
                    range = getDynamicRange(dataArray) * (Math.E - 1)
                    next = Math.floor(Math.log1p(range) * 100)
                    tween = next > last ? options.tweenIn : options.tweenOut
                    next = last = (last + (next - last) / tween)/analyser.node.numberOfOutputs
                    result = next;
                    //console.log(dataArray)
                    //console.log(result)
                }else
                    result = dataArray;

                this.emit('analyser'+id, result, options)

                if(callback) 
                    callback(result, options)
                //console.log(data.length, start, end, freqsPerBand, options.lowcut, options.hicut)
            }, options.interval)
        }else{
            clearInterval(analyser.interval)
            if(analyser.connected){
                //analyser.node.disconnect(analyser.gain)
                analyser.processorNode.disconnect(analyser.processor);
                analyser.processorNode.disconnect(this.context.destination);
                //analyser.gain.connect(analyser.processor);
                
                //analyser.node.connect(this.context.destination);

                //analyser.node.disconnect(analyser.processor);
                //analyser.gain.disconnect(analyser.processor)
                //analyser.node.disconnect(this.context.destination);
                analyser.connected = false
                console.log('disconnected analyser', id, options.type)
            }
            this.emit('analyser'+id, result, options)
            if(callback) 
                callback(result, options)
        }

        function getDynamicRange(buffer) {
            let len = buffer.length;
            let min = 128;
            let max = 128;
            for (let i = 0; i < len; i++) {
                let sample = buffer[i]
                if (sample < min) min = sample
                else if (sample > max) max = sample
            }
            return (max - min) / 255
        }
    }
    createAnalyser(id, node, enable, opt = {}){

        if(!this.enableAnalysers) return null;
        const channelCount = 2;
        const analyser = this.context.createAnalyser()
        //const processorNode = this.context.createScriptProcessor(2048, channelCount, channelCount);
        
        const options = {
            id:id,
            type:'volume',
            fftSize: 32,
            minDecibels: -60,
            maxDecibels: 0,
            smoothingTimeConstant: 0.9,
            bits:8,
            interval:30,
            sampleRate: this.sampleRate,
            lowcut: undefined,
            hicut: undefined,
            tweenIn: 1.618,
            tweenOut: 1.618*3,
            ...opt
        }
        const analyserGain = typeof this.context.createGain === undefined ? this.context.createGainNode() : this.context.createGain();
        const scriptProcessor = this.context.createScriptProcessor(1024);
        this.analysers[id] = {node:node, processor:analyser, scriptProcessor:scriptProcessor, gain:analyserGain, connected:false, options, close:()=>{this.enableAnalyser(id, false)}};
        console.log('created analyser',id, options.type, options)
        //if(enable) this.enableAnalyser(id, true, options)
        return this.analysers[id]
    }
    enableAnalyser(id, enable, opt = {}, callback){

        if(!this.enableAnalysers || !this.analysers[id]) return

        const analyser = this.analysers[id]
        const options = analyser.options = {...analyser.options, ...opt}
        const length = options.type === 'volume' ? options.fftSize : analyser.processor.frequencyBinCount
        
        let result = 0;

        if(enable){
            console.log('enable analyser', id, options.type)
            analyser.processor.fftSize = options.fftSize
            analyser.processor.minDecibels = options.minDecibels;
            analyser.processor.maxDecibels = options.maxDecibels;
            analyser.processor.smoothingTimeConstant = options.smoothingTimeConstant;
            
            if(!analyser.connected){
                
                //analyser.node.connect(analyser.gain)
                
                //analyser.node.connect(split)
                analyser.node.connect(analyser.processor);
                analyser.processor.connect(analyser.scriptProcessor)
                analyser.scriptProcessor.connect(this.context.destination);
                //analyser.node.connect(analyser.gain)
                //analyser.gain.connect(analyser.processor);
                
                //analyser.node.connect(this.context.destination);

                analyser.connected = true
                console.log('connected analyser', id, options.type, 'inputs=', analyser.node.numberOfInputs, 'outputs=', analyser.node.numberOfOutputs)
            }
            clearInterval(analyser.interval)
            
            let range, next, tween, handle, last = 0;

            //analyser.interval = setInterval(()=>{
            analyser.scriptProcessor.onaudioprocess = (e)=>{
                //console.log(e)
                //console.log("*", options.id)
                //requestAnimationFrame(()=>{
                    const dataArray = options.bits === 32 ? new Float32Array(length) : new Uint8Array(length);
                    if(options.type === 'frequency')
                        options.bits === 32 ? analyser.processor.getFloatFrequencyData(dataArray) : analyser.processor.getByteFrequencyData(dataArray);
                    else if(options.type === 'timedomain' || options.type === 'volume')
                        options.bits === 32 ? analyser.processor.getFloatTimeDomainData(dataArray) : analyser.processor.getByteTimeDomainData(dataArray);
                    
                    if(options.lowcut !== undefined || options.hicut !== undefined){
                        const freqsPerBand = ((options.sampleRate/2)/dataArray.length)
                        const start = options.lowcut <= 0  ? 0 : parseInt(options.lowcut/freqsPerBand)
                        const end = options.hicut >= options.sampleRate/2  ? dataArray.length-1 : (dataArray.length - parseInt(((options.sampleRate/2) - options.hicut)/freqsPerBand)) -1
                        result = dataArray.slice(start,end)
                    }
                    if(options.type === 'volume'){
                        range = getDynamicRange(dataArray) * (Math.E - 1)
                        next = Math.floor(Math.log1p(range) * 100)
                        tween = next > last ? options.tweenIn : options.tweenOut
                        next = last = (last + (next - last) / tween) / analyser.node.numberOfOutputs
                        result = next;
                        console.log(dataArray)
                        //console.log(result)
                    }else
                        result = dataArray;

                    this.emit('analyser'+id, result, options)

                    if(callback) 
                        callback(result, options)
                //})
                //console.log(data.length, start, end, freqsPerBand, options.lowcut, options.hicut)
            }//, options.interval)
        }else{
            clearInterval(analyser.interval)
            if(analyser.connected){
                analyser.node.disconnect(analyser.processor);
                analyser.processor.disconnect(analyser.scriptProcessor)
                analyser.scriptProcessor.disconnect(this.context.destination);

                //const dataArray = options.bits === 32 ? new Float32Array(length) : new Uint8Array(length);
                //analyser.node.disconnect(analyser.processor);
                //analyser.node.disconnect(analyser.gain)
                //analyser.node.disconnect(analyser.gain)
                //analyser.gain.disconnect(analyser.processor)
                //analyser.node.disconnect(this.context.destination);
                analyser.connected = false
                console.log('disconnected analyser', id, options.type)
            }
            this.emit('analyser'+id, result, options)
            if(callback) 
                callback(result, options)
        }

        function getDynamicRange(buffer) {
            let len = buffer.length;
            let min = 128;
            let max = 128;
            for (let i = 0; i < len; i++) {
                let sample = buffer[i]
                if (sample < min) min = sample
                else if (sample > max) max = sample
            }
            return (max - min) / 255
        }
    }
    createAnalyser(id, node, enable, opt = {}){
        return
        if(!this.enableAnalysers) return null;
        const channelCount = 2;
        const analyser = this.context.createAnalyser()
        //const processorNode = this.context.createScriptProcessor(2048, channelCount, channelCount);
        
        const options = {
            id:id,
            type:'volume',
            fftSize: 32,
            minDecibels: -60,
            maxDecibels: 0,
            smoothingTimeConstant: 0.9,
            bits:8,
            interval:10,
            sampleRate: this.sampleRate,
            lowcut: undefined,
            hicut: undefined,
            tweenIn: 1.618,
            tweenOut: 1.618*3,
            ...opt
        }
        const analyserGain = typeof this.context.createGain === undefined ? this.context.createGainNode() : this.context.createGain();
        const destination =  this.context.createMediaStreamDestination();
        const scriptProcessor =  this.context.createScriptProcessor(1024)

        this.analysers[id] = {node:node, processor:analyser, gain:analyserGain, destination, scriptProcessor, connected:false, options, close:()=>{this.enableAnalyser(id, false)}};
        console.log('created analyser',id, options.type, options)
        //if(enable) this.enableAnalyser(id, true, options)
        return this.analysers[id]
    }
    enableAnalyser(id, enable, opt = {}, callback){

        if(!this.enableAnalysers || !this.analysers[id]) return

        const analyser = this.analysers[id]
        const options = analyser.options = {...analyser.options, ...opt}
        const length = options.type === 'volume' ? options.fftSize : analyser.processor.frequencyBinCount
        const dataArray = options.bits === 32 ? new Float32Array(length) : new Uint8Array(length);
        let result = 0;

        if(enable){
            console.log('enable analyser', id, options.type)
            analyser.processor.fftSize = options.fftSize
            analyser.processor.minDecibels = options.minDecibels;
            analyser.processor.maxDecibels = options.maxDecibels;
            analyser.processor.smoothingTimeConstant = options.smoothingTimeConstant;
            
            if(!analyser.connected){
                analyser.node.connect(analyser.gain);
                analyser.gain.connect(analyser.processor)
                analyser.processor.connect(analyser.destination);
                analyser.connected = true
                console.log('connected analyser', id, options.type, 'inputs=', analyser.node.numberOfInputs, 'outputs=', analyser.node.numberOfOutputs)
            }
            clearInterval(analyser.interval)
            
            let range, next, tween, handle, last = 0;

            analyser.interval = setInterval(()=>{
                
               // requestAnimationFrame(()=>{

                    if(options.type === 'frequency')
                        options.bits === 32 ? analyser.processor.getFloatFrequencyData(dataArray) : analyser.processor.getByteFrequencyData(dataArray);
                    else if(options.type === 'timedomain' || options.type === 'volume')
                        options.bits === 32 ? analyser.processor.getFloatTimeDomainData(dataArray) : analyser.processor.getByteTimeDomainData(dataArray);
                    
                    if(options.lowcut !== undefined || options.hicut !== undefined){
                        const freqsPerBand = ((options.sampleRate/2)/dataArray.length)
                        const start = options.lowcut <= 0  ? 0 : parseInt(options.lowcut/freqsPerBand)
                        const end = options.hicut >= options.sampleRate/2  ? dataArray.length-1 : (dataArray.length - parseInt(((options.sampleRate/2) - options.hicut)/freqsPerBand)) -1
                        result = dataArray.slice(start,end)
                    }
                    if(options.type === 'volume'){
                        range = getDynamicRange(dataArray) * (Math.E - 1)
                        next = Math.floor(Math.log1p(range) * 100)
                        tween = next > last ? options.tweenIn : options.tweenOut
                        next = last = (last + (next - last) / tween) / analyser.node.numberOfOutputs
                        result = next;
                        //console.log(dataArray)
                        //console.log(result)
                    }else
                        result = dataArray;

                    this.emit('analyser'+id, result, options)

                    if(callback) 
                        callback(result, options)
              //  })
                //console.log(data.length, start, end, freqsPerBand, options.lowcut, options.hicut)
            }, options.interval)
        }else{
            clearInterval(analyser.interval)
            if(analyser.connected){
                analyser.node.disconnect(analyser.gain);
                analyser.gain.disconnect(analyser.processor)
                analyser.processor.connect(analyser.destination);
                analyser.connected = false
                console.log('disconnected analyser', id, options.type)
            }
            this.emit('analyser'+id, result, options)
            if(callback) 
                callback(result, options)
        }

        function getDynamicRange(buffer) {
            let len = buffer.length;
            let min = 128;
            let max = 128;
            for (let i = 0; i < len; i++) {
                let sample = buffer[i]
                if (sample < min) min = sample
                else if (sample > max) max = sample
            }
            return (max - min) / 255
        }
    }
    destroyAnalysers(){
        Object.keys(this.analysers).forEach((id)=>this.enableAnalyser(id, false))
    }