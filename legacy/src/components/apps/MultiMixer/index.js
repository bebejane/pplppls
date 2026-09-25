import Global from '../../../Global'
import React, { Component } from "react";
import "./index.css";
import isElectron from 'is-electron';
import ChannelStatus from './ChannelStatus'
import Settings from './Settings'
import Effects from './Effects'
import TitleBar from "../../util/TitleBar";
import FileUploader from "../../util/FileUploader";
import VolumeVisualizer from "../../visualizers/VolumeVisualizer";
import AudioEngine from "../../../services/AudioEngine";
import hotkeys from "hotkeys-js";
import moment from "moment";
import axios from "axios";
import Slider from 'react-input-slider';
import JSZip from 'jszip'

const IS_ELECTRON = isElectron()

class MultiMixer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            channels:{},
            master:{},
            numChannels: 9,
            midiDevices:[],
            inputDevices:[],
            effect:true,
            showSettings:false,
            enableMeters:true,
            enableElapsed:true,
            showEffects:{}
        };
        Global.engine = new AudioEngine({
            sampleRate: 44100,
            channels: 2,
            volume:0.3,
            electron:IS_ELECTRON,
            enableAnalysers:true
        });
        this.models = []

        global.engine = Global.engine
        global.engine.initModel = this.initModel.bind(this)
        //this.onMidiMapMoteOn = this.onMidiMapMoteOn.bind(this)
        this.recordings = []
        this.channels = {}


    }
    componentDidMount() {

        hotkeys("space", (e) => {
            if(!Global.engine.master.isPlaying())
                Global.engine.master.play()
            else
                Global.engine.master.stop()
        });
        hotkeys("alt+space", (e) => {
           this.randomValues()
        });
        hotkeys("a", (e) => {
           this.addChannel()
        });

        this.init()
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
            const device = info.devices.filter((d)=> d.deviceId === lastInputDevice)[0] ||  info.devices.filter((d)=> d.label.toLowerCase().includes('microphone'))[0] || info.devices[0]
            this.setState({inputDeviceId:device.deviceId, inputDevices:info.devices})
            this.initModel()
        }).catch((err)=>{
            this.handleError(err)
        })

        Global.engine.initMidi().then((devices)=>{
            if(devices.length <= 0)
                return

            this.setState({midiDevices:devices})
            const device = devices.filter((d)=> d.deviceId === lastMidiDevice)[0] || devices[0]
            this.onMidiDeviceChange(device.deviceId)
        }).catch((err)=>{
            console.log(err)
            console.log('MIDI NOT AVAILABLE')
            //this.handleError(err)
        })

    }
    onDeviceChange(inputDeviceId){
        console.log('change device', inputDeviceId)
        Global.engine.initInputSource(inputDeviceId).then((inputSource)=>{
            this.setState({inputDeviceId})
        }).catch((err)=>this.handleError(err))
    }
    onMidiDeviceChange(midiDeviceId){
        if(!midiDeviceId) return
        console.log('change midi device', midiDeviceId)
        Global.engine.initMidiSource(midiDeviceId).then((midiSource)=>{

            this.setState({midiDeviceId})
        }).catch((err)=>this.handleError(err))
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
                    const filePath = root + '/build' + zipFile;
                    zipContent = fs.readFileSync(filePath, 'binary')
                }
            }catch(err){
                return this.handleError(err)
            }
        }
        
        this.setState({notification:{ message:'Extracting model', description:model}})
        return new Promise((resolve, reject)=>{
            const zip = new JSZip()
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
                    
                    if(!this.models.filter((m)=> m === model.name).length)
                        this.models.push(model.name)

                    this.setState({notification:null, model:model.name})
                    resolve(model)
                    console.log('Done')
                }).catch((err)=>{
                    this.setState({notification:null})
                    reject(err)
                })
                
            })
            
        })
    }
    async initModel(model = 'groupies', opt = {}) {

        Global.engine.destroy();
        const config = await this.loadModel(model)

        const state = {
            channels:{},
            master:{...Global.engine.master.state},
            model: model,
            loaded: 0,
            loading:true,
            numChannels:opt.numChannels || this.state.numChannels
        };
        console.log(config)

        Global.engine.on("create", (id, channel) => {

            const chans = this.state.channels;

            chans[id] = {
                id:id,
                state:{},
                effects:{}
            }
            this.channels[id] = channel;
            this.setState({channels:chans})
            Global.engine.on('state'+id, (state)=>{
                const channels = this.state.channels;
                channels[id].state = state;
                this.setState({channels})
            })
        });
        Global.engine.on("ready", (id, status) => {

            const progress = {
                loaded:status.ready,
                total:status.total
            }
            this.setState({progress});
        });

        
        
        Global.engine.on('masterstate', (state)=>{
            this.setState({master:state})
        })
        Global.engine.on('noteon', (note)=>{
            //if(this.state.master.mapMode)
              //  thsi.engine.mapMidiNote()
            console.log(note)
            //this.setState({master:state})
        })
        Global.engine.on('midimapnote', (id, note)=>{
            //if(this.state.master.mapMode)
              //  thsi.engine.mapMidiNote()
            console.log('mapnote', note)

            //this.setState({master:state})
        })
        Global.engine.on("encodingprogress", (percentage) => {
            const notification = {...this.state.notification, description:percentage.toFixed(0) + '%'}
            this.setState({notification});
        });
        Global.engine.on("error", (err, id) => {
            console.error("ERROR", err);
        });
        Global.engine.on("loaderror", (err, id) => {
            console.error("LOADERROR", err, id);

            const channels = this.state.channels;
            channels[id].error = err;
            channels[id].loading = false
            this.setState({channels})
        });

        Global.engine.on("loadingprogress", (progress) => {
            console.log(progress)
            this.setState({ progress });
        });
        Global.engine.on('sampleprocess', (id, on)=>{
            //return console.log('processing', id)
            const channels = this.state.channels;
            channels[id].state.sampleprocess = on
            this.setState({channels})
        })
        this.setState({...state}, ()=>{

            for (var i = 0; i < state.numChannels ; i++){
                const channelId = 'channel'+(i)
                const objURL = URL.createObjectURL(new Blob([config.files[i].buffer], {type:Global.fileToMimeType(config.files[i].filename)}))
                Global.engine.add(channelId, objURL, config.files[i].filename, {enableElapsed:true})
                //Global.engine.addEffect(channelId,  'delay')
                //Global.engine.addEffect(channelId,  'flanger')
            }
            Global.engine.load();
        })

    }
    addChannel(){
        let channel = 0;
        Global.engine.sounds.forEach((s)=>{
            console.log(s.id)
            if(parseInt(s.id.replace('channel', '')) > channel)
                channel = parseInt(s.id.replace('channel', ''))
        })
        const id = 'channel' + (channel+1)
        Global.engine.add(id)
    }
    removeChannel(id){
        const channels = this.state.channels
        delete channels[id]
        Global.engine.remove(id)
        this.setState({channels})
    }
    resetChannel(id){
        Global.engine.reset(id)
    }
    clearChannels(){
        Global.engine.removeAll()
        this.setState({channels:{}})

    }
    reinitModel(opt) {
        this.initModel(this.state.model, opt);
    }
    onChangeVolume(id, y){
        const vol = y;
        if(id === 'master')
            return Global.engine.master.volume(vol/100)
        Global.engine.volume(id, vol/100)
    }
    onChangeRate(id, y){

        const rate = y*2;
        if(id === 'master')
            return Global.engine.master.rate(rate/100)
        Global.engine.rate(id, rate/100)
    }
    onChangePan(id, y){

        const pan = y <= 50 ? (-90+(y*2)): 90-(-(y-50)*2)-100

        if(id === 'master')
            return Global.engine.master.pan(pan)

        Global.engine.pan(id, pan)
    }
    onMute(id, on){
        if(id === 'master')
            return Global.engine.master.mute(on)

        Global.engine.mute(id, on)
    }

    onPause(id, on){
        if(id === 'master')
            return Global.engine.master.pause(on)

        Global.engine.pause(id, on)
    }
    onLock(id, on){
        if(id === 'master')
            return Global.engine.master.locked(on)

        Global.engine.lock(id, on)
    }
    onMidiMap(id, on){

        console.log('midi map mode', on)
        Global.engine.midiMapMode(id, on)
    }

    onSolo(id, on, multi){
        Global.engine.solo(id, on, multi)
    }
    onRecord(start) {

        if (start) {
            Global.engine.record(true).then((recording)=>{
                this.recordings.push(recording)
                this.setState({ recording: true});
            }).catch((err)=>{
                this.handleError(err)
                this.setState({ recording: false});
            })
        } else {
            Global.engine.record(false)
        }
    }
    onSampleRecord(id, start) {


        const channels = this.state.channels
        const recordNext = Global.engine.recording && start && this.sampleId;

        if(recordNext)
            return Global.engine.sample(this.sampleId, false);
        
        this.sampleId = id;
        if (start) {
            Global.engine.sample(id, true).then((recording)=>{
                console.log('done recording')
                this.setState({ sampling: false});
            }).catch((err)=>{
                this.handleError(err)
                this.setState({ sampling: false});
            })
        } else {
            Global.engine.sample(id, false)
        }
    }
    onUpload(id, upload, x) {
        console.log("upload", id, upload.filename);
        
        const objURL = URL.createObjectURL(new Blob([upload.contents]), {
            type: Global.fileToMimeType(upload.filename)
        });
        Global.engine.replace(id, objURL, upload.filename);
    }
    async onMultiUpload(id, uploads) {
        console.log("multi upload", id, uploads);

        for (var i = 0; i < uploads.length && i < this.state.numChannels; i++)
            this.onUpload('channel'+i, uploads[i], i)
    }
    onShowEffects(id){
        const showEffects = {...this.state.showEffects}
        showEffects[id] = true;
        this.setState({showEffects})
    }
    onCloseEffects(id){
        const showEffects = {...this.state.showEffects}
        delete showEffects[id]
        this.setState({showEffects})
    }
    onEffectParams(id, type, opt){
        const bypass = Global.engine.effectBypass(id, type)
        Global.engine.effectBypass(id, type, !bypass)
        this.setState({effect:!bypass})
    }
    onChangeDelay(id, type, y){
        console.log('change delay', id, type, y)
        const opt = {
            wetLevel:{
                value:y/100
            } 
        }
        Global.engine.effectParams(id, type, opt)
    }
    onChangeDelayFeed(id, type, y){

        let feedback = (y/100)*0.9
        console.log('change feedback', id, type, y)
        const opt = {
            feedback:{
                value:feedback
            } 
        }
        Global.engine.effectParams(id, type, opt)
    }
    onChangeLoop(id, start, duration, y){
        const channels = this.state.channels
        const channel = channels[Object.keys(channels).filter((k)=>channels[k].id === id)[0]]
        let e = duration-((y/100)*duration)
        const opt ={
            start:start ? ((y/100)*duration) : undefined,
            end:!start ? e : undefined
        }
        if (opt.start > channel.state.loopEnd)
            opt.end = opt.start
        if (opt.end < channel.state.loopStart)
            opt.start = opt.end;
        Global.engine.loop(id, true, opt)
    }
    onChangeEffect(id, type, param, y){

        let delayTime = (y/100)*980
        console.log('change delaytime', id, type, y, delayTime)
        const opt = {
            delayTime:{
                value:delayTime
            } 
        }
        Global.engine.effectParams(id, type, opt)
    }

    async onDownloadRecording(id, type = 'wav') {
        const recording = this.recordings.filter((r) => r.id === id)[0];

        if(type === 'wav')
            return this.forceDownload(recording.blob, recording.filename);

        this.setState({ notification: {message:'Encoding to mp3...', description:'0%'} });
        Global.engine.encodeAudio(recording.buffer, 'mp3').then((blob) => {
            this.forceDownload(blob, recording.name + ".mp3");
        }).catch((err)=>{
            if(err === 'CANCELLED')
                return console.log('encoding cancelled')
            this.handleError(err)
        }).then(()=>this.setState({notification:null}))

    }
    async onDownloadSample(id) {
        const s = Global.engine.get(id)
        const blob = new Blob( [s.sound._buffer], { 'type' : s.sound.mimeType });
        this.forceDownload(blob, s.sound.filename);
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
    randomValues(){
        this.randomRates()
        this.randomMutes()
        this.randomVolumes()
        this.randomPans()
        this.randomLoops()
        Global.engine.master.stop()
        Global.engine.master.play()
    }
    randomRates(){
        Object.keys(this.state.channels).forEach((k)=>{
            const channel = this.state.channels[k]
            const rand = Math.random() * (1.0 - 0.0) + 0.0
            Global.engine.rate(channel.id, rand)
        })


    }
    randomMutes(){
        Object.keys(this.state.channels).forEach((k)=>{
            const channel = this.state.channels[k]
            const rand = Math.random() * (1 - 0.0) + 0.0
            Global.engine.mute(channel.id, (rand > 0.5))
        })

    }
    randomVolumes(){
        Object.keys(this.state.channels).forEach((k)=>{
            const channel = this.state.channels[k]
            const rand = Math.random() * (1 - 0.0) + 0.0
            Global.engine.volume(channel.id, rand)
        })

    }
    randomPans(){
        Object.keys(this.state.channels).forEach((k)=>{
            const channel = this.state.channels[k]
            const rand = Math.random() * (180 - 0.0) + 0.0
            Global.engine.pan(channel.id, rand-90)
        })

    }
    randomLoops(){
        Object.keys(this.state.channels).forEach((k)=>{
            const channel = this.state.channels[k]
            const state = channel.state;
            const start = Math.random() * (state.duration - 0.0) + 0.0
            const end = (Math.random() * (state.duration-start - 0.0) + 0.0)
            Global.engine.loop(channel.id, true, {start:start,end:end})
        })

    }
    formatDuration(sec, rate){
        const time = moment.utc(moment.duration(rate ? sec/rate : sec , "seconds").asMilliseconds())
        return time.format((time.hours()>0 ? 'HH:' : '') + 'mm:ss:SSS')
    }
    handleError(err){
        console.error('handleError', err)
    }
    onClick(e){
        //const el = e.nativeEvent.originalTarget.parentElement;

    }
    render() {
        const {
            midiDevices,
            inputDevices,
            master,
            showSettings,
            showEffects
        } = this.state;

        const channels = Object.keys(this.state.channels).map((k, channelIdx) => {
            const channel = this.state.channels[k];
            const state = channel.state || {}
            
            return (
                <div key={"c" + channelIdx} className={"mixer-channel"} id={channel.id}>
                    <div className={"mixer-channel-top"}>
                        <div className={"mixer-channel-volume"}>
                            <VolumeVisualizer id={channel.id} color={'#ddace2'} ready={true}/>
                            {state.sampling && <VolumeVisualizer id={'input'} color={'#ffff00'} ready={true}/>}
                        </div>
                        <div className={"mixer-channel-sliders"}>
                           <Slider
                                id={channelIdx+'s'}
                                key={channelIdx} 
                                axis={'y'}
                                max={1.0}
                                min={0}
                                y={(channel.state.mutedVol || channel.state.volume)*100} 
                                value={channel.state.mutedVol || channel.state.volume}
                                ystep={0.01}
                                yreverse={true}
                                onChange={(axis)=>this.onChangeVolume(channel.id, axis.y)}
                                styles={trackStyle}
                            />
                            <Slider
                                id={channelIdx+'r'}
                                key={channelIdx+'r'} 
                                axis={'y'}
                                max={2.0}
                                min={0.0}
                                y={(channel.state.rate*100)/2}
                                ystep={0.01}
                                yreverse={true}
                                onChange={(axis)=>this.onChangeRate(channel.id, axis.y)}
                                styles={rateStyle}
                            />
                             <Slider
                                id={channelIdx+'p'}
                                key={channelIdx+'p'} 
                                axis={'y'}
                                max={100}
                                min={0}
                                y={channel.state.panWidth} 
                                value={channel.state.panWidth}
                                ystep={1}
                                yreverse={true}
                                onChange={(axis)=>this.onChangePan(channel.id, axis.y)}
                                styles={panStyle}
                            />
                            <div className={'double-slider'}>

                                <Slider
                                    id={channelIdx+'c'}
                                    key={channelIdx+'c'} 
                                    axis={'y'}
                                    max={100}
                                    min={0}
                                    y={ ((state.duration-state.loopEnd)/state.duration)*100}
                                    ystep={0.01}
                                    yreverse={false}
                                    onChange={(e)=>this.onChangeLoop(channel.id, false, state.duration, e.y)}
                                    styles={wetStyle}
                                />

                                <Slider
                                    id={channelIdx+'e'}
                                    key={channelIdx+'e'} 
                                    axis={'y'}
                                    max={100}
                                    min={0}
                                    y={ (state.loopStart/state.duration)*100}
                                    //y={}
                                    ystep={1}
                                    yreverse={true}
                                    onChange={(e)=>this.onChangeLoop(channel.id, true, state.duration, e.y)}
                                    styles={wetStyle}
                                />
                            </div>
                            {/*}
                            <Slider
                                id={channelIdx+'e'}
                                key={channelIdx+'e'} 
                                axis={'y'}
                                max={100}
                                min={0}
                                y={params && params.wetLevel ? params.wetLevel.value*100 : 0} 
                                ystep={0.01}
                                yreverse={true}
                                onChange={(e)=>this.onChangeDelay(channel.id, 'delay', e.y)}
                                styles={wetStyle}
                            />

                            <Slider
                                id={channelIdx+'f'}
                                key={channelIdx+'f'} 
                                axis={'y'}
                                max={params && params.feedback ? params.feedback.max : 0} 
                                min={params && params.feedback ? params.feedback.min : 0} 
                                y={params && params.feedback ? params.feedback.value*100 : 0} 
                                ystep={1}
                                yreverse={true}
                                onChange={(e)=>this.onChangeDelayFeed(channel.id, 'delay', e.y)}
                                styles={feedStyle} 
                            />
                            <Slider
                                id={channelIdx+'t'}
                                key={channelIdx+'t'} 
                                axis={'y'}
                                max={100} 
                                min={0}
                                max={params && params.delayTime ? params.delayTime.max : 0} 
                                min={params && params.delayTime ? params.delayTime.min : 0} 
                                y={params && params.delayTime ? (params.delayTime.value/1000)*100 : 0}
                                ystep={1}
                                yreverse={true}
                                onChange={(e)=>this.onChangeEffect(channel.id, 'delay', 'wetLevel', e.y)}
                                styles={feedStyle} 
                            />
                        */}
                        </div>
                    </div>
                    <div className={"mixer-channel-bottom"}>
                        <div className={"mixer-channel-controls"}>
                            <div className={"mixer-channel-controls-buttons"}>
                                <div className={state.playing ? 'channel-btn-on' : ''} onMouseDown={()=>Global.engine.play(channel.id)}>PLAY</div>
                                <div onMouseDown={()=>Global.engine.stop(channel.id)}>STOP</div>
                                <div className={state.loop ? 'channel-btn-on' : ''} onMouseDown={()=>Global.engine.loop(channel.id, !state.loop)}>LOOP</div>
                                <div className={state.sampleprocess ? 'channel-btn-loading' : state.sampling ? 'channel-btn-record' : ''} onMouseDown={()=>this.onSampleRecord(channel.id, !state.sampling)}>REC</div>
                                <div className={state.reversed ? 'channel-btn-on' : ''} onMouseDown={()=>Global.engine.reverse(channel.id, !state.reversed)}>REV</div>
                                <div className={state.solo ? 'channel-btn-on' : ''} onMouseDown={(e)=>this.onSolo(channel.id, !state.solo, e.metaKey)}>SOLO</div>
                                <div className={state.muted ? 'channel-btn-on' : ''} onMouseDown={()=>this.onMute(channel.id, !state.muted)}>MUTE</div>
                                <div className={state.paused ? 'channel-btn-on' : ''} onMouseDown={()=>this.onPause(channel.id, !state.paused)}>PAUSE</div>
                                
                                <div className={state.locked ? 'channel-btn-on' : ''} onMouseDown={()=>this.onLock(channel.id, !state.locked)}>LOCK</div>
                                <div className={state.midiMapMode ? 'channel-btn-map' : ''} onMouseDown={()=>this.onMidiMap(channel.id, !state.midiMapMode)}>MIDI</div>
                                <div onMouseDown={()=>this.onShowEffects(channel.id)}>EFF</div>
                                <div onMouseDown={()=>this.removeChannel(channel.id)}>DEL</div>
                                <div onMouseDown={()=>{this.resetChannel(channel.id)}}>RESET</div>
                            </div>
                                                         
                        </div>
                        
                         
                        <ChannelStatus
                            loading={!state.ready} 
                            name={state.filename}
                            id={channel.id}
                            duration={state.duration} 
                            rate={state.rate}
                            start={state.loopStart}
                            end={state.loopEnd}
                        >
                            <FileUploader
                              id={channel.id}
                                multi={true}
                                onUpload={(buffer, filename) => this.onUpload(channel.id, buffer, filename)}
                                onMultiUpload={(files) =>this.onMultiUpload('master', files)}
                            />   
                        </ChannelStatus>
                        
                        <Effects 
                            id={channel.id} 
                            effects={state.effects} 
                            show={showEffects[channel.id]}
                            onClose={()=>this.onCloseEffects(channel.id)}
                        />
                        
                    </div>
                 </div>
            )
        })
        
        const masterChannel =
            <div key={"master"} id={'master-channel'} className={"mixer-channel"}>
                <div className={"mixer-channel-top"}>
                    <div className={"mixer-channel-volume"}>
                        <VolumeVisualizer id={'master'} color={'#ddace2'} ready={true}/>
                        <VolumeVisualizer id={'input'} color={'#ffff00'} ready={true}/>
                    </div>
                    <div className={"mixer-channel-sliders"}>
                       <Slider
                            id={'master-volume'}
                            key={'master-volume'} 
                            axis={'y'}
                            max={1.0}
                            min={0}
                            y={master.volume*100} 
                            value={master.volume}
                            ystep={0.01}
                            yreverse={true}
                            onChange={(axis)=>this.onChangeVolume('master', axis.y)}
                            styles={masterStyle}
                        />

                    </div>
                </div>
                <div className={"mixer-channel-bottom"} >
                    <div className={"mixer-channel-controls"}>
                        <div className={"mixer-channel-controls-buttons"}>
                        
                            <div className={master.playing ? 'channel-btn-on' : ''} onClick={()=>Global.engine.master.play()}>PLAY</div>
                            <div onMouseDown={()=>Global.engine.master.stop()}>STOP</div>
                            <div className={master.looping ? 'channel-btn-on' : ''} onMouseDown={()=>Global.engine.master.loop(!master.looping)}>LOOP</div>
                            <div className={master.recording ? 'channel-btn-record' : ''} onMouseDown={()=>this.onRecord(!master.recording)}>REC</div>
                            <div className={master.muted ? 'channel-btn-on' : ''} onMouseDown={()=>this.onMute('master', !master.muted)}>MUTE</div>
                            <div className={master.paused ? 'channel-btn-on' : ''} onMouseDown={()=>this.onPause('master', !master.paused)}>PAUSE</div>
                            <div className={master.locked ? 'channel-btn-on' : ''} onMouseDown={()=>Global.engine.master.locked(!master.locked)}>LOCK</div>
                            <div onMouseDown={()=>this.addChannel()}>ADD</div>
                            <div onMouseDown={()=>this.clearChannels()}>CLEAR</div>
                            <div onMouseDown={()=>this.setState({showSettings:true})}>SETT</div>
                            <div onMouseDown={()=>this.randomValues()}>MJBJ</div>
                            <div>&nbsp;</div>
                            <div>&nbsp;</div>
                        </div>
                    </div>
                    <ChannelStatus name={'MASTER'} id={'master'} duration={master.duration} rate={master.rate}/>
                </div>

            </div>

        //if(Object.keys(channels).length)channels.push(masterChannel)

        return (
            <React.Fragment>
                {IS_ELECTRON && <TitleBar title={'purplepurples'}/>}
                <div id="multi-mixer-container">
                    
                    <div id="multi-mixer" >
                        {channels}
                        <div className="channel-spacer">
                        <FileUploader
                                id={'master'}
                                multi={true}
                                onMultiUpload={(files) =>this.onMultiUpload('master', files)}
                            />   
                        </div>
                        {masterChannel}
                        {/*
                        <FileUploader
                            id={'master-uploader'}
                            multi={true}
                            onClick={(e)=>this.onClick(e)}
                            onMultiUpload={(files) =>this.onMultiUpload('master', files)}
                        />
                        */}
                    </div>
                    <Settings
                        active={showSettings}
                        midiDevices={midiDevices} 
                        inputDevices={inputDevices} 
                        onMidiDeviceChange={(id)=>this.onMidiDeviceChange(id)} 
                        onDeviceChange={(id)=>this.onDeviceChange(id)}
                        onDownload={(id)=>this.onDownloadRecording(id, 'wav')}
                        onClose={()=>this.setState({showSettings:false})} 
                        recordings={this.recordings}
                    />
                </div>
            </React.Fragment>
        );
    }
}

