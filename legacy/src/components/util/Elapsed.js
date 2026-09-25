import Global from '../../Global'
import React, { Component } from 'react';
import './Elapsed.css';
import moment from 'moment';

class Elapsed extends Component {
    constructor(props){
        super(props)
        this.state = {
            id:props.id,
            fontSize:props.fontSize,
            height:0,
            width:0,
            duration:props.duration,
            rate:props.rate,
            elapsed:0
        }
        this.ref = React.createRef()
        this.refCanvas = React.createRef()
    }
    componentDidMount(){
        
        if((this.ref && this.ref.current) && (this.state.height !== this.ref.current.clientHeight || this.state.width !== this.ref.current.width))
            this.setState({height:this.ref.current.clientHeight, width:this.ref.current.clientWidth})

        Global.engine.on(this.state.id+'elapsed', (elapsed)=>this.updateElapsed(elapsed))

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
    
    drawElapsed(text){
        const width = parseInt(this.ref.current.clientWidth)
        const height = parseInt(this.ref.current.clientHeight)
        const ctx = this.refCanvas.current.getContext('2d')
        ctx.clearRect(0,0,width,height)
        ctx.font = '14px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, 0,14);
    }
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    formatDuration(sec, rate){

        const time = moment.utc(moment.duration(rate ? sec/rate : sec , 'seconds').asMilliseconds())
        return time.format((time.hours()>0 ? 'HH:' : '') + 'mm:ss:SSS')
    }
    render(){
        const {id, width, fontSize} = this.state
        
        return(
            <div className={'channel-elapsed'} ref={this.ref} style={{height:fontSize+'px'}}>
                <canvas id={id+'elapsed'}  ref={this.refCanvas} width={width}  height={fontSize}/>
            </div>
        )
    }
}
export default Elapsed
