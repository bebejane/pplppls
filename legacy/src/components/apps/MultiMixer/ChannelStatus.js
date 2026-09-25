import Global from '../../../Global'
import React, { Component } from "react";
import "./ChannelStatus.css";
import {AiOutlineLoading} from 'react-icons/ai'
import moment from "moment";

class ChannelStatus extends Component {
    constructor(props){
        super(props)
        this.state = {
            id:props.id,
            height:0,
            width:0,
            name:props.name,
            duration:props.duration,
            rate:props.rate,
            start:props.start,
            end:props.end,
            elapsed:0,
            loopTrigger:false
        }
        this.ref = React.createRef()
        this.refCanvas = React.createRef()
        this.loopTrigger = false;
    }
    componentDidMount(){
        const id = this.state.id+'elapsed';
        const loopEndId = this.state.id+'loopend';

        if((this.ref && this.ref.current) && (this.state.height !== this.ref.current.clientHeight || this.state.width !== this.ref.current.width))
            this.setState({height:this.ref.current.clientHeight, width:this.ref.current.clientWidth})

        Global.engine.on(id, (elapsed)=>this.updateElapsed(elapsed))
        Global.engine.on(loopEndId, ()=>{
            this.loopTrigger = true;
            setTimeout(()=>this.loopTrigger = false, 100)
        })


    }
    updateElapsed(elapsed){
        if(!this.ref || !this.ref.current || (!this.refCanvas || !this.refCanvas.current))
            return

        if(this.state.height !== this.ref.current.clientHeight || this.state.width !== this.ref.current.width)
            this.setState({height:this.ref.current.clientHeight, width:this.ref.current.clientWidth})

        const rate = this.state.rate
        const duration = this.state.duration
        const text = this.formatDuration(elapsed) +  ' - ' + this.formatDuration(duration, rate)
        this.drawElapsed(text)
    }
    drawLoopTrigger(on){

        const width = parseInt(this.ref.current.clientWidth)
        const height = parseInt(this.ref.current.clientHeight)
        const ctx = this.refCanvas.current.getContext('2d')
        ctx.clearRect(0,0,width,height)
        if(on){
            ctx.fillStyle = "#000000";
            ctx.fillRect(0,0, width, height);
        }
    }
    drawElapsed(text){
        const width = parseInt(this.ref.current.clientWidth)
        const height = parseInt(this.ref.current.clientHeight)
        const ctx = this.refCanvas.current.getContext('2d')
        ctx.clearRect(0,0,width,height)

        ctx.font = "11px Arial";
        ctx.fillStyle = this.loopTrigger ? '#ffffff' : "#000000";
        ctx.textAlign = 'center'
        ctx.fillText(text, (width/2)-10,11);
    }
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    formatDuration(sec, rate){

        const time = moment.utc(moment.duration(rate ? sec/rate : sec , "seconds").asMilliseconds())
        return time.format((time.hours()>0 ? 'HH:' : '') + 'mm:ss:SSS')
    }
    render(){
        const {name, id, rate, loading, duration, loopTrigger, start, width} = this.state
        return(
            <div ref={this.ref}  className={"mixer-channel-info"} style={{backgroundColor:loopTrigger ? '#a895a3' : 'transparent'}}>
                <div className={"mixer-channel-info-row"}>
                    {name}
                </div>
                <div className={"mixer-channel-info-row"} >
                    <canvas id={id+'elapsed'} ref={this.refCanvas} width={width} height={11}/>
                </div>
                <div className={"mixer-channel-info-row"}>
                    {this.formatDuration(start)} > {this.formatDuration(duration, rate)}
                </div>
                {loading && <div className={"mixer-channel-loading"}><div><AiOutlineLoading/></div></div>}
                {this.props.children}
            </div>
        )
    }
}
export default ChannelStatus