const trackWidth = 20;
const trackStyle = {
    track: {
        height:'100%',
        maxWidth:trackWidth,
        minWidth:trackWidth,
        backgroundColor: 'transparent',
        borderRadius:0
    },
    active: {
      backgroundColor: 'pink',
      borderRadius:0
    },
    thumb: {
      width: trackWidth,
      height: trackWidth,
      borderRadius:0,
      backgroundColor:'rgba(255,55,55,0.1)'
    },
    disabled: {
      opacity: 0.5
    }
}
const rateStyle = {...trackStyle,
    active: {
      backgroundColor: 'orange',
      borderRadius:0
    }
}
const panStyle = {...trackStyle,
    active: {
      backgroundColor: '#dd8cdd',
      borderRadius:0
    }
}
const wetStyle = {...trackStyle,
    active: {
      backgroundColor: '#a4a88c',
      borderRadius:0
    }
}
/*
const feedStyle = {...trackStyle,
    active: {
      backgroundColor: '#9090ce',
      borderRadius:0
    }
}
*/
const masterStyle = {...trackStyle,
    track:{
        ...trackStyle.track,
        minWidth:'80px',
        maxWidth: '80px'
    },
    thumb:{
      ...trackStyle.thumb,
        minWidth:'80px',
        maxWidth: '80px'
    }
}

export default MultiMixer;
