import Global from '../../Global'
import React, { Component } from 'react';
import moment from 'moment'
import FileUploader from './FileUploader';
import { AiOutlineLoading } from 'react-icons/ai'
import './Waveform2.css';

class Waveform2 extends Component {
    constructor(props) {
        super(props);
        this.state = {
            id:props.id,
            waveformId:props.id + Date.now() + parseInt((Math.random()*1000)),
            bits:props.bits || 8,
            sampleRate:props.sampleRate || 44100,
            color:props.color,
            bgcolor:props.bgcolor,
            markerColor:props.markerColor || props.color,
            selectColor:props.selectColor,
            positionColor:props.positionColor || props.markerColor || props.color,
            loop:props.loop,
            //loopStart:props.loopStart,
            //loopEnd:props.loopEnd,
            //loopIndex:props.loopIndex,
            disabled:props.disabled,
            enableElapsed:props.enableElapsed,
            enableTimecode:props.enableTimecode,
            minDuration:props.minDuration,
            moveWithoutModifier:this.props.moveWithoutModifier,
            duration:props.duration,
            selection:{},
            selections:[],
            loading:false,
            width:0,
            height:0,
            init:false
        };
        
        this.zoomFactor = 0.05;
        this.zoomLevel = 0;
        this.zoomStart = 0;
        this.zoomEnd = 0;

        this.handles = ['left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']
        this.canvas = null;
        this.ctx = null;
        this.elapsedCanvas = null;
        this.elapsedCtx = null;
        this.positionCanvas = null;
        this.positionCtx = null;
        this.refContainer = React.createRef()
        this.refCanvas = React.createRef()
        this.refCanvasElapsed = React.createRef()
        this.refCanvasPosition = React.createRef()

        this.updateWaveform = this.updateWaveform.bind(this)
        this.resetWaveform = this.resetWaveform.bind(this)
        this.onResize = this.onResize.bind(this)
        this.handleMouseClickOutside = this.handleMouseClickOutside.bind(this)
        this.onKey = this.onKey.bind(this)
        this.onChange = this.onChange.bind(this)
        this.onElapsed = this.onElapsed.bind(this)
        this.onState = this.onState.bind(this)
        
    }
    log(){
        //console.log('waveform', this.state.id, Array.prototype.slice.call(arguments).join(' '))
    }
    componentDidMount() {
        this.log('mount', this.state.waveformId)

        this.canvas = document.getElementById(this.state.waveformId)
        this.ctx = this.canvas.getContext('2d'); 
        this.elapsedCanvas = document.getElementById(this.state.waveformId + 'elapsed')
        this.elapsedCtx = this.elapsedCanvas.getContext('2d');
        this.positionCanvas = document.getElementById(this.state.waveformId + 'position')
        this.positionCtx = this.positionCanvas.getContext('2d');
        this.updateSize(()=>this.init())
    }
    componentWillUnmount(){
        this.destroy()
    }
    componentDidUpdate(prevProps){
        if(!this.state.init && !this.initing && this.state.duration)
            return this.init()

        if(prevProps.loopEnd !== this.props.loopEnd || prevProps.loopIndex !== this.props.loopIndex || prevProps.loopStart !== this.props.loopStart)
            this.updateSelectionFromProps()
        //if(prevProps.duration !== this.props.duration) this.updateWaveform(true)
    }
    
