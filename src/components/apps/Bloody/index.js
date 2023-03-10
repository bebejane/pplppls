import Global from '../../../Global'
import React, { Component } from "react";
import Switch from 'react-switch';
import Slider from 'react-input-slider'
import AudioEngine from "../../../services/AudioEngine";
import BloodyVisualizer from "../../visualizers/BloodyVisualizer";
import Select from '../../util/Select';
import isElectron from 'is-electron';
import "./index.css";

class Bloody extends Component {
    constructor(props) {
        super(props);
        this.state = {
          inputDevices:[],
          inputDeviceId:null,
          playing:false,
          recordingId:-1,
          reverse:true
        };
        Global.engine = new AudioEngine({
            sampleRate: 44100,
            channels: 2,
            volume: 1.0,
            enableAnalysers:true,
            processSample: false 
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
        this.canvas = null;
        this.recordings = []
        this.canvasRef = React.createRef();
        this.containerRef = React.createRef();
        this.points = []
    }
    componentDidMount() {
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
            if(info.devices){
                const device = info.devices.filter((d)=> d.deviceId === lastInputDevice)[0] ||  info.devices.filter((d)=> d.label.toLowerCase().includes('microphone'))[0] || info.devices[0]
                this.setState({inputDeviceId:device.deviceId, inputDevices:info.devices})
            } 
            this.setState({init:true})
            this.start()
        }).catch((err)=>{
            this.handleError(err)
        })
        
    }
    onDeviceChange(inputDeviceId){
        console.log('change device', inputDeviceId)
        Global.engine.initInputSource(inputDeviceId).then((inputSource)=>{
            localStorage.setItem('lastInputDevice', inputDeviceId)
            this.setState({inputDeviceId})
        }).catch((err)=>this.handleError(err))
    }
    async start(){
             
    }
    
    async sleep(ms){
        return new Promise((resolve,rekect)=>{
            setTimeout(()=>resolve(), ms)
        })
    }
    
    handleError(err){
        console.error(err)
    }
    
    render() {
        const {init, inputDeviceId, inputDevices, } = this.state;

        return (
            <div id={'bloody-container'} ref={this.containerRef}>
                <div id={'bloody-visualizer'}>
                    <BloodyVisualizer id='input' color='#ff00FF' ready={init} options={{interval:10}} clear={false} speed={15} />
                </div>
                <div id={'bloody-devices'}>
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

export default Bloody;