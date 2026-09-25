import Global from '../../../Global'
import AudioEngine from "../../../services/AudioEngine";
import React, { Component } from "react";
import "./index.css";
import Switch from 'react-switch';
import Slider from 'react-input-slider'
import FrequencyVisualizer from "../../visualizers/FrequencyVisualizer";
import VolumeVisualizer from "../../visualizers/VolumeVisualizer";
import OscilloscopeVisualizer from "../../visualizers/OscilloscopeVisualizer";
import Select from '../../util/Select';
import isElectron from 'is-electron';
const IS_ELECTRON = isElectron()
const fftSize = [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192/*, 16384, 32768*/]

class Test extends Component {
    constructor(props) {
        super(props);
        this.state = {
            pads:{},
            sampling:false,
            samplingId:null,
            elapsed:0,
            ms:5000,
            stopped:true,
            inputDevices:[],
            inputDeviceId:0,
            options:{},
            volume:0,
            selected:null,
            freqOptions:{fftSize:fftSize[6]},
            volumeOptions:{fftSize:fftSize[0]},
            oscilloscopeOptions:{fftSize:fftSize[7]},
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
        
        
        Global.engine.on('sampling', (id, on)=>{
            this.setState({sampling:on})
        })
        Global.engine.on('samplingprogress', (id, prog)=>{
          this.setState({elapsed:prog.elapsed.toFixed(0)})
        })
        Global.engine.on("inputdevices", (devices) => {
            this.setState({ inputDevices:devices });
        });
        const lastInputDevice = localStorage.getItem('lastInputDevice')
        const lastMidiDevice = localStorage.getItem('lastMidiDevice')

        Global.engine.init(lastInputDevice, lastMidiDevice).then((info)=>{
            if(info.devices){
                const device = info.devices.filter((d)=> d.deviceId === lastInputDevice)[0] ||  info.devices.filter((d)=> d.label.toLowerCase().includes('microphone'))[0] || info.devices[0]
                this.setState({inputDeviceId:device.deviceId, inputDevices:info.devices})
            } 
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
    async initDone(){
        console.log('INIT DONE')
        this.setState({init:true})
        //this.runFFT(2000)
        return
                
    }
    async runFFT(speed){
        for (var i = 0; i < fftSize.length; i++) {
            this.setState({freqOptions:{fftSize:fftSize[i]}})
            await this.sleep(speed)
        }
        this.setState({freqOptions:{fftSize:fftSize[0]}})
    }
    stop(){
        //Global.engine.enableAnalyser('input', false)
    }
    async sleep(ms){
        return new Promise((resolve,rekect)=>{
            setTimeout(()=>resolve(), ms)
        })
    }
    onDeviceChange(inputDeviceId){
        console.log('change device', inputDeviceId)
        Global.engine.initInputSource(inputDeviceId).then((inputSource)=>{
            localStorage.setItem('lastInputDevice', inputDeviceId)
            this.setState({inputDeviceId})
            this.initDone()
        }).catch((err)=>this.handleError(err))
    }
    handleError(err){
        console.error(err)
    }
    
    render() {
        const {inputDeviceId, inputDevices, volume, init, freqOptions, volumeOptions, oscilloscopeOptions} = this.state;
        

        return (
            <div id={'container-test'}>
                <div className={'test-top'}>
                    <FrequencyVisualizer
                        id={'input'} 
                        color={'rgb(255, 31, 31, 0.4)'} 
                        //colorBackground={'rgba(15, 31, 31)'} 
                        ready={init}
                        options={freqOptions}
                    />
                    <VolumeVisualizer
                        id={'input'}
                        numChannels={2}
                        color={'rgb(255, 31, 31, 0.4)'} 
                        ready={init}
                        options={volumeOptions}
                    />
                    <OscilloscopeVisualizer
                        id={'input'}
                        color={'rgb(255, 31, 31, 0.4)'} 
                        ready={init}
                        options={oscilloscopeOptions}
                    />
                </div>
                <div className={'test-bottom'}>
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

export default Test;