    init(){
        this.log('start init')
        if(!Global.engine) 
            return console.log('waveform','engein not ready')
        if(this.state.init || this.state.initing) 
            return this.log('already initing')
        
        const width = this.refContainer.current.clientWidth
        const height = this.refContainer.current.clientHeight
        
        if(!width || !height) return console.error('waveform init aborted')

        this.destroy()
        this.initing = true;
        
        const id = this.state.id;

        Global.engine.on('change'+id, this.onChange) 
        
        if(this.props.enableElapsed){
            Global.engine.on('elapsed'+id, this.onElapsed)
            Global.engine.on('state'+id, this.onState)
        }
        window.addEventListener('resize', this.onResize)
        window.addEventListener('keydown', this.onKey)
        window.addEventListener('keyup', this.onKey)
        window.addEventListener('mousedown', this.handleMouseClickOutside)
        window.addEventListener('mouseup', this.handleMouseClickOutside)
        
        const {loopStart, loopEnd, loopIndex, duration} = this.state;

        if((loopStart || loopEnd) && loopIndex !== undefined)
            this.updateSelectionFromProps(loopStart, loopEnd, loopIndex)

        this.log('end init')
        this.setState({init:true, width, height})    
        this.initing = false;
        this.updateWaveform(true)
    }
    destroy(){
        const {id} = this.state; 
        Global.engine.off('state'+id, this.onState)
        Global.engine.off('change'+id, this.onChange)
        Global.engine.off('elapsed'+id, this.onElapsed)

        window.removeEventListener('resize', this.onResize)
        window.removeEventListener('mousedown', this.handleMouseClickOutside)
        window.removeEventListener('mouseup', this.handleMouseClickOutside)
        window.removeEventListener('keydown', this.onKey)
        window.removeEventListener('keyup', this.onKey)
        clearTimeout(this.resizeTimeout)

        this.log('unmount', this.state.waveformId)
    }
    onChange(duration){

        this.log('changed', duration)
        this.updateSize(()=>{
            this.setState({duration:duration}, ()=>{
                //this.resetSelection()
                console.log('CHANGE WAVEFORM', duration)
                this.updateWaveform(true)    
            })    
        })
    }

