import Global from '../../../Global'
import React, { Component } from "react";
import "./ColumnTools.css";
import {
    MdPlayArrow,
    MdStop,
    MdRepeat,
    MdVolumeUp,
    MdFiberManualRecord,
    MdSettingsBackupRestore,
} from "react-icons/md";
import { IoMdLock } from "react-icons/io";
import { AiOutlineLink, AiFillPhone } from "react-icons/ai";
import { RiArrowGoBackLine } from "react-icons/ri";
import { GiMagicLamp} from "react-icons/gi";
import { TiWaves } from "react-icons/ti";


class ColumnTools extends Component {
    constructor(props) {
        super(props);
        this.state = {
            id: props.id,
            sampling: props.sampling,
            isSampling: props.isSampling,
            
            playing: props.playing,
            recording: props.recording,
            muted: props.muted,
            loop: props.loop,
            locked: props.locked,
            fullscreen: props.fullscreen,
            midiMapMode: props.midiMapMode,
            effectsEnabled: props.effectsEnabled,
            midiNote: props.midiNote,
            reversed: props.reversed,
            solo: props.solo,
            samplingProgress: {},
        };
    }

    componentDidMount() {
        Global.engine.on('sampling', (id, on)=>{
            if(id !== this.state.id) return;
            //this.setState({sampling:on})
        })
        Global.engine.on('samplingprogress', (id, prog)=>{
            if(id !== this.state.id) return;
            this.setState({samplingProgress:prog})
        })
        Global.engine.on("encodingprogress", (percentage) => {
            console.log('encoding progress')
        //    const notification = {...this.state.notification, description:percentage.toFixed(0) + '%'}
          //  this.setState({notification});
        });
    }
    updatesamplingProgress(id, prog) {
        if (id !== this.state.id)
            return
        this.setState({ samplingProgress: { ...prog } })
    }
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    onReset(){
        Global.engine.reset(this.state.id)
        Global.engine.lock(this.state.id, true)

    }
    onClick(e) {

    }
    onSampleRecord(on) {
        if(this.state.isSampling && !this.state.sampling) return console.error('smaka')

        if (this.state.recording)
            return
        this.props.onSampleRecord(on)
    }
    onLocked(on) {
        this.props.onLocked(on)
    }
    onFullscreen(on) {
        console.log(on)
        this.props.onFullscreen(on)

    }
    onMidiMapMode(on) {
        const note = this.state.midiNote
        const unmap = (note && on === true);
        if(unmap)
            return Global.engine.unmapMidiNote(this.state.id, this.state.midiNote)

        Global.engine.midiMapMode(this.state.id, on)
    }
    render() {
        const {
            fullscreen, 
            sampling,
            isSampling, 
            playing, 
            muted, 
            loop, 
            locked, 
            midiMapMode, 
            midiNote, 
            reversed, 
            solo, 
            samplingProgress, 
            effectsEnabled 
        } = this.state;

        return (
            <div
                className={"sound-canvas-point-tools"}
                onClick={(e) => {e.stopPropagation();}}
                onMouseDown={(e) => {e.stopPropagation();}}
                onMouseMove={(e) => {e.stopPropagation();}}
            >
                {playing ? <MdStop className={"sound-canvas-point-tool-toggle"} onClick={() => this.props.onStop()} /> : <MdPlayArrow onClick={() => this.props.onPlay()} />}
                {!sampling ? 
                    <MdFiberManualRecord onClick={() => this.onSampleRecord(true)} className={isSampling ? "sound-canvas-point-tool-toggle" : undefined}/>
                : 
                    <MdFiberManualRecord
                        className={
                            (samplingProgress.processing && !samplingProgress.recording) ? 
                                'sound-canvas-point-tool-sampling-processing' 
                            : 
                                "sound-canvas-point-sampling"
                        }
                        onClick={() => this.onSampleRecord(false)}
                    />
                }
                <MdVolumeUp className={!muted ? "sound-canvas-point-tool-toggle" : undefined} onClick={() => this.props.onMute(!muted)} />
                <MdRepeat onClick={() => this.props.onLoop(!loop)} className={loop ? "sound-canvas-point-tool-toggle" : undefined}/>
                <RiArrowGoBackLine className={reversed ? "sound-canvas-point-tool-toggle" : undefined} onClick={() => this.props.onReverse(!reversed)}/>
                <GiMagicLamp className={effectsEnabled ? "sound-canvas-point-tool-toggle" : undefined} onClick={() => this.props.onEffectsEnabled(!effectsEnabled)} />
                <AiOutlineLink className= {midiNote ? 'sound-canvas-point-tool-mapped' : (midiMapMode ? "sound-canvas-point-tool-mapping" : undefined)} onClick={() => this.onMidiMapMode(!midiMapMode)}/>
                <MdSettingsBackupRestore onClick={() => this.onReset()}/>
                <AiFillPhone className={solo ? "sound-canvas-point-tool-toggle" : undefined} onClick={() => this.props.onSolo(!solo)} />
                <TiWaves className={fullscreen ? "sound-canvas-point-tool-toggle" : undefined} onClick={() => this.onFullscreen(!fullscreen)} />
                <IoMdLock className={locked ? "sound-canvas-point-tool-toggle" : undefined} onClick={() => this.props.onLocked(!locked)}/>
                {/*<IoMdDownload onClick={() => { this.props.onDownload()}} />*/}
            </div>

        );
    }
}

export default ColumnTools;