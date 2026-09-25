import Global from '../../../Global'
import React, { Component } from "react";
import { AiOutlineLoading } from 'react-icons/ai'
import AudioEngine from "../../../services/AudioEngine";
import VolumeVisualizer from "../../visualizers/VolumeVisualizer";
import Select from '../../util/Select';
import Switch from 'react-switch';
import isElectron from 'is-electron';
import "./index.css";
import axios from 'axios'
import JSZip from 'jszip'
const IS_ELECTRON = isElectron()
const savedOptions = localStorage.getItem('shifteroptions') ? JSON.parse(localStorage.getItem('shifteroptions')) : {};

class PitchShifter extends Component {
    constructor(props) {
        super(props);

        this.state = {
            model: "test",
            pads:{},
            sampling:false,
            recording:false,
            samplingId:null,
            recordingId:-1,
            elapsed:0,
            ms:5000,
            inputDevices:[],
            midiDevices:[],
            inputDeviceId:0,
            midiSupported:false,
            ready:false,
            loading:false,
            volume:0.5,
            loudness:0,
            playing:false,
            _tempo:1000,
            options:{
                loop:true,
                pitch:true,
                reverse:false,
                tempo:1000,
                ploop:false,
                ...savedOptions
            }
        };
        this.averageInput = []
        Global.engine = new AudioEngine({
            sampleRate: 44100,
            channels: 2,
            volume: 0.5,
            mode: "single",
            electron: IS_ELECTRON,
            enableAnalysers:true,
            enableElapsed:false,
            enableEffects:true,
            enableLoops:false,
            processSample:{
                trim:true,
                normalize:false
            }
        });

        Global.engine.on('masterstate', (state, updated)=>{
            //console.log(state, updated)
            //this.setState({playing:state.playing, volume:state.volume})
        })
        Global.engine.on('recording', (on)=>{
            console.log(on)
            this.setState({recording:on})
        })
        Global.engine.on('sampling', (id, on)=>{
            console.log('sampling is', id, on)
            this.setState({sampling:on, samplingId:on ? id : null})
        })
        Global.engine.on('samplingprogress', (id, prog)=>{
          this.setState({elapsed:prog.elapsed.toFixed(0)})
        })
        Global.engine.on("inputdevices", (devices) => {
            this.setState({ inputDevices:devices });
        });
        Global.engine.on("mididevices", (devices) => {
            this.setState({ midiDevices: devices });
        });
        Global.engine.on('noteon', (event)=>{
            if(this.state.sampling) return
            const note = event.note.number
            const octave = event.note.octave
            const idx = note-(octave*12)-12
            this.play('pad'+idx)
        })
        Global.engine.on('meterinput', (meter)=>{
            return
            
            if(this.averageInput.length === 5){
                var total = 0;
                for(var i = 0; i < this.averageInput.length; i++)
                    total += (Math.abs(this.averageInput[i][0]) + Math.abs(this.averageInput[i][1]))*50;
                const loudness = total / this.averageInput.length;
                this.setState({loudness})

                this.averageInput = []
            }else{
                this.averageInput.push(meter)
            }
        })

        this.recordings = []
        this.models = ['test']
        this.canvasRef = React.createRef();
        this.sample = this.sample.bind(this)
        this.sampleId = null
        this.stopped = false
    }
    componentDidMount() {
        this.init();
    }
    componentWillUnmount() {
        this.props.onQuit()
    }
    init(){
        console.log('######### INIT ###########@')
        this.setState({init:false})

        const lastInputDevice = localStorage.getItem('lastInputDevice')
        const lastMidiDevice = localStorage.getItem('lastMidiDevice')

        Global.engine.init(lastInputDevice, lastMidiDevice).then((info)=>{
            console.log(info)
            if(info.devices){
                const device = info.devices.filter((d)=> d.deviceId === lastInputDevice)[0] ||  info.devices.filter((d)=> d.label.toLowerCase().includes('microphone'))[0] || info.devices[0]
                this.setState({inputDeviceId:device.deviceId, inputDevices:info.devices})
            }
            this.setState({init:true})
            this.initDone()
        }).catch((err)=>{
            this.handleError(err)
        })

        Global.engine.initMidi().then((devices)=>{
            
            const device = devices.filter((d)=> d.deviceId === lastMidiDevice)[0] || devices[0]
            this.onMidiDeviceChange(device.deviceId)
            this.setState({midiDevices:devices, midiSupported:true})
        }).catch((err)=>{
            console.log('MIDI NOT AVAILABLE')
            this.setState({midiSupported:false})
        })
        
    }
    async initDone(){
        console.log('INIT DONE')

        const pads = {}
        const {options} = this.state;
        for (var i = 0, p=0.6; i < 12; i++, p+=0.1) {
            const id = 'pad'+i;
            Global.engine.add(id,null,null,{enableMeter:false, enableEffects:true})
            
            Global.engine.loop(id, options.loop)
            Global.engine.reverse(id, options.reverse)
            Global.engine.on('state'+id, (state)=>{
                const pads = this.state.pads;
                pads[id] = state
                this.setState({pads})
            })
            pads[id] = {loaded:false, playing:false}
        }
        this.setState({pads})
        //Global.engine.enableMeter('input', true)
    }
    async start(){
        const rec = await this.record(1000*5)
        this.recordings.push(rec)
    }
    async sleep(ms){
        return new Promise((resolve,rekect)=>{
            setTimeout(()=>resolve(), ms)
        })
    }
    async record(start){
        if(!start) 
            return Global.engine.record(false);

        const recording = await Global.engine.record(true);
        this.recordings.unshift(recording)
        this.setState({recording:false})
        console.log(recording)
            
    }
    onRecordingSelect(id){
        this.setState({recordingId:id})
        this.onPlay(id)
    }
    onPlay(id) {
        console.log('play recording', id)
        const rec = this.recordings.filter((r) => r.id === id)[0];
        
        Global.engine.stop();

        if(this.sound)
            this.sound.destroy()
        if(!rec) return

        this.sound = Global.engine.playSound(rec.url,{enableElapsed:false, volume:1.0})
        this.sound.on('ready', ()=>{
            this.sound.volume(1.0)
            this.sound.play()
            this.setState({playId:id})
        })
        this.sound.on('ended', ()=>{
            this.setState({ playId: null })
        })
        this.sound.load()
        this.setState({ playId: id });

    }
    onStop(id, e) {
        if (this.sound)
            this.sound.stop();
        this.setState({ playId: null });
        e.stopPropagation();
    }
    
    
    sample(start){
        const id = 'pad0'
        if(!start){
            this.setState({loading:true})
            return Global.engine.sample(id, false)
        }

        let count = 0;
        this.stopAll()

        Global.engine.sample(id, true).then((recording)=>{
            console.log('sampling done')
            //Global.engine.once('load'+id, (on, i)=>{
                console.log('.....')
                const options = this.state.options;

                for (var i = 0, p=0.6; i < 12; i++, p+=0.1){
                    Global.engine.once('loadpad'+i, (id, on)=>{
                        console.log('.....')
                        if(++count === 12){
                            this.applyOptions()
                            this.setState({loading:false, ready:true})
                            this.replayAll()
                        }
                    })  
                    Global.engine.replace('pad'+i, recording.url, recording.filename)
                    Global.engine.volume('pad'+i, 0.1)
                    
                }
                
            //})
            
        }).catch((err)=>{        
            this.setState({loading:false, ready:false, error:err})
        })
    
    }
    stopSample(){
        Global.engine.sample(this.id, false)
    }

