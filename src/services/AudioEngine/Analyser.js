import {EventEmitter} from 'events'
const defaults = {
    fftSize: 32,
    minDecibels: -60,
    maxDecibels: 0,
    smoothingTimeConstant: 0.9,
    bits:8,
    interval:10,
    lowcut: undefined,
    hicut: undefined,
}
const typeDefaults = {
    volume:{
        ...defaults,
        fftSize: 32,
        interval:10,
        tweenIn: 1.618,
        tweenOut: 1.618*3       
    },
    timedomain:{
        ...defaults,
        fftSize: 1024,
        interval:30
    },
    frequency:{
        ...defaults,
        fftSize: 2048,
        interval:30
    }
}
class Analyser extends EventEmitter{

    constructor(id, context, node, opt = {}){
        super()
        this.id = id;
        this.context = context;
        this.node = node;
        this.sampleRate = context.sampleRate;
        this.options = {...defaults, ...opt}
        Object.keys(this.options).forEach((k)=>this['_'+k] = this.options[k])
        this._listeners = {}
    }
    addEventListener(type, opt, cb){
        cb = typeof opt === 'function' ? opt : cb
        opt = typeof opt === 'function' ? {...this.options} : {...this.options, ...opt}
        console.log('add analyser listener', this.id, type)
        const listener = this._setup(type, opt, cb)
        this._connect(listener)
        this._analyse(listener)
    }
    removeEventListener(type, cb){
        console.log('remove event listener')
        const listener = this._listeners[type]
        if(!listener) return
        this._stopAnalyse(listener)
        this._disconnect(listener, cb)
        listener.callbacks = listener.callbacks.filter((c) => c !== cb)
    }
    on(type, opt, cb){
        return this.addEventListener(type, opt, cb)
    }
    off(type, cb){
        return this.removeEventListener(type, cb)
    }
    setNode(node){
        console.log('set node new node')
        Object.keys(this._listeners).forEach((type)=>{
            const listener = this._listeners[type]
            listener.callbacks.forEach((cb)=>{
                this._end(listener, cb)
            })
            this._disconnect(listener)
        })
        this.node = node;
        Object.keys(this._listeners).forEach((type)=>{
            const listener = this._listeners[type]
            this._connect(listener)
            if(listener.analysing)
                this._analyse(listener)
        })
    }
    setOptions(type, opt){
        const listener = this._listeners[type]
        if(!listener) return
            
        listener.options = {...listener.options, ...opt}
        listener.analyser.fftSize = listener.options.fftSize
        listener.analyser.minDecibels = listener.options.minDecibels;
        listener.analyser.maxDecibels = listener.options.maxDecibels;
        listener.analyser.smoothingTimeConstant = listener.options.smoothingTimeConstant;
        if(listener.analysing)
            this._restartAnalyse(listener)
    }
    pause(){
        //console.log('pause analyser')
        Object.keys(this._listeners).forEach((type)=>this._stopAnalyse(this._listeners[type]))
        
    }
    unpause(){
        //console.log('unpause analyser', this._listeners)
        Object.keys(this._listeners).forEach((type)=>this._restartAnalyse(this._listeners[type]))
        
    }
    close(type, cb){
        this._disconnect(this._listeners[type], cb)   
    }
    destroy(){
        Object.keys(this._listeners).forEach((type)=>{
            const listener = this._listeners[type]
            listener.callbacks.forEach((cb)=>{
                this._end(listener, cb)
            })
        })
        Object.keys(typeDefaults).forEach((type)=>{
            this._disconnect(this._listeners[type])
        })
    }
    _connect(listener){
        if(listener.connected) return
        this.node.connect(listener.gain);
        listener.gain.connect(listener.analyser)
        listener.analyser.connect(listener.destination);
        listener.connected = true
        console.log('connected analyser', this.id, listener.type, 'inputs=', this.node.numberOfInputs, 'outputs=', this.node.numberOfOutputs)
    }
    _disconnect(listener, cb){
        console.log('disconnect', this.id, )
        if(!listener) return //console.error('analyser not connected')
        if(listener.connected){
            this._end(listener, cb)
            //this._stopAnalyse(listener)
            this.node.disconnect(listener.gain);
            listener.gain.disconnect(listener.analyser)
            listener.analyser.disconnect(listener.destination);
            listener.connected = false
            console.log('disconnected analyser', this.id, listener.type)
        }
    }
    _setup(type, opt = {}, cb){

        const options = {...typeDefaults[type], ...opt};
        if(!this._listeners[type]){ 
            const analyser = this.context.createAnalyser();
            const destination = this.context.createMediaStreamDestination();
            const gain = typeof this.context.createGain === undefined ? this.context.createGainNode() : this.context.createGain();
            this._listeners[type] = {type, analyser, gain, destination, options, analysing:false, connected:false, callbacks:[]}
        }
        const listener = this._listeners[type]
        this.setOptions(type, options)
        
        if(cb)
            listener.callbacks.push(cb)
        return listener;
    }
    _end(listener, cb){
        const end = listener.type === 'volume' ? 0 : listener.options.bits === 32 ? new Float32Array(listener.analyser.frequencyBinCount) : new Uint8Array(listener.analyser.frequencyBinCount);
        this.emit(listener.type, end, {...listener.options, ended:true})
        if(cb)
            cb(end, listener.options)
        else
            listener.callbacks.forEach((c)=>c(end, listener.options))
    }
    _analyse(listener){

        if(listener.analysing) return

        const {options, analyser, type} = listener;
        const length = type === 'volume' ? options.fftSize : analyser.frequencyBinCount
        const dataArray = options.bits === 32 ? new Float32Array(length) : new Uint8Array(length);
        let result, range, next, tween, handle, last = 0;

        console.log('analysing', this.id, type, options.interval)
        listener.analysing = setInterval(()=>{
            requestAnimationFrame(()=>{
                if(type === 'frequency')
                    options.bits === 32 ? analyser.getFloatFrequencyData(dataArray) : analyser.getByteFrequencyData(dataArray);
                else if(type === 'timedomain' || type === 'volume')
                    options.bits === 32 ? analyser.getFloatTimeDomainData(dataArray) : analyser.getByteTimeDomainData(dataArray);
                
                if(options.lowcut !== undefined || options.hicut !== undefined){
                    const freqsPerBand = ((this.sampleRate/2)/dataArray.length)
                    const start = options.lowcut <= 0  ? 0 : parseInt(options.lowcut/freqsPerBand)
                    const end = options.hicut >= this.sampleRate/2  ? dataArray.length-1 : (dataArray.length - parseInt(((this.sampleRate/2) - options.hicut)/freqsPerBand)) -1
                    result = dataArray.slice(start,end)
                }
                if(type === 'volume'){
                    range = this._getDynamicRange(dataArray) * (Math.E - 1)
                    next = Math.floor(Math.log1p(range) * 100)
                    tween = next > last ? options.tweenIn : options.tweenOut
                    next = last = (last + (next - last) / tween) / this.node.numberOfOutputs
                    result = next;
                }else
                    result = dataArray;

                this.emit(type, result, options)
                listener.callbacks.forEach((cb)=>cb ? cb(result, options) : null) 
                //console.log('.', listener.type, this.id)
            })
        }, options.interval)
    }
    _stopAnalyse(listener){
        if(listener){
            console.log('stop analyser', this.id, listener.type)
            clearInterval(listener.analysing)
            listener.analysing = false
            this._end(listener)
        }
    }
    _restartAnalyse(listener){
        if(listener){
            console.log('restart analyser', this.id, listener.type)
            this._stopAnalyse(listener)
            this._analyse(listener)
        }
    }
    _getDynamicRange(buffer) {
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
export default Analyser