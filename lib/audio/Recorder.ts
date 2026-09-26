// @ts-nocheck
import AudioUtils from './utils'
import { createRecordWorker, createEncoderWorker } from './workers';
import moment from 'moment'
import {EventEmitter} from 'events'
const defaults = {
    sampleRate:44100, 
    numChannels:1,
    sampler:false, 
    processSample:{
        trim:true, 
        normalize:true, 
        fade:true
    }
}
class Recorder extends EventEmitter{

    constructor(context, opt = {}){
        super(opt)
        opt = {...defaults, ...opt}
        this.context = context;
        this._sampleRate = opt.sampleRate;
        this._numChannels = opt.numChannels;
        this._sampler = opt.sampler;
        this._node = null;
        this._silentSink = null;
        this._recording = false;
        this._processing = false;
        this._rectime = 0;
        this._processSample = opt.processSample;
        this._recordingId = 0;
        this.worker = null;
        this.encoderWorker = null;
        this.init()
    }
    init(){

        this.worker = createRecordWorker();
        this.initProcessor();
        this.worker.addEventListener('error', (err)=>{
            console.error('error record worker', err)
            this.emit('error', err)
        })
        this.worker.addEventListener('message', (event)=>{
            
            if(event.data.cancelled){
                console.log('Worker: CANCELLED')
                this._clearProgress()
                this._disconnect()
                return this._handleError('CANCELLED')
            }
            console.log('DONE sAMPLER')
            const blob = event.data.blob;
            const buffer = event.data.buffer;
            this._duration = buffer[0].length/this._sampleRate;
            this._processing = true;

            if(!this._processSample)
               return this._handleFinish(blob,buffer,this._duration)

            console.log('processing sample', this._id, this._duration)
            this._process(buffer, this._id).then((data)=>{
                this._handleFinish(data.blob, data.buffer, this._duration)
            }).catch((err)=>{
                console.error(err)
                this._handleError(err, this._duration)
            }).then(()=>{
                this._disconnect()

                if(this._sampler)
                    this.emit('sampling', this._id, false);
                else
                    this.emit('recording', false);

                this._clearProgress()

                console.log('Worker: DONE!')
            })
        })
        this.worker.addEventListener('error', (err)=>{
            this._handleError(err)
        })
        
    }
    /**
     * Load the recorder AudioWorklet module and create the processing node.
     * Async by nature (module load over the network); recording is guarded on
     * this._processor being ready (it almost always is by the time the user
     * hits record).
     */
    async initProcessor(){
        try{
            // deliver the worklet via a Blob URL: addModule requires a JS MIME
            // type, which a hashed raw-.ts asset does not provide
            const source = (await import('./record/worklet')).default;
            const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
            await this.context.audioWorklet.addModule(url);
            this._processor = new AudioWorkletNode(this.context, 'purplepurples-recorder', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                channelCount: Math.max(1, this._numChannels),
            });
            this._processor.port.onmessage = (event) => {
                this.worker.postMessage({ buffer: event.data.buffer });
            };
        }catch(err){
            console.error('error initializing recorder worklet', err)
            this._processor = null;
        }
    }
    record(node, id){
        if(this._recording)
            return Promise.reject('RECORDING')
        this._id = id;
        this._node = node;
        return new Promise((resolve, reject)=>{
            this._promise = {resolve,reject};
            this._start()
        })
    }
    stop(){
        this._processing = true;
        this._disconnect()
        this.worker.postMessage({stop:true})
    }
    cancel(){
        this.worker.postMessage({cancel:true})   
    }
    _start(){
        if(!this._processor){
            if(this._promise) this._promise.reject('recorder not ready');
            return;
        }
        this._outputStream = this.context.createMediaStreamDestination();

        if(this._sampler){
            /*
            this._splitter = this.context.createChannelSplitter();
            this._merger = this.context.createChannelMerger();
            this._node.connect(this._splitter);
            this._splitter.connect(this._merger, 0, 0);
            this._splitter.connect(this._merger, 0, 1);
            this._merger.connect(this._outputStream);
            */
            this._node.connect(this._outputStream)
            this._inputPoint = this._outputStream.context.createGain();
            this._realAudioInput = this._outputStream.context.createMediaStreamSource(this._outputStream.stream);
            this._realAudioInput.connect(this._inputPoint);
            this._inputPoint.connect(this._processor)
        }
        else{
            this._node.connect(this._outputStream);
            this._node.connect(this._processor);
        }
        
        this._rectime = Date.now()
        this._recording = true
        // The worklet passes its input through to its output, so connecting it
        // to the speakers would play the recorded signal a second time (the
        // master mix got louder) and monitor the mic while sampling. A muted
        // sink keeps the node pulled/processed without any audible output.
        if(!this._silentSink){
            this._silentSink = this.context.createGain();
            this._silentSink.gain.value = 0;
            this._silentSink.connect(this.context.destination);
        }
        this._processor.connect(this._silentSink)
        this.worker.postMessage({numChannels:this._numChannels, start:true})
        this.recordingProgress = setInterval(()=>this._emitProgress(), 100)

        if(this._sampler)
            this.emit('sampling', this._id, true);
        else
            this.emit('recording', true);
    }
    _handleError(err, duration = 0){
        //this.emit('progress', this._recordingId, {error:err, start:this.rectime, elapsed:duration, duration:duration, recording:false, processing:false})
        this._error = err;

        if(this._sampler)
            this.emit('sampling', this._id, false)
        else
            this.emit('recording', false)
        if(this._promise)
            this._promise.reject(err)
        
        this._clearProgress()
    }
    _handleFinish(blob,buffer,duration){
        
        const name = "Purple #" + (this._recordingId+1) + " " + moment().format("MMM DD HH:mm:ss")
        const recording = {
            id: this._recordingId++,
            url: URL.createObjectURL(blob),
            blob: blob,
            buffer: buffer,
            mimeType:'audio/wav',
            filename: name + '.wav',
            name:name,
            duration: duration
        };
        
        
        
        if(this._sampler)
            this.emit('sampling', this._id, false)
        else
            this.emit('recording', false)

        if(this._promise)
            this._promise.resolve(recording)

        
        this.emit('progress', this._recordingId, {start:this._rectime, elapsed:duration, duration:0, recording:false, processing:false})
    }
    _disconnect(){
        if(this._recording){
            if(this._sampler)
                this._inputPoint.disconnect(this._processor)
            else 
                this._node.disconnect(this._processor)

            this._processor.disconnect()
            this._outputStream.disconnect()
            console.log('disconnected input stream')
        }
        this._recording = false
        this._processing = false
        this._rectime = 0;

    }
    _checkProgress(){
        
    }
   
    _process(buffer, id){
        
        const { trim } = this._processSample;
        
        this.emit('sampleprocess', this._id, true)
        console.time('processsample')

        return new Promise((resolve,reject)=>{
            let data = buffer;
            if(trim)
                data = AudioUtils.trim(buffer, typeof trim === 'object' ? trim : {level:0.01, trimLeft:true, trimRight:false})            
            
            if(!data || !data[0].length) 
                return reject('I didn\'t hear what u said. Speak louder!')

            if(this._processSample.normalize)            
              data =  AudioUtils.normalize(data);
            
            if(this._processSample.fade){
                //data = AudioUtils.fade(data, 1000)
            }
            
            return this._encodeAudio(data, 'wav', {sampleRate:this._sampleRate, numChannels:data.length}).then((b)=>{
                const blob = new Blob([b], {type:'audio/wav'})
                resolve({blob:blob, buffer:data})
            })
        }).then((data)=>{
            this.emit('sampleprocess', this._id, false)
            console.timeEnd('processsample')
            return data;
        })
    }
    _encodeAudio(buffer, format, opt) {

        this._processing = true
        return new Promise((resolve, reject)=>{
            this._encoderPromise = {resolve,reject}
            this.encoderWorker = createEncoderWorker();
            this.encoderWorker.reject = reject;
            this.encoderWorker.addEventListener('message', (event)=>{

                if(event.data.progress)
                    return this.emit('encodingprogress', event.data.progress)

                if(this.encoderWorker)
                    this.encoderWorker.terminate()
                this.encoderWorker = null
                this._processing = false
                this._encoderPromise.resolve(event.data)
            
            })
            this.encoderWorker.addEventListener('error', (err)=>{
                if(this.encoderWorker && this.encoderWorker.terminate){
                    this.encoderWorker.terminate()
                    this.encoderWorker = null
                    this._processing = false
                    console.error('terminated encoding worker wit error', err)
                }
                this._encoderPromise.reject(err)
            })

            this.encoderWorker.postMessage({buffer, format, options:opt})
        })
        
    }
    _emitProgress(){
        
        if(this._recording){
            this._elapsed = (Date.now()-this._rectime)/1000;
            this._duration = this._elapsed;
        }

        const prog = {recording:this._recording, processing:this._processing, start:this._rectime, elapsed:this._elapsed, duration:this._duration}
        
        if(this._sampler)
            this.emit('progress', this._id, prog)
        else
            this.emit('progress', prog)
    }
    _clearProgress(){
        clearInterval(this.recordingProgress)
        this._recording = false;
        this._processing = false;
        this._emitProgress()
    }
    destroy(){
        try{
            this._disconnect();
        }catch(err){
            console.log(err)
        }
        
        this.worker.terminate()
        if(this.encoderWorker)
            this.encoderWorker.terminate()
    }
}
export default Recorder;

