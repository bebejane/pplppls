import Global from '../../../Global'
import React, { Component } from "react";
import Switch from 'react-switch';
import Slider from 'react-input-slider'
import AudioEngine from "../../../services/AudioEngine";
import FrequencyVisualizer from "../../visualizers/FrequencyVisualizer";
import Select from '../../util/Select';
import isElectron from 'is-electron';
import "./index.css";

class Smokey extends Component {
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
            //enableElapsed:true,
            enableEffects:true,
            //enableLoops:true,
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
        this.lineWidth = 5;
        this.lineLength = 2;
        this.options = {
            fftSize:2048,
            interval:5,
            lowcut:100,
            hicut:1000,
        }
        this.recordings = []
        this.canvasRef = React.createRef();
        this.containerRef = React.createRef();
        this.points = []
    }
    componentDidMount() {
        this.canvas = document.getElementById('smokey-canvas')
        this.ctx = this.canvas.getContext('2d')
        this.setState({height:this.containerRef.current.clientHeight, width:this.containerRef.current.clientWidth}, ()=>{
            this.init();    
        })
        
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
            Global.engine.add('recorder', null, null)
            this.record(true)
        }).catch((err)=>{
            this.handleError(err)
        })
        window.addEventListener('keydown', (e)=>{
            //console.log(e)
        })
    }
    onDeviceChange(inputDeviceId){
        console.log('change device', inputDeviceId)
        Global.engine.initInputSource(inputDeviceId).then((inputSource)=>{
            localStorage.setItem('lastInputDevice', inputDeviceId)
            this.setState({inputDeviceId})
        }).catch((err)=>this.handleError(err))
    }
    record(){
        this.points = []
        this.stopped = false
        
        Global.engine.sample('recorder', true).then((recording)=>{
            this.recordings.push({recording, reverse:this.state.reverse, points:this.points.slice(0)})
            const idx = this.recordings.length-1;
            Global.engine.once('loadrecorder', async ()=>{
                await this.play(idx, this.state.reverse)
                this.record(this.state.reverse)
            })
            
        })
        setTimeout(()=>this.start(), 500)
    }
    async start(){
        console.log('START SAMPLING')
        
        const {width, height} = this.state;
        const maxes = []
        const max = 35
        const startPoint = {x: parseInt(width/2), y:parseInt(height/2), t:0}
        const points = []
        points.push(startPoint)

        this.ctx.strokeStyle = 'rgb(117, 32, 107)'
        this.ctx.clearRect(0,0,width,height)
        this.ctx.beginPath()
        this.ctx.moveTo(startPoint.x, startPoint.y)

        let startTime = Date.now()
        let point = {...startPoint}
        let stopped = false;
        
        this.analyser = Global.engine.analyse('input', 'frequency').addEventListener('frequency', this.options, (data, opt)=>{

            if(stopped) return 
            maxes.push(data.reduce((iMax, x, i, arr) => x > arr[iMax] ? i : iMax, 0))
            if(maxes.length <= 3) return
            const freqs = {}
            let band = -1
            for (var i = 0; i < maxes.length; i++) {
                if(!freqs[maxes[i]]) 
                    freqs[maxes[i]] = 0;
                freqs[maxes[i]]++
            }
            Object.keys(freqs).forEach((k)=>{
                if(freqs[k] > band){
                    band = k
                }
            })
            //lineWidth = data[band]/5
            const deg = parseInt((band/max)*360)
            let newPoint = findNewPoint(point.x, point.y, deg, this.lineLength)
            if(newPoint.x > width || newPoint.y > height || newPoint.x < 0 || newPoint.y < 0){
                stopped = true;
                this.points = points;
                Global.engine.sample('recorder', false)
                return 
            } else if(deg !== 0){
                point.x = newPoint.x
                point.y = newPoint.y
                points.push({x:newPoint.x, y:newPoint.y, t:Date.now()-startTime})
                this.ctx.lineWidth = this.lineWidth;
                this.ctx.lineTo(point.x, point.y)
                this.ctx.stroke()
                

            }   
            maxes.length = 0
        })

        function findNewPoint(x, y, angle, distance) {
            var result = {};
            result.x = Math.round(Math.cos(angle * Math.PI / 180) * distance + x);
            result.y = Math.round(Math.sin(angle * Math.PI / 180) * distance + y);
            return result;
        }
             
    }
    async play(idx, reverse){
        
        console.log('PLAY', idx)
        const {width, height} = this.state;
        const recording = this.recordings[idx] 
        
        this.ctx.clearRect(0,0,width,height)
        console.log('clear', width,height)

        await this.sleep(1000)
        
        if(reverse){
            Global.engine.reverse('recorder', true)
            recording.points.reverse()
        }
        this.ctx.beginPath()
        this.ctx.moveTo(recording.points[0].x, recording.points[0].y)
        
        this.ctx.strokeStyle = 'rgb(117, 32, 207)'
        this.ctx.lineWidth = this.lineWidth;
        Global.engine.play('recorder')

        for (var i = 0; i < recording.points.length; i++) {
            let p = recording.points[i]
            let next = i+1 < recording.points.length ? recording.points[i+1] : null

            this.ctx.lineTo(p.x, p.y)
            this.ctx.stroke()
            
            if(next !==null)
                await this.sleep(!reverse ? next.t-p.t : p.t-next.t)
            else
                break
        }    
        console.log('DONE PLAYING')
    }
    stop(){
        Global.engine.sample('smokey',false)
    }
    async sleep(ms){
        return new Promise((resolve,rekect)=>{
            setTimeout(()=>resolve(), ms)
        })
    }
    
    handleError(err){
        console.error(err)
    }
    download(idx){
        this.setState({recordingId:idx})
        if(idx < 0) return
         
        console.log(idx)
        const item = this.recordings[idx];
        console.log(item)
        const buffer = item.recording.buffer;
        buffer.forEach((channel)=>{
            channel.reverse()
        })
        Global.engine.encodeAudio(buffer, 'wav', {numChannels:1, sampleRate:44100}).then((data)=>{
            this.forceDownload(data, item.recording.filename)
        }).catch((err)=>{
            console.error(err)
        })  
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
    render() {
        const {init, inputDeviceId, inputDevices, width, height, playing, recordingId, reverse} = this.state;
        const recordings = this.recordings.map((d)=>{return {value:d.recording.id, label:d.recording.name}}).concat([{value:-1, label:'Recordings'}])

        return (
            <div id={'container-smokey'} ref={this.containerRef}>
                <canvas id={'smokey-canvas'} ref={this.canvasRef} width={width} height={height}/>  
                <div id={'smokey-devices'}>
                    <Switch height={18} width={40} onChange={(val, e)=>this.setState({reverse: val})} checked={reverse ? true : false}/>
                    <Select 
                        value={recordingId} 
                        options={recordings}
                        center={true}
                        direction={'up'}
                        onChange={(val)=>this.download(val)} 
                    />
                    <Select 
                        value={inputDeviceId} 
                        options={inputDevices.map((d)=>{return {value:d.deviceId, label:d.label}})}
                        center={true}
                        direction={'up'}
                        onChange={(val)=>this.onDeviceChange(val)} 
                    />
                </div>
                {
                <div id={'smokey-freq'}>
                    <FrequencyVisualizer id={'input'} color={'rgb(255, 31, 31)'} ready={init} options={this.options}/>
                </div>
                }
            </div>
        )
    }
}

export default Smokey;