    async playAll(){
        
        if(this.state.playing) return
        const length = Global.engine.sounds.length;
        const {options} = this.state;
        
        this.setState({playing:true})
        for (var i = 0; i < length && !this.stopped ; i++)
            await this.playPad('pad'+i, options.tempo/1000)
        
        this.setState({playing:false}, ()=>{

            if(options.ploop && !this.stopped)
                return this.playAll()
        
            this.stopped = false;    
        })
        
        
        //}, idx === 0 ? 0 : options.tempo)
    }
    playPad(id, duration){
        return new Promise((resolve)=>{
            console.log('PLAY', id, duration)
            Global.engine.once('ended', (i)=>{
                console.log('ended', i)
                if(id == i) 
                    resolve()
            })
            Global.engine.play(id, {duration})

        })
    }
    stopAll(){
        this.stopped = true;
        Global.engine.master.stop()
        this.setState({playing:false})
    }
    replayAll(){
        //if(!this.state.ready) return
        this.stopAll()
        this.stopped =false;
        this.playAll()
        //this.setState({playing:true})
    }
    play(id){
        
        if(!this.state.ready) return
        if(!Global.engine.get(id).sound._playing)
            Global.engine.play(id)
        else
            Global.engine.stop(id)
    }
    stop(){
        console.log('STOP')
        Global.engine.sample(this.id, false)
    }
    
