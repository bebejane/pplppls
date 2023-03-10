import Global from '../../../Global'
import React, { Component } from "react";
import AudioEngine from "../../../services/AudioEngine";
import VolumeVisualizer from "../../visualizers/VolumeVisualizer";
import Select from '../../util/Select';
import Switch from 'react-switch';
import Slider from 'react-input-slider'
import isElectron from 'is-electron';
import "./index.css";
import axios from 'axios'
import JSZip from 'jszip'
const IS_ELECTRON = isElectron()

class InputTest extends Component {
    constructor(props) {
        super(props);
        this.state = {
            model: "test",
            pads:{},
            sampling:false,
            samplingId:null,
            elapsed:0,
            ms:5000,
            stopped:true,
            inputDevices:[],
            inputDeviceId:0,
            options:{},
            selected:null,
            _pitch:1.0
        };
        Global.engine = new AudioEngine({
            sampleRate: 44100,
            channels: 2,
            volume: 1.0,
            electron: IS_ELECTRON,
            enableAnalysers:true,
            processSample:{
                normalize:true,
                trim:true
            }
        });
        
        Global.engine.on('sampling', (id, on)=>{
            this.setState({sampling:on})
        })
        Global.engine.on('samplingprogress', (id, prog)=>{
          this.setState({elapsed:prog.elapsed.toFixed(0)})
        })
        Global.engine.on("inputdevices", (devices) => {
            this.setState({ inputDevices:devices });
        });
        
        this.recordings = []
        this.models = ['test']
        this.canvasRef = React.createRef();
        this.sample = this.sample.bind(this)
        this.sampleId = null
    }
    componentDidMount() {
        this.init();
    }
    componentWillUnmount() {
        this.props.onQuit()
    }
    init(){
        console.log('----------- INIT --------------')
        this.setState({init:false})

        const lastInputDevice = localStorage.getItem('lastInputDevice')
        const lastMidiDevice = localStorage.getItem('lastMidiDevice')

        Global.engine.init(lastInputDevice, lastMidiDevice).then((info)=>{
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
            this.setState({midiDevices:devices})
            const device = devices.filter((d)=> d.deviceId === lastMidiDevice)[0] || devices[0]
            this.onMidiDeviceChange(device.deviceId)
            this.setState({midiSupported:true})
        }).catch((err)=>{
            console.log('MIDI NOT AVAILABLE')
            this.setState({midiSupported:false})
        })

    }
    initDone(){
        console.log('INIT DONE')
        
    }
    async start(){
        this.setState({stopped:false}, async ()=>{
           while(!this.state.stopped){
                try{
                    await this.record(1000*5)
                }catch(err){
                    console.error(err)
                    break;
                }
                await this.sleep(2000)
            }    
        })
    }
    async sleep(ms){
        return new Promise((resolve,rekect)=>{
            setTimeout(()=>resolve(), ms)
        })
    }
    record(ms = 5000){
        
        const id = 'rec'+ Global.engine.sounds.length
        Global.engine.add(id,null,null,{enableAnalyser:true, enableEffects:true})
        //Global.engine.addEffect(id, 'pitchshift', true, {pitch:1.0})
        Global.engine.on('state'+id, (state, updated)=>{
            const pads = this.state.pads
            pads[id] = state;
            this.setState({pads})
            if(updated.playing)
                this.setState({selected:id})
        })
        this.sampleTimeout = setTimeout(()=>this.stop(),ms)
        return this.sample(id, ms)
        
    }
    sample(id, ms){
        
        clearTimeout(this.to)
        return new Promise((resolve, reject)=>{
            this.setState({ms:ms, samplingId:id})
            Global.engine.master.stop()
            Global.engine.sample(id, true).then((recording)=>{
                Global.engine.on('load'+id, (on, i)=>{
                    const {reverse} = this.state.options;
                    if(reverse)  
                        Global.engine.reverse(id, true)
                    //Global.engine.play(id)
                    //Global.engine.once('ended', (id)=>resolve())
                    resolve()
                })
                this.recordings.push(recording)
                return recording
            }).catch((err)=>{
                reject(err)
            }).then(()=>{
                this.setState({samplingId:null})
            })
        })
        this.to = setTimeout(()=>this.stop(), 5000)
    }
    stop(){
        clearTimeout(this.sampleTimeout)
        Global.engine.sample(this.state.sampleId, false)
    }
    download(recording){
        Global.engine.encodeAudio(recording.buffer, 'wav', {numChannels:1, sampleRate:44100}).then((data)=>{
            console.log(data)
            this.forceDownload(data, recording.filename)
        }).catch((err)=>{
            console.error(err)
        })  
    }
    
    play(id){

        
        if(!Global.engine.playing(id)){
            //Global.engine.master.stop()
            Global.engine.play(id, {volume:1.0})
        }
        else
            Global.engine.stop(id)
    }
    setOption(key, value){
        console.log('option', key, value)
        if(!key || value === undefined) return

        const opt = {}
        opt[key] = value;
        
        const options = {...this.state.options, ...opt};
        this.setState({options})
        if(key == 'reverse'){
            Global.engine.stop()
            Global.engine.sounds.forEach((s)=>s.sound.reverse(value))
        }else if(key == 'loop'){
            console.log(value)
            Global.engine.sounds.forEach((s)=>s.sound.loop(value))
        }else if(key == 'pitch'){
            Global.engine.sounds.forEach((s)=>{
                console.log('pitch', value)
                s.sound.pitch(value)
                s.sound.play()
            })
        }
        //this.setState(opt)
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

        const zipFile  = "/audio/models/" + model + '.zip'
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
                    if(!this.models.filter((m)=> m === model.name).length)
                        this.models.push(model.name)

                    this.setState({notification:null, model:model.name})
                    resolve(model)
                }).catch((err)=>{
                    this.setState({notification:null})
                    reject(err)
                })
                
            })
            
        })
    }
    
    render() {
        const {init, sampling, elapsed, ms, inputDeviceId, inputDevices, stopped, pads, _pitch, pitch, reverse, loop, options} = this.state;
        const countdown = !sampling ? 0 : ((ms/1000)-elapsed) ? ((ms/1000)-elapsed).toFixed(0) : 0

        return (
            <div id={'container-input'} className={sampling || stopped ? 'sampling' : undefined}>
                <div className={'input-top'}>
                    <div className={'input-counter'}>{countdown > 0 ? countdown : ''}</div>
                    <div className={'input-meters'}>    
                        <div className={'inputtest-meter'}>
                            <VolumeVisualizer id={'input'} numChannels={1} color={'rgb(125, 31, 31)'} ready={init}/>
                        </div>
                        <div className={'inputtest-meter'}>
                            <VolumeVisualizer id={'master'} numChannels={2} color={'rgb(172, 146, 42)'} ready={init}/>
                        </div>
                    </div>
                     <div className={'input-middle'}>
                        <div>
                            <div id='play' onClick={()=>{!sampling ? this.record() : this.stop() }}>{!sampling ? 'REC' : 'STOP'}</div>
                        </div>
                        <div id='paddy-container'>
                            {Object.keys(pads).filter((k)=>pads[k].loaded).map((k, idx)=>
                                <div key={idx} className={'paddy'} style={{backgroundColor: pads[k].playing ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}} onMouseDown={(e)=>this.play(pads[k].id)}/>
                            )}
                        </div>
                        <div id='inputtest-tools'>
                            <Switch onChange={(val, e)=>this.setOption('reverse', val, e)} checked={options.reverse}/>
                            <div>REV</div>
                            <Switch onChange={(val, e)=>this.setOption('loop', val, e)} checked={options.loop}/>
                            <div>LOOP</div>

                            <div>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="200" 
                                    value={_pitch*100} 
                                    onMouseUp={(e)=>this.setOption('pitch', parseFloat(e.target.value/100))} 
                                    onChange={(e)=>this.setState({_pitch:e.target.value/100})}
                                />
                            </div>
                            <div>PITCH</div>
                        </div>
                    </div>
                </div>
                <div className={'input-bottom'}>
                    <Select 
                        value={inputDeviceId} 
                        options={inputDevices.map((d)=>{return {value:d.deviceId, label:d.label}})}
                        center={true}
                        direction={'up'}
                        onChange={(val)=>this.onDeviceChange(val)} 
                    />
                </div>
            </div>
        )
    }
}

export default InputTest;