    onElapsed(elapsed){

        if(!this.props.enableTimecode && !this.props.enableElapsed) return
        const {width, height, bgcolor, markerColor, color, duration} = this.state;
        const mk = elapsed > 0 && duration > 0 ? (elapsed/duration) * width : 0;
        const mkw = 1;
        const m = 3;
        const w = 50;
        const h = 10;
        const x = width-w-m;
        const y = 0+m;

        // Elapsed Marker
        this.elapsedCtx.clearRect(0, 0, width, height)
        if(mk){
            this.elapsedCtx.fillStyle = markerColor
            this.elapsedCtx.fillRect(mk, 0, mkw, height);
        }

        // Timecode
        if(!this.props.enableTimecode) return

        this.ctx.clearRect(x, y, w, h)
        if(bgcolor){
            this.ctx.fillStyle = bgcolor
            this.ctx.fillRect(x, y, w, h)
        }
        
        this.ctx.font = h+'px Arial';
        this.ctx.fillStyle = color
        this.ctx.textAlign = 'right'; 
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(this.formatDuration(elapsed), width-m, y+h);
    }
    onCanvasPosition(x){
        const {width, height, duration, positionColor} = this.state;
        this.positionCtx.clearRect(0, 0, width, height)
        if(x === false) return
        this.positionCtx.fillStyle = positionColor
        this.positionCtx.fillRect(x, 0, 1, height);
    }
    onResize(){
        clearTimeout(this.resizeTimeout)
        this.resizeTimeout = setTimeout(()=>{
            const {selection, duration, width, height} = this.state;
            this.resetWaveform()
            this.updateSelection(selection)
            this.updateWaveform(true)
            this.log('resize change', width, height)
        },500)
    }
    onKey(e){
        const selection = this.state.selection;
        selection.moveActive = e.altKey && !e.ctrlKey;
        selection.zoomInActive = !e.altKey && e.ctrlKey;
        selection.zoomOutActive = e.altKey && e.ctrlKey;
        this.setState({selection})
    }
    onState(state, updated){
        return
        if(updated.loop !== undefined && !updated.loop)
            this.resetSelection()
    }
    updateSize(cb){
        if(!this.refContainer.current) 
            return console.error('not ready')
        const dimensions = {width:this.refContainer.current.clientWidth, height:this.refContainer.current.clientHeight}
        this.log('update size',dimensions.width + 'x' + dimensions.height)
        this.setState({width:dimensions.width, height:dimensions.height}, cb ? cb : ()=>{})
        return dimensions
    
    }       
    static getDerivedStateFromProps(nextProps) {
        return nextProps;
    }
    resetWaveform(){

        this.ctx.clearRect(0, 0, this.state.width, this.state.height)

        if(!this.refContainer || !this.refContainer.current) return
        const width = parseInt(this.refCanvas.current.clientWidth)
        const height = parseInt(this.refCanvas.current.clientHeight)
        this.ctx.clearRect(0, 0, width, height)
        this.setState({width,height})

    }
    resetSelection(){
        this.setState({selection:{}})
        this.log('reset selection')
    }
    zoom(zoomIn, x){

        const {width} = this.state;
        const timePerc = (x/width)
        this.zoomFactor = 0.025
        this.zoomLevel = !zoomIn ? this.zoomLevel-1 < 0 ? 0 : this.zoomLevel-1 : this.zoomLevel+1;
        const factor = ((1.0)-(this.zoomFactor*this.zoomLevel))

        const duration = this.zoomDuration || this.state.duration
        
        const start =  this.zoomStart || 0
        const end = this.zoomEnd || this.state.duration;
        const newDuration = (duration*factor)
        const durChange = (duration-newDuration);
        const offset = duration*timePerc
        const zoomStart = (start+(durChange/2))+offset
        const zoomEnd = (end-(durChange/2))+offset
        
        this.zoomDuration = zoomEnd-zoomStart;
        this.zoomStart = zoomStart
        this.zoomEnd = zoomEnd
        //console.log(newDuration, zoomEnd-zoomStart)
        //console.log('adjust=', adjust, 'zoomStart=', zoomStart, 'zoomEnd=', zoomEnd)
        console.log('zoom level', this.zoomLevel, factor)
        console.log('zoom start/end/dur', this.zoomStart, this.zoomEnd, duration)
        console.log('zoom duration', this.zoomDuration, newDuration)
        console.log('zoom offset', offset)
        //console.log('new zoom', 'start=', this.zoomStart, 'end=', this.zoomEnd, 'dur=', this.zoomDuration, 'fac=', this.zoomFactor)
        this.updateWaveform(true, {start:this.zoomStart,end:this.zoomEnd})
        

        
        
        //this.zoomStart = zoomStartPerc > zoomEndPerc ? this.zoomStart
        //this.zoomEnd = this.zoomEnd//-zoomEndPerc
        

        
        return 

        /*
        const zoomEndPerc = (pos/end)
        const zoomStartPerc = Math.abs((pos/duration)-1.0)
        const zoomEnd = duration-pos
        const zoomStart = pos
        
        //console.log('newcenter=', pos, 'start', start, 'end=', end, 'startPerc=', (zoomStartPerc*100).toFixed(0)+'%', 'endPerc=', (zoomEndPerc*100).toFixed(0)+'%')   

        return
        //return 
        */
        /*
        this.zoomFactor = !zoomIn ? this.zoomFactor-1 < 0 ? 0 : this.zoomFactor-1 : this.zoomFactor+1;

        this.zoomEnd = zoomEnd
        this.zoomStart = zoomStart
        
        this.zoomDuration = zoomEnd - zoomStart;
        this.zoomCenter = this.zoomStart + (this.zoomDuration/2)

        //console.log('new zoom', time, this.zoomFactor, this.zoomCueIn, this.zoomCueOut, this.zoomDuration)
        console.log('new zoom', 'start=', this.zoomStart, 'end=', this.zoomEnd, 'dur=', this.zoomDuration, 'fac=', this.zoomFactor)
        this.updateWaveform(true, {start:this.zoomStart,end:this.zoomEnd})
        */
    }
    updateWaveform(update, opt = {}){        
        const {id, bits, color, bgcolor, sampleRate} = this.state;
        const duration = opt.start || opt.end ? opt.end - opt.start : this.state.duration
        const width = this.refContainer.current.clientWidth
        const height = this.refContainer.current.clientHeight
        const spp = Math.floor((duration*sampleRate)/width)

        if(!this.refContainer || !this.refContainer.current || !duration) 
            return console.log('not done', this.state.duration)

        if(update){
            console.log('update waveform data', id, 'spp=', spp, 'bits=', bits, 'duration=', duration, 'width=', width)
            this._waveformData = Global.engine.extractPeaks(id, spp, {bits:bits, ...opt})
        }
        if(!this._waveformData)
            return console.error('waveform no data!')
        

        const data = this._waveformData.data;
        const center = height/2
        const left = data[0]
        const numChannels = data.length;
        const right = numChannels > 1 ? data[1] : null;
        let max = 0
        data[0].forEach((level)=>{
            if(Math.abs(level) > max)
                max = level;
        })

        const blockSize = parseInt(Math.floor(left.length/width));
        
        this.ctx.clearRect(0, 0, width, height)

        if(bgcolor){
            this.ctx.fillStyle = bgcolor
            this.ctx.fillRect(0, 0, width, height)
        }
        
        for (let i=0, x=0; i < left.length+blockSize; i+=blockSize, x++) {
            let chunk = left.slice(i,i+blockSize > left.length-1 ? left.length-1: i+blockSize)
            const avg = Math.max(...chunk)
            this.ctx.fillStyle = color
            if(avg === 0 || avg === -0)
                this.ctx.fillRect(x,center,1,1);
            else{
                const h = parseInt((avg/max)*height);
                this.ctx.fillRect(x, center-(h/2), 1, h);
            }
        }
        
        
        /*
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = color
        this.ctx.beginPath();
        this.ctx.moveTo(0, center);
        console.log(left)
        for (let i=0, x=0; i < left.length+blockSize; i+=blockSize, x++) {
            let chunk = left.slice(i,i+blockSize > left.length-1 ? left.length-1: i+blockSize)
            //const avg = Math.max(...chunk)
            console.log(chunk.length)
            const avg = chunk.reduce((a, b) => a + b, 0)/chunk.length;
            const ma = Math.max(...chunk)
            const mi = Math.abs(Math.min(...chunk))
            
            if(avg === 0 || avg === -0)
                this.ctx.lineTo(x, center);
            else if(mi > ma){
                const perc = (mi/Math.abs(min))
                this.ctx.lineTo(x, center + (center*perc));
            }else{
                const perc = (ma/max)
                this.ctx.lineTo(x, center-(center*perc));
            }
            
        }
        this.ctx.stroke();
        */        

    }
    
    handleMouseEvents(e){
        if(!this.state.duration || this.state.disabled) return
    
        e.stopPropagation()
        
        const {width, selection, duration} = this.state;
        const _selection = {...selection}
        const x = e.clientX - this.refContainer.current.parentNode.offsetLeft
        const time = (x/width)*duration
        const type = e.type
        
        if(type === 'mousemove')  
            this.onCanvasPosition(x)
        if(type === 'mouseenter'){
            selection.leaveRight = false
            selection.leaveLeft = false
            this.setState({hover:true})
            return this.updateSelection(selection, true)
        } else if(type === 'mouseleave'){
            if(selection.active || selection.handleActive || selection.movingActive){
                if(x < (width/2)){
                    selection.start = 0
                    selection.leaveLeft = true
                }else{
                    selection.end = duration;
                    selection.leaveRight = true
                }
            }
            this.onCanvasPosition(false)
            this.setState({hover:false})
            return this.updateSelection(selection, true)
        }

        if(selection.moveActive && selection.hover)
            return this.handleMove(e)
        if(selection.zoomInActive || selection.zoomOutActive)
            return type === 'mousedown' ? this.handleZoom(e) : null

        if(type === 'mousedown'){
            selection.start = time
            selection.end = time;
            selection.active = true
            selection.idx = undefined
            this.handleCallback(selection, 'start')
        } else if(type === 'mouseup'){
            selection.active = false
            selection.handleActive = false;
            //this.updateSelection(selection)
        } else if(type === 'mousemove'){
            if(selection.active && !selection.handleActive){
                selection.end = time
            }
            else if(!selection.active && selection.handleActive === 'right')
                selection.end = time
            else if(!selection.active && selection.handleActive === 'left')
                selection.start = time
            
        } else 
            return

        if(_selection.start === selection.start && _selection.end === selection.end) 
            return 

        this.updateSelection(selection)
    }
    handleMouseClickOutside(e){
        const {width, selection, duration} = this.state;
        if(!selection.leaveLeft && !selection.leaveRight) return

        if((selection.active || selection.handleActive || selection.movingActive)){
            if(e.type === 'mouseup'){
                if(selection.leaveLeft)
                    selection.start = 0
                else if(selection.leaveRight)
                    selection.end = duration;
                selection.handleActive = false
                selection.active = false
                this.updateSelection(selection)
            }
        }
    }
    handleSelectionHover(e, hover){
        this.setState({selection:{...this.state.selection, hover}})
    }
    handleSelectionHandle(e, dir){
        const type = e.type
        const {selection} = this.state;
        const x = e.clientX - this.refContainer.current.parentNode.offsetLeft

        if(type === 'mousedown'){
            selection.active = false
            selection.handleActive = dir
            e.stopPropagation()
        }else if(type === 'mouseup'){
            selection.active = false
            selection.handleActive = false
        }else if(type === 'mouseleave'){
            selection.handleLeave = true
        }
        //this.setState({selection})
    }
    handleMove(e){
        const type = e.type
        const {selection, width, duration} = this.state;
        let x = e.clientX - this.refContainer.current.parentNode.offsetLeft
        let time = (x/width)*duration
        if(!selection.hover) return
        if(type === 'mousedown'){
            selection.movingActive = true
            selection.movingX = (selection.x + selection.width)/2
            e.stopPropagation()
        }else if(type === 'mouseup'){
            selection.movingActive = false
            this.updateSelection(selection)
        }else if(type === 'mousemove' && selection.movingActive){
            x = x - (selection.movingX/2)
            if(x + selection.width > width){
                selection.start = ((width - selection.width)/width)*duration
                selection.end = (x/width)*duration;
            }else if(x >0){
                selection.start = (x/width)*duration;
                selection.end = selection.start + ((selection.width/width)*duration)
            }else{
                selection.start = 0;
                selection.end = ((selection.width/width)*duration)
            }
        }
        
        this.updateSelection(selection)
    }
    handleZoom(e){
        e.stopPropagation()
        e.preventDefault()

        const type = e.type
        const {selection, width, duration} = this.state;
        let x = e.clientX - this.refContainer.current.parentNode.offsetLeft

        if(type === 'mousedown'){
            this.zoom(selection.zoomInActive, x)
        }else if(type === 'mouseup'){
            
            
        }else if(type === 'mousemove'){

        }
        
    }
    newSelection(selection){
        const {width, duration} = this.state;
        if(selection.start !== selection.end){
            const selections = [...this.state.selections]
            selection.idx = selections.length;
            selections.push({...selection})
            this.setState({selections})
            this.handleCallback(selection, 'new')
        }
        else{
            this.resetSelection()
            this.handleCallback({start:0, end:0, time:selection.time}, 'reset')
        }
        /*
        if(this.state.moveWithoutModifier){
            selection.movingActive = false
            selection.moveActive = true
            selection.movingX = (selection.x + selection.width)/2
            this.updateSelection(selection)
        }
        */
    }
    updateSelectionFromProps(){
        const {loopIndex, loopStart, loopEnd} = this.props;
        if(loopIndex < 0)
            return this.resetSelection()
        const sel = {...this.state.selection, start:loopStart, end:loopEnd, idx:loopIndex}
        
        this.updateSelection(sel, true)
    }
    updateSelection(selection, noCallback){
        const {width, duration, minDuration} = this.state
        let {start, end, idx} = selection;

        if(!duration || (!start && !end)) return
        //if(!duration) return
        // /console.log('updateSelection', start, end)
        if(start === end && minDuration) 
            end = start + minDuration
        if(end > duration)
            end = duration;
        selection.x = ((end < start ? end : start)/duration)*width;
        selection.width = ((end > start ? end - start : start - end)/duration)*width
        selection.time = end > start ? end : start;

        if(idx === undefined){
            const selections = [...this.state.selections]

            selection.idx = selections.length;
            selections.push({...selection})
            this.setState({selections})
            console.log('NEW SELECTION')
            return this.handleCallback(selection, 'new')
        }

        this.setState({selection})
        if(!noCallback)
            this.handleCallback(selection, 'change')
    }
    handleCallback(selection, type){
        const start = selection.start > selection.end ? selection.end : selection.start;
        const end = selection.end < selection.start ? selection.start : selection.end;
        const sel = { start, end, time: selection.time, duration: end-start, idx: selection.idx}
        //console.log('CALLBACK', type)
        if(type === 'change' && this.props.onSelectionChange)
            this.props.onSelectionChange(sel)
        else if((type === 'new' || type === 'reset') &&  this.props.onSelection)
            this.props.onSelection(sel)
        else if(type === 'start' && this.props.onSelectionStart)
            this.props.onSelectionStart(sel.time)
    }
    formatDuration(sec, rate){
      const time = moment.utc(moment.duration(rate ? sec/rate : sec , 'seconds').asMilliseconds())
      return time.format((time.hours()>0 ? 'HH:' : '') + 'mm:ss:SSS')
    }
    onUpload(buffer, filename){
        if(this.props.onUpload)
            this.props.onUpload(buffer, filename)
    }
    onUploadProgress(prog){
        if(this.props.onUploadProgress)
            this.props.onUploadProgress(prog)
    }
    onUploadError(err){
        if(this.props.onUploadError)
            this.props.onUploadError(err)
    }
    render() {
        const {
            id, 
            width, 
            height, 
            waveformId, 
            selection, 
            loading,
            duration,
            selectColor,
            hover,
            positionColor,
            bgcolor,
            color
        } = this.state;
        
        const selectionStyle = {
            width:selection.width +'px', 
            left:selection.x + 'px', 
            backgroundColor:selectColor || undefined, 
            cursor: !selection.hover ? undefined : selection.moveActive ? selection.movingActive ? 'grabbing' : 'grab' : undefined
        }
        const leftHandleStyle = {left:selection.x + 'px'}
        const rightHandleStyle = {left:selection.x+selection.width+ 'px'}
        const containerStyle = {cursor: selection.zoomInActive ? 'zoom-in' : selection.zoomOutActive ? 'zoom-out' : selection.handleActive ? 'ew-resize' : 'default'}
        return (
            <div
                id={'waveform-container'+waveformId}
                className='waveform-container' 
                ref={this.refContainer}
                style={containerStyle}
                onMouseMove={(e)=>this.handleMouseEvents(e)} 
                onMouseDown={(e)=>this.handleMouseEvents(e)} 
                onMouseUp={(e)=>this.handleMouseEvents(e)}
                onMouseEnter={(e)=>this.handleMouseEvents(e)}
                onMouseLeave={(e)=>this.handleMouseEvents(e)}
                onContextMenu={(e)=>this.handleZoom(e)}
            >
                <canvas 
                    id={waveformId}
                    width={width}
                    height={height}
                    ref={this.refCanvas} 
                    className={'waveform-canvas'} 
                    onMouseMove={(e)=>e.stopPropagation()} 
                />
                <canvas 
                    id={waveformId+'elapsed'}
                    width={width}
                    height={height}
                    ref={this.refCanvasElapsed} 
                    className={'waveform-canvas'} 
                />
                <canvas 
                    id={waveformId+'position'}
                    width={width}
                    height={height}
                    ref={this.refCanvasPosition} 
                    className={'waveform-canvas'}
                />

                {/*(hover && !selection.moveActive) && <div className={'waveform-position'} style={cursorPosition}></div>*/}
                {(selection.start !== undefined || selection.end !== undefined) ?
                    <div 
                        id={'waveform-selection'+id} 
                        className={'waveform-selection-container'}
                    >   
                        <FileUploader
                            id={'waveform-fileuploader'} 
                            multi={false}
                            color={color}
                            backgroundColor={bgcolor}
                            label={'DROP FILE'}
                            onUpload={(buffer, filename) => this.onUpload(buffer, filename)}
                            onUploadProgress={(progress)=>this.onUploadProgress(progress)}
                            onUploadError={(err)=>this.onUploadError(err)}
                        />
                        <div 
                            className={'waveform-selection'} 
                            style={selectionStyle}
                            onMouseEnter={(e)=>this.handleSelectionHover(e, true)}
                            onMouseLeave={(e)=>this.handleSelectionHover(e, false)}
                        ></div>
                        {this.handles.map((pos, idx)=>
                            <div 
                                key={idx}
                                className={'waveform-handle-'+pos} 
                                style={pos.includes('left') ? leftHandleStyle : rightHandleStyle}
                                onMouseMove={(e)=>this.handleSelectionHandle(e, pos.includes('left') ? 'left' : 'right')} 
                                onMouseDown={(e)=>this.handleSelectionHandle(e, pos.includes('left') ? 'left' : 'right')} 
                                onMouseUp={(e)=>this.handleSelectionHandle(e, pos.includes('left') ? 'left' : 'right')}
                            ></div>    
                        )}
                        {loading && <div className={'waveform-loading'}><AiOutlineLoading/></div>}
                    </div>
                :
                    <FileUploader
                        id={'waveform-fileuploader'} 
                        multi={false}
                        color={color}
                        backgroundColor={bgcolor}
                        label={'DROP FILE'}
                        onUpload={(buffer, filename) => this.onUpload(buffer, filename)}
                        onUploadProgress={(progress)=>this.onUploadProgress(progress)}
                        onUploadError={(err)=>this.onUploadError(err)}
                    />
                }
            </div>
        );
    }
}
export default Waveform2;
