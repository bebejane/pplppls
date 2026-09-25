import Global from '../../../Global'
import React, { Component } from "react";
import VolumeVisualizer from "../../visualizers/VolumeVisualizer";
import Slider from 'react-input-slider'
import ReactTooltip from 'react-tooltip'
import "./MasterFader.css";

class MasterFader extends Component {
    constructor(props) {
        super(props);
        this.state = {
            id:props.id,
            init:props.init,
            volume:props.volume || 0,
            select:0,
            active:false,
            noteOn:false,
            velocity:0
        };
        this.ref = React.createRef()
    }
    componentDidMount() {
        Global.engine.on("noteon", (note) => {
            this.setState({noteOn:true, velocity:note.rawVelocity})
        });
        Global.engine.on("noteoff", (note) => {
            this.setState({noteOn:false})
        });
    }
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    onChange(vol){
        
        //const fader = this.ref.current
        this.props.onVolume(vol/100)
    }
    onTouchMove(e){
        this.onMove(e.targetTouches[0])
        e.preventDefault()
    }
    onClick(e){
        const fader = this.ref.current
        const select = (1.0- (Math.abs(e.pageY-fader.offsetTop)/fader.clientHeight))*100
        this.setState({select, active:!this.state.active})
    }
    render() {
        const { init, volume, id, noteOn, velocity} = this.state;

        return (
            <div id={"master-fader"}>
                 <Slider
                    id={id}
                    key={id} 
                    axis={'x'}
                    max={100}
                    min={0}
                    x={volume*100}
                    xstep={1}
                    onChange={(axis)=>this.onChange(axis.x)}
                    styles={sliderStyle}
                />
                <div className="input-meter" data-tip data-for={'tt-output'}>
                    <VolumeVisualizer id={'master'} color={'#ffffff'} ready={init}/>
                </div>
                {/*
                <div className="input-meter" data-tip data-for={'tt-input'}>
                    <VolumeVisualizer id={'input'} color={'#ffffff'} ready={init}/>
                </div>
                */}
                <div className="input-meter" data-tip data-for={'tt-midi'}>
                    <div id='midi-on' style={{opacity:noteOn ? 1.0 : 0.0, minHeight:((velocity/127)*100)+'%'}}></div>
                </div>
                <ReactTooltip id='tt-output' type='dark' place='top' effect='float' delayShow={800}>Output volume</ReactTooltip>
                <ReactTooltip id='tt-input' type='dark' place='top' effect='float' delayShow={800}>Input volume</ReactTooltip>
                <ReactTooltip id='tt-midi' type='dark' place='top' effect='float' delayShow={800}>Midi In</ReactTooltip>
                
            </div>
        );
    }
}

const trackHeight = 20;
const sliderStyle = {
    track: {
        height:'100%',
        width:'100px',
        maxHeight:trackHeight,
        minHeight:trackHeight,
        backgroundColor: '#4f0b4a !important',
        borderRadius:0,
        marginRight:10
    },
    active: {
      backgroundColor: '#7d3866',
      borderRadius:0
    },
    thumb: {
      width: 20,
      height: trackHeight+2,
      borderRadius:0,
      backgroundColor:'rgb(106, 30, 98)'
    },
    disabled: {
      opacity: 0.5
    }
}

export default MasterFader;
