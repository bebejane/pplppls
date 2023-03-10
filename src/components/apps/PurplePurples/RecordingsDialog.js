import Global from '../../../Global'
import React, { Component } from "react";
import "./RecordingsDialog.css";
import {MdPlayArrow,MdStop} from "react-icons/md";
import { TiTimes } from "react-icons/ti";
import moment from 'moment'

class RecordingsDialog extends Component {
    constructor(props) {
        super(props);
        this.state = {
            recordings:props.recordings,
            show:props.show,
            display:false,
            playing:false,
            elapsed:{},
            playId:null,
        };
    }
    componentDidMount() {
    }
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    onDisplay(on){

        const select = this.selectRef.current
        if(!select) return
            
        const options = this.optionsRef.current
        const y = select.offsetTop - options.clientHeight
        const x = select.offsetLeft
        this.setState({display:on, x, y})
    }
    onPlay(id, e) {
        console.log('play recording', id)
        const rec = this.state.recordings.filter((r) => r.id === id)[0];
        
        Global.engine.stop();

        if(this.sound)
            this.sound.destroy()
        this.sound = Global.engine.playSound(rec.url,{enableElapsed:true, volume:1.0})
        this.sound.on('ready', ()=>{
            this.sound.volume(1.0)
            this.sound.play()
            this.setState({playing:id})
        })
        this.sound.on('elapsed', (elapsed)=>{
            const el = {}
            el[this.state.playing] = elapsed
            this.setState({elapsed:el})
        })
        this.sound.on('ended', ()=>{
            console.log('ended');
            this.setState({ playId: null })
        })
        this.sound.load()
        this.setState({ playId: id });
        e.stopPropagation();

    }
    onStop(id, e) {
        if (this.sound)
            this.sound.stop();
        this.setState({ playId: null });
        e.stopPropagation();
    }
    onDelete(id, e) {
        this.onStop(id, e);
        this.props.onDeleteRecording(id);
        e.stopPropagation();
    }
    onDownload(id, format, e) {
        this.props.onDownload(id, format);
        e.stopPropagation();
    }
    formatTime(ms){
        const tempTime = moment.duration(ms);
        return tempTime.hours() + ':' + tempTime.minutes() + ':' + tempTime.seconds()
    }
    formatDuration(sec, rate){

        const time = moment.utc(moment.duration(rate ? sec/rate : sec , "seconds").asMilliseconds())
        return time.format((time.hours()>0 ? 'HH:' : '') + 'mm:ss')
    }
    onClose(e){
        this.onStop(this.state.playId, e)
        this.props.onClose()
    }
    render() {
        const { recordings, playId, elapsed, show, x, y, selected } = this.state;
        if(!show) return null;
        
        return (

            <div id="recordings-dialog" 
                onMouseMove={(e)=>e.stopPropagation()} 
                onMouseDown={(e)=>e.stopPropagation()} 
                onClick={(e)=>e.stopPropagation()} 
            >
                <div id="recordings-dialog-box">
                    <div id={'recordings-header'}>Recordings</div>
                    {recordings.length > 0 && recordings.map((r)=>
                        <div className={'recording-row'}>
                            <div className={'recording-tools'}>
                                {playId !== r.id ?
                                    <MdPlayArrow  onClick={(e)=>this.onPlay(r.id, e)}/>
                                    :
                                    <MdStop  onClick={(e)=>this.onStop(r.id, e)}/>
                                }
                            </div>
                            <div className={'recording-label'}>
                                {r.filename.replace('.wav', '')}&nbsp;-&nbsp;<div className={'recording-duration'}>{this.formatDuration(elapsed[r.id] || r.duration)}</div>
                            </div>
                            <div className={'recording-tools'}>
                                <div className={'download-icon'} onClick={(e)=>{this.onDownload(r.id, 'wav', e)}}>WAV</div>
                                <div className={'download-icon'} onClick={(e)=>{this.onDownload(r.id, 'mp3', e)}}>MP3</div>
                                <div className={'download-icon'} onClick={(e)=>{this.onDelete(r.id, e)}}>DELETE</div>
                            </div>
                        </div>
                    )}
                    {(recordings.length === 0) && <div key={'gone'} className={'recordings-empty'}>Nix hier...</div>}
                    <div key={'close'} id={"recordings-dialog-close"} onClick={(e)=>this.onClose(e)}>X</div>
                </div>
            </div>
        );
    }
}
export default RecordingsDialog;
