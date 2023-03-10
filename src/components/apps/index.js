import Global from '../../Global'
import React, { Component } from 'react';
import AudioEngine from '../../services/AudioEngine';
import Select from '../util/Select';
import isElectron from 'is-electron';


class PurpleApp extends Component {
    constructor(props) {
        super(props);
        this.state = {
            init:false,
            inputDevices:[],
            inputDeviceId:null,
            midiSupported:null,
            midiDevices:[],
            midiDeviceId:null,
            sampling:false,
            recording:false
        };
        this.engineOptions = {
            sampleRate: 44100,
            channels: 2,
            volume: 1.0,
            electron:this.isElectron(),
        }
        this.appId = 'PurpleApp'
        this.recordings = []
        this.lastInputDevice = localStorage.getItem('lastInputDevice')
        this.lastMidiDevice = localStorage.getItem('lastMidiDevice')
    }
    componentDidMount() {
        this.init()
    }
    componentWillUnmount() {
        this.props.onQuit()
    }
    isElectron(){
        return isElectron()
    }

    init(){
        console.log('----------- INIT --------------')
        this.setState({init:false})
        Global.engine = new AudioEngine(this.engineOptions);
        
        Global.engine.on('sampling', (id, on)=>{
            this.setState({sampling:on})
        })
        Global.engine.on('inputdevices', (devices) => {
            this.setState({ inputDevices:devices });
        });
        Global.engine.on('mididevices', (devices) => {
            this.setState({ midiDevices:devices, midiSupported:true });
        });
        Global.engine.on('error', (err) => {
            this.handleError(err)
        });
        Global.engine.init(this.lastInputDevice, this.lastMidiDevice).then((info)=>{
            console.log(info)
            if(info.devices){
                const device = info.devices.filter((d)=> d.deviceId === this.lastInputDevice)[0] ||  info.devices.filter((d)=> d.label.toLowerCase().includes('microphone'))[0] || info.devices[0]
                this.setState({inputDeviceId:device.deviceId, inputDevices:info.devices})
                this.setState({init:true})
                this.initDone()
            }else
                this.handleError('Init failed')
            
        }).catch((err)=>{
            this.handleError(err)
        })

        Global.engine.initMidi().then((devices)=>{
            this.setState({midiDevices:devices, midiSupported:true})
            if(!devices.length) return
            const device = devices.filter((d)=> d.deviceId === this.lastMidiDevice)[0] || devices[0]
            this.onMidiDeviceChange(device.deviceId)
        }).catch((err)=>{
            console.log('MIDI NOT AVAILABLE')
        })
    }
    initDone(){
        console.log('INIT DONE')
    }
    handleError(err){
        console.error(err)
    }
    onDeviceChange(inputDeviceId){
        console.log('change input device', inputDeviceId)
        Global.engine.initInputSource(inputDeviceId).then(()=>{
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
    download(idx){
        this.setState({recordingId:idx})
        if(idx < 0) return
        const recording = this.recordings[idx];
        Global.engine.encodeAudio(recording.buffer, 'wav', {numChannels:recording.buffer.numberOfChannels, sampleRate:Global.engine.sampleRate}).then((data)=>{
            this.forceDownload(data, recording.filename)
        }).catch((err)=>{
            this.handleError(err)
        })  
    }
    forceDownload(blob, filename) {
        const a = document.createElement('a');
        a.style = 'display: none';
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
    inputDeviceSelect(dir = 'down', center = false){
        return (
            <Select 
                value={this.state.inputDeviceId}
                direction={dir}
                center={center}
                options={this.state.inputDevices.map((d)=>{return {value:d.deviceId, label:d.label}})}
                onChange={(val)=>this.onDeviceChange(val)}
            />
        )
    }
    midiDeviceSelect(dir = 'down', center = false){
        return (
            <Select 
                value={this.state.midiDeviceId}
                direction={dir}
                center={center}
                options={this.state.midiDevices.map((d)=>{return {value:d.deviceId, label:d.label}})}
                onChange={(val)=>this.onMidiDeviceChange(val)}
            />
        )
    }
    render() {
        return <div>{this.appId}</div>
    }
}

export default PurpleApp;