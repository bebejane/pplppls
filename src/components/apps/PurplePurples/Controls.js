import Global from '../../../Global'
import React, { Component } from "react";
import "./Controls.css";
import {
    MdPlayArrow,
    MdStop,
    MdRepeat, 
    MdFiberManualRecord,
    MdFullscreen,
    MdSettingsBackupRestore,
    MdQueueMusic,
    MdVolumeUp,
} from "react-icons/md";
import { IoMdLock,IoMdHelp } from "react-icons/io";
import { FiPlus } from "react-icons/fi";
import { GoSettings} from "react-icons/go";
import { RiDownload2Line, RiUpload2Line} from "react-icons/ri";
import Select from '../../util/Select';
import MasterFader from "./MasterFader";
import moment from 'moment'
import ReactTooltip from 'react-tooltip'

class Controls extends Component {
    constructor(props) {
        super(props);
        this.state = {
            init:props.init,
            model: props.model,
            show: props.show,
            models: props.models,
            recordings: props.recordings,
            recording: props.recording,
            showRecording: props.showRecording,
            volume: props.volume,
            locked: props.locked,
            muted: props.muted,
            playing: props.playing,
            rate: props.rate,
            paused: props.paused,
            looping: props.loooping,
            inputDevices: props.inputDevices,
            outputDevices: props.outputDevices,
            controls:props.controls,
            fullscreen:props.fullscreen,
            inputDeviceId: props.inputDeviceId,
            outputDeviceId: props.outputDeviceId,
            midiDeviceId: props.midiDeviceId,
            midiDevices: props.midiDevices,
            midiSupported: props.midiSupported,
            showRecordings:props.showRecordings,
            showHelp:props.showHelp,
            playId: undefined,
            duration:props.duration,
            recordingProgress:{},
            mastermeter:0,
            velocity:0,
            
        };
        this.ref = React.createRef();
        this.refDevices = React.createRef();
        this.refMidiDevices = React.createRef();
        this.sound = null;
        
    }
    componentDidMount(){
        if(!Global.engine) return
        Global.engine.on("recordingprogress", (id, prog) => {
            if(!id)
                this.setState({recordingProgress:prog.elapsed})
        });
    }
    
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    onPlay() {
        if(!this.state.recordings.length) return

        const rec = this.state.recordings[0]
        
        Global.engine.stop();

        if(this.sound)
            this.sound.destroy()
        this.sound = Global.engine.playSound(rec.url,{enableElapsed:true, volume:1.0})
        this.sound.on('ready', ()=>{
            this.sound.volume(1.0)
            this.sound.play()
            this.setState({playId:rec.id})
        })
        this.sound.on('elapsed', (elapsed)=>{
            this.setState({elapsed:elapsed, playId:rec.id})
        })
        this.sound.on('ended', ()=>{
            this.setState({ playId: undefined, elapsed:0 })
        })
        this.sound.load()
        this.setState({ playId: rec.id });

    }
    onStop() {
        if (this.sound)
            this.sound.stop();
        this.setState({ playId: undefined });
    }
    /*
    onPlay(){
        this.props.onPlay()
    }
    onPause(on){
        this.props.onPause(on)
    }
    onStop(){
        this.props.onStop()
    }
    */
    onRecord(on){
        this.props.onRecord(on)
    }
    onLoop(on){
        this.props.onLoop(on)
    }
    onFullscreen(on){
        this.props.onFullscreen(on)
    }
    onMute(on){
        this.props.onMute(on)
    }
    onLocked(on){
        this.props.onLocked(on)
    }
    onLoadModel(model){
        this.props.onLoadModel(model)
    }
    onVolume(vol){
        this.props.onVolume(vol)
    }
    onDeviceChange(deviceId){
        this.props.onDeviceChange(deviceId)
    }
    onOutputDeviceChange(deviceId){
        this.props.onOutputDeviceChange(deviceId)
    }
    onMidiDeviceChange(midiDeviceId){
        this.props.onMidiDeviceChange(midiDeviceId)
    }
    onRequestInput(){
        this.props.onRequestInput()
    }
    onDownload(id, format){
        this.props.onDownload(id, format)
    }
    onDeleteRecording(id) {
        this.props.onDeleteRecording(id);
    }
    onControls(on) {
        this.props.onControls(on);
    }
    formatDuration(sec, rate){
        const time = moment.utc(moment.duration(rate ? sec/rate : sec , "seconds").asMilliseconds())
        return time.format((time.hours()>0 ? 'HH:' : '') + 'mm:ss:SSS')
    }
    render() {
        const {
            init,
            show,
            recordings,
            models,
            volume,
            model,
            playId,
            looping,
            playing,
            muted,
            locked,
            inputDevices,
            inputDeviceId,
            midiDeviceId,
            midiDevices,
            noteOn,
            recording,
            fullscreen,
            controls,
            elapsed,
            recordingProgress,
            showRecordings,
            showHelp,
            midiSupported
            
        } = this.state;

        if (!show) return null;
        console.log(playId)
        return (
            <div id="controls-container">
                <div id={"controls-buttons"}>     
                    <MdFiberManualRecord  onClick={() => this.onRecord(!recording)} className={recordingProgress.recording ?  'recording' : recordingProgress.processing ? 'processing' : undefined}/>
                    {playId !== undefined ? <MdStop  onClick={() => this.onStop()}/> : <MdPlayArrow className={recordings.length ? 'control-toggle' : ''} onClick={() => this.onPlay()}/>}
                    <div id={"controls-recording-progress"}>{this.formatDuration(elapsed || recordingProgress.elapsed)}</div>
                    <div id={"controls-recordings"} data-tip data-for={'tt-recordings'}>
                        <MdQueueMusic data-tip data-for={'tt-recordings'} onClick={()=>this.props.onToggleRecordings(!showRecordings)}/>
                        {recordings.length ? <div id="recordings-badge">{recordings.length}</div> : null}
                    </div>

                    <MdRepeat data-tip data-for={'tt-loop'} onClick={() => this.onLoop(!looping)} className={looping ? 'control-toggle' : ''}/>
                    <IoMdLock data-tip data-for={'tt-lock'} onClick={() => this.onLocked(!locked)} className={locked ? 'control-toggle' : ''}/>
                    <MdFullscreen data-tip data-for={'tt-fs'} onClick={() => this.onFullscreen(!fullscreen)} className={fullscreen ? 'control-toggle' : ''}/>
                    <GoSettings  data-tip data-for={'tt-controls'} onClick={() => this.onControls(!controls)} className={controls ? 'control-toggle' : ''}/>
                    <MdSettingsBackupRestore data-tip data-for={'tt-reset'} onClick={() => Global.engine.master.reset()}/>
                    <RiDownload2Line data-tip data-for={'tt-save'} onClick={() => this.props.onSave()}/>
                    <RiUpload2Line data-tip data-for={'tt-load'} onClick={() => this.props.onLoad()}/>
                    <FiPlus data-tip data-for={'tt-new'} onClick={()=>this.props.onToggleNewSet()}/>
                    
                    <IoMdHelp data-tip data-for={'tt-help'} onClick={()=>this.props.onToggleHelp(!showHelp)}/>
                    

                    <ReactTooltip id='tt-playing' type='dark' place='top' effect='float' delayShow={800}>Play/Stop</ReactTooltip>
                    <ReactTooltip id='tt-record' type='dark' place='top' effect='float' delayShow={800}>Record</ReactTooltip>
                    <ReactTooltip id='tt-record-time' type='dark' place='top' effect='float' delayShow={800}>Recording time</ReactTooltip>
                    <ReactTooltip id='tt-loop' type='dark' place='top' effect='float' delayShow={800}>Loop</ReactTooltip>
                    <ReactTooltip id='tt-lock' type='dark' place='top' effect='float'  delayShow={800}>Lock</ReactTooltip>
                    <ReactTooltip id='tt-fs' type='dark' place='top' effect='float' delayShow={800}>Fullscreeen</ReactTooltip>
                    <ReactTooltip id='tt-controls' type='dark' place='top' effect='float' delayShow={800}>Toggle Controls</ReactTooltip>
                    <ReactTooltip id='tt-reset' type='dark' place='top' effect='float' delayShow={800}>Reset all</ReactTooltip>
                    <ReactTooltip id='tt-save' type='dark' place='top' effect='float' delayShow={800}>Save</ReactTooltip>
                    <ReactTooltip id='tt-load' type='dark' place='top' effect='float' delayShow={800}>Load</ReactTooltip>
                    <ReactTooltip id='tt-new' type='dark' place='top' effect='float' delayShow={800}>New</ReactTooltip>
                    <ReactTooltip id='tt-recordings' type='dark' place='top' effect='float' delayShow={800}>Recordings</ReactTooltip>
                    <ReactTooltip id='tt-mute' type='dark' place='top' effect='float' delayShow={800}>Mute</ReactTooltip>
                    <ReactTooltip id='tt-help' type='dark' place='top' effect='float' delayShow={800}>Help</ReactTooltip>
                    
                </div>
                <div id={"controls-volume"}>
                    <MdVolumeUp id='controls-volume-mute' data-tip data-for={'tt-mute'} onClick={() =>this.onMute(!muted)} className={muted ? 'control-toggle' : ''}/>
                    <MasterFader onVolume={(vol) => this.onVolume(vol)} volume={volume} init={init}/>
                </div>
                <div id={"controls-settings"}>
                    
                    <Select
                        value={model}
                        options={ models.map((m)=>{ return {label:m.name, value:m.name} }) } 
                        onChange={(val) => this.onLoadModel(val)}
                    />
                    
                    {midiDevices.length > 0 ?
                        <Select
                            value={midiDeviceId}
                            options={ midiDevices.map((d)=>{ return {label:d.name, value:d.deviceId} }) } 
                            onChange={(id) => this.onMidiDeviceChange(id)}
                        />
                        
                    :   
                        <Select
                                value={0}
                                options={[{label:midiSupported ? 'MIDI not connected' : 'MIDI not supported', value:0}]} 
                        />
                    }
                    {inputDevices.length > 0 ?
                        <Select
                            value={inputDeviceId}
                            options={ inputDevices.map((d)=>{ return {label:d.label, value:d.deviceId} }) } 
                            onChange={(id) => this.onDeviceChange(id)}
                        />
                    :
                        <Select
                            value={0}
                            options={[{label:'Choose Input', value:0}]} 
                            onClick={(id) => this.onRequestInput()}
                        />
                    }
                    
                </div>
                
            </div>
        );
    }
}

export default Controls;