    setOption(key, value){
        console.log('option', key, value)
        if(!key || value === undefined) return

        const opt = {}
        opt[key] = value;

        const options = {...this.state.options, ...opt};
        
        
        localStorage.setItem('shifteroptions', JSON.stringify(options))
        this.setState({options, loading:key=='pitch' ? true : false});
        setTimeout(()=>{
            this.applyOptions(key, value)
            this.setState({loading:false})
        },key=='pitch' ? 20 : 0)
    }
    applyOptions(key){
        const {options} = this.state;
        
        for (var i = 0; i < Global.engine.sounds.length; i++) {
            const id = Global.engine.sounds[i].id;
            const pitch = parseFloat(((i/10)+0.6).toFixed(1))
            if(key == 'loop' || !key)
                Global.engine.loop(id, options.loop)
            if(key == 'rate' || !key)
                Global.engine.rate(id, options.rate ? pitch : 1.0)    
            if(key == 'pitch' || !key)
                Global.engine.pitch(id, options.pitch ? pitch : 1.0)
            if(key == 'reverse' || !key)
                Global.engine.reverse(id, options.reverse)
        }
        
    }
    
    download(recording){
        Global.engine.encodeAudio(recording.buffer, 'wav', {numChannels:1, sampleRate:44100}).then((data)=>{
            console.log(data)
            this.forceDownload(data, recording.filename)
        }).catch((err)=>{
            console.error(err)
        })  
    }

    initModel(model){
        console.log(model)
    }
    onDeviceChange(inputDeviceId){
        console.log('change device', inputDeviceId)
        Global.engine.initInputSource(inputDeviceId).then((inputSource)=>{
            localStorage.setItem('lastInputDevice', inputDeviceId)
            this.setState({inputDeviceId})
        }).catch((err)=>this.handleError(err))
    }
    onMidiDeviceChange(midiDeviceId){
        if(!midiDeviceId) return
        console.log('change midi device', midiDeviceId)
        Global.engine.initMidiSource(midiDeviceId).then((midiSource)=>{
            localStorage.setItem('lastMidiDevice', midiDeviceId)
            this.setState({midiDeviceId})
        }).catch((err)=>this.handleError(err))
    }
    forceDownload(blob, filename) {
        const a = document.createElement("a");
        a.style = "display: none";
        document.body.appendChild(a);
        var url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    }
    handleError(err){

        console.error(err)
    }
    async loadModel(model, zipContent){

        const zipFile  = "/models/" + model + '.zip'
        this.setState({
            notification:{
                message:'Loading model',
                description:model
            }
        })
        
        if(!zipContent){
            
            try{
                if(!IS_ELECTRON){
                 zipContent = await axios
                    .get(zipFile, {responseType: "arraybuffer"})
                    .then((res) => res.data)
                    .catch((err) => this.handleError(err));
                }else{
                    const fs = window.require('fs')
                    const root = window.require('electron').remote.app.getAppPath()
                    const filePath = root + '/build/audio/models/' + model + '.zip'
                    zipContent = fs.readFileSync(filePath, 'binary')
                }
            }catch(err){
                return this.handleError(err)
            }
        }
        
        return new Promise((resolve, reject)=>{
            const zip = new JSZip()
            
            this.setState({notification:{ message:'Extracting model', description:model}})

            zip.loadAsync(zipContent).then((z)=>{
                const promises = []
                const files = []
                let model;

                Object.keys(z.files).forEach((k)=>{
                    if(z.files[k].name === 'index.json')
                        promises.push(z.files[k].async('text'))
                    else
                        promises.push(z.files[k].async('arraybuffer'))
                })
                console.log('Decompressing', zipFile)
                Promise.all(promises).then((result)=>{
                    for (var i = 0; i < result.length; i++) {
                        if(typeof result[i] === 'string')
                            model = JSON.parse(result[i])
                        else
                            files.push({buffer:result[i], filename:z.files[Object.keys(z.files)[i]].name})

                    }
                    model.files = files;
                    console.log('Done')
                    if(!this.models.filter((m)=> m === model.name).length)this.models.push(model.name)

                    resolve(model)
                }).catch((err)=>{
                    console.error(err)
                    this.setState({notification:null})
                    reject(err)
                })
                
            })
            
        })
    }
    
    render() {
        const {
            init,
            volume,
            sampling, 
            elapsed, 
            ms,
            recording,
            recordingId,
            inputDeviceId, 
            inputDevices, 
            midiDeviceId, 
            midiDevices,
            midiSupported,
            pads, 
            ready,
            loading,
            loudness,
            options,
            playing,
            _tempo
        } = this.state;
        
        
        const countdown = ((ms/1000)-elapsed) ? ((ms/1000)-elapsed).toFixed(0) : 0
        
        const recordings = this.recordings.map((d)=>{ return {label:d.name, value:d.id} })
        recordings.unshift({value:-1, label:recordings.length ? 'Recordings (' + recordings.length + ')' : 'No Recordings'})
        return (
            <div id={'pitch-container'} className={sampling ? 'sampling' : undefined}>
                <div className={'pitch-input-middle'}>
                    <div id='pad-container'>
                        {!sampling ?
                            Object.keys(pads).map((k, idx)=>
                                <div 
                                    key={idx} 
                                    className={pads[k].loaded ? 'pitchpad' : 'pitchpad-inactive'}
                                    style={{backgroundColor: pads[k].playing ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}} 
                                    onMouseDown={(e)=>this.play(pads[k].id)}
                                >
                                    {pads[k].loading && <div className='pad-loader'><AiOutlineLoading/></div>}
                                </div>
                            )
                        : 
                            <div className={'pitch-input-meters'}>    
                                <div className={'pitch-input-meter'}>
                                    <VolumeVisualizer id={'input'} numChannels={1} color={'rgb(125, 31, 31)'} ready={init}/>
                                </div>
                            </div>
                        } 
                        {loading ? <div id="pad-loader-all"><div className='loader-all'><AiOutlineLoading/></div></div> : null}

                    </div>
                    <div id="shifter-buttons">
                        <div className='shifter-button' style={{backgroundColor:'#969f29'}} onClick={()=>{playing ? this.stopAll() : this.replayAll()}}>{playing ? 'STOP' : 'PLAY'}</div>
                        <div className='shifter-button' style={{backgroundColor:'#468e44'}} onClick={()=>{sampling ? this.sample(false) : this.sample(true)}} >{!sampling ? 'SAMPLE' : 'STOP'}</div>
                        <div className='shifter-button' style={{backgroundColor:'#a81e1e'}} onClick={()=>{recording ? this.record(false) : this.record(true)}} >{!recording ? 'REC' : 'STOP'}</div>
                    </div>
                    <table id='shifter-toggles'>
                        <thead>
                            <tr><td>Rate</td><td>Pitch</td><td>Reverse</td><td>Loop</td><td>PLoop</td></tr>
                        </thead>
                        <tbody>
                            <tr><td><Switch height={18} width={40} onChange={(val, e)=>this.setOption('rate', val, e)} checked={options.rate ? true : false}/></td>
                                <td><Switch height={18} width={40} onChange={(val, e)=>this.setOption('pitch', val, e)} checked={options.pitch ? true: false}/></td>
                                <td><Switch height={18} width={40} onChange={(val, e)=>this.setOption('reverse', val, e)} checked={options.reverse}/></td>
                                <td><Switch height={18} width={40} onChange={(val, e)=>this.setOption('loop', val, e)} checked={options.loop}/></td>
                                <td><Switch height={18} width={40} onChange={(val, e)=>this.setOption('ploop', val, e)} checked={options.ploop}/></td>
                            </tr>
                            <tr>
                                <td colSpan={4}>
                                    Tempo<br/>
                                    <input 
                                        className={'range-reverse'}
                                        type="range" 
                                        min="100" 
                                        max="2000" 
                                        value={_tempo}
                                        reverse={'true'}
                                        onMouseUp={(e)=>this.setOption('tempo', parseInt(e.target.value))} 
                                        onChange={(e)=>this.setState({_tempo:e.target.value})}
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={4}>
                                    Volume<br/>
                                    <input

                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        value={volume*100} 
                                        onChange={(e)=>Global.engine.master.volume(parseFloat(e.target.value/100))}
                                    />
                                </td>
                            </tr>
                        </tbody>
                        
                    </table>
                </div>
                <div className={'pitch-input-bottom'}>

                    <Select 
                        value={inputDeviceId} 
                        options={inputDevices.map((d)=>{return {value:d.deviceId, label:d.label}})}
                        center={true}
                        direction={'up'}
                        onChange={(val)=>this.onDeviceChange(val)} 
                    />
                    {midiDevices.length > 0 ?
                        <Select
                            value={midiDeviceId}
                            center={true}
                            direction={'up'}
                            options={ midiDevices.map((d)=>{ return {label:d.name, value:d.deviceId} }) } 
                            onChange={(id) => this.onMidiDeviceChange(id)}
                        />
                    :
                        <Select
                            value={0}
                            center={true}
                            direction={'up'}
                            options={[{label:!midiSupported ? 'MIDI not connected' : 'MIDI not supported', value:0}]} 
                        />
                    }
                    <Select
                        value={recordingId}
                        center={true}
                        direction={'up'}
                        options={ recordings } 
                        onChange={(id) => this.onRecordingSelect(id)}
                    />
                </div>
            </div>

        )
    }
}

export default PitchShifter;
