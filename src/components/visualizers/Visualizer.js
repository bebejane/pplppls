import Global from '../../Global'
import React, { Component } from 'react';
import './Visualizer.css';

class Visualizer extends Component {
    constructor(props) {
        super(props);
        this._state = props;
        this.state = {
            id:props.id,
            type:props.type,
            color:props.color  || 'rgba(0,0,0,1.0)',
            colorBackground:props.colorBackground,
            options:props.options || {},
            ready:props.ready,
            clear:props.clear !== undefined ? props.clear : true,
            width:0,
            height:0
        };
        this.options = props.options;
        this.width = 0
        this.height = 0
        this.canvas = null;
        this.ctx = null
        this.analyser = null;
        this.refContainer = React.createRef()
        this.refCanvas = React.createRef()
        this._update = this._update.bind(this)
        this.updateSize = this.updateSize.bind(this)
        this.clear = this.clear.bind(this)
    }
    init(){
        this.analyser = Global.engine.analyse(this.state.id, this.type, this.options)
        if(this.analyser)
            this.analyser.addEventListener(this.type, this.options, this._update)
    }

    componentDidMount() {
        this.canvas = document.getElementById(this.state.id+this.type)
        this.ctx = this.canvas.getContext('2d')
        window.addEventListener('resize', this.updateSize)
        this.updateSize()
    }
    componentWillUnmount(){
        window.removeEventListener('resize', this.updateSize)
        if(this.analyser)
            this.analyser.removeEventListener(this.type, this._update)
        this.clear()
    }
    componentDidUpdate(){
        if(!this.analyser && this.state.ready)
            this.init()
            
        if(JSON.stringify(this.state.options) !== JSON.stringify(this.options))
            this.setOptions(this.state.options)
    }
    
    setOptions(opt){
        if(!this.analyser) return
        this.options = {...opt};
        this.analyser.setOptions(this.type, opt)
        console.log('set option')
    }
    updateSize(){
        if(!this.refContainer.current) return;
        clearTimeout(this.resizeTimeout)
        this.resizeTimeout = setTimeout(()=>{
            if(!this.refContainer.current) return console.error('container not ready');
            this.width = this.refContainer.current.clientWidth
            this.height = this.refContainer.current.clientHeight
            this.setState({width:this.width, height:this.height})    
        },200)
    }
    static getDerivedStateFromProps(nextProps) {
        return nextProps;
    }
    update(){
        console.log('.')
    }
    _update(data, opt){
        if(this.state.clear)
            this.clear()
        if(this.state.colorBackground){
            this.fillStyle = this.state.colorBackground;
            this.ctx.fillRect(0, 0, this.width, this.height)
        }
        this.update(data, opt)
    }
    clear(){
        if(this.ctx)
            this.ctx.clearRect(0,0,this.width,this.height)
    }
    render() {
        const { id, width, height} = this.state;
        return (
            <div className='visualizer-container' ref={this.refContainer}>
                <canvas width={width} height={height} id={id+this.type} ref={this.refCanvas} className={'visualizer-canvas'}/>
            </div>
        );
    }
}
export default Visualizer;
