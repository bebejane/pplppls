import Global from '../../../Global'
import React from 'react';
import PurpleApp from '../'
import FrequencyVisualizer from '../../visualizers/FrequencyVisualizer';
import VolumeVisualizer from '../../visualizers/VolumeVisualizer';
import OscilloscopeVisualizer from '../../visualizers/OscilloscopeVisualizer';
import FileUploader from '../../util/FileUploader';
import Waveform from '../../util/Waveform3';
//import Sequencer from '../../util/Sequencer';
import Select from '../../util/Select';
import {BsChevronLeft, BsChevronRight, BsChevronDoubleLeft, BsChevronDoubleRight} from 'react-icons/bs'
import {MdRemoveCircleOutline} from 'react-icons/md'

import './index.css'

const PATTERNS = ['Up', 'Down', 'UpDown', 'DownUp', 'Random']
const TYPES = ['sequence', 'loops']
const GROOVES = ['straight','groove']
const NOTES = [4,8,16,32]
const DRUMKITS = [{
    id:'bossdr110',
    name:'Boss Dr 110',
    path:'/drumkits/bossdr110',
    samples:{
        kick:{
            file:'110KIK.WAV',
            state:{
                volume:0.5,
                indexes:[]
            }
        }, 
        snare:{
            file:'110SNR.WAV',
            state:{
                volume:0.5,
                indexes:[]
            }
        },
        hihat:{
            file:'110CHH.WAV',
            state:{
                volume:0.2,
                indexes:[]
            }
        }
    }
},{
    id:'rhythmking',
    name:'Rhythm King',
    path:'/drumkits/rhythmking',
    samples:{
        kick:{
            file:'mrk-bd01.wav',
            state:{
                volume:0.5,
                indexes:[]
            }
        }, 
        snare:{
            file:'mrk-sd#1.wav',
            state:{
                volume:0.5,
                indexes:[]
            }
        },
        hihat:{
            file:'mrk-hh03.wav',
            state:{
                volume:0.2,
                indexes:[]
            }
        },
        cymbal1:{
            file:'mrk-cy-#012.wav',
            state:{
                volume:0.2,
                indexes:[]
            }
        }
    }
}]
const defaultConfig = {
    volume:0.5,    
    groove:GROOVES[0],
    tempo:120,
    note:1,
    stretch:0,
    pitch:1.0,
    rate:1.0,
    delayTime:0.1,
    minDuration:
    0.5,
    fade:{
        in:0,
        out:0
    },
    drums:{...DRUMKITS[1]},
    drumsVolume:1.0,
    drumsOffset:0
}

class Wave extends PurpleApp {
    constructor(props) {
        super(props);
        this.state = {
            ...this.state,
            initDrums:true,
            playing:false,
            updating:false,
            //selections:0,
            index:-1,
            loopIndex:-1,
            loopStart:0,
            loopEnd:0,
            grooveIdx:0,
            config:defaultConfig,
            uploading:false,
            progress:0,
            processing:false,
            sequence:[],
            disabled:[]
        }
        this.engineOptions = {
            samplepitch: 44100,
            channels: 2,
            volume: 1.0,
            enableElapsed:true,
            enableLoops:true,
            electron:this.isElectron(),
            enableAnalysers:true,
            processSample:{
                //normalize:true,
                trim:true
            }
        }
        this.appId = 'wave'
        this.sampleId = 'wavetest'
        this.soundURL = '/test/7.mp3'
        this.inputSelect = null
        this.recordings = []
        this.selections = []
        this.timeouts = []
        this.drumsTimeouts = []
        this.sequence = []
        this.fileUploaderRef = React.createRef()
        this.onKeyDown = this.onKeyDown.bind(this)
        this.onKeyUp = this.onKeyUp.bind(this)
        this.onSequencePlay = this.onSequencePlay.bind(this)
        this.arrowInterval = {} 
        
        this.sequencer = null;
    }
    async initDone(){
        console.log('INIT DONE effing!!!')
        const {config} = this.state;
        const {kick,hihat,snare} = config.drums;

        this.setState({init:false})
        Global.engine.once('load'+this.sampleId, async (id)=>{
            const duration = Global.engine.duration(this.sampleId)
            await this.initDrumKit(this.state.config.drums)
            this.setState({init:true, duration})
            this.addListeners()
        })
        Global.engine.add(this.sampleId, this.soundURL, 'sqdqds', {volume:this.state.config.volume})
        Global.engine.addEffect(this.sampleId, 'delay', true, {mix:0.3, time:config.delayTime, feedback:0.1})
        Global.engine.load()
        this.sequencer = Global.engine.createSequencer()
        this.sequencer.on('play', this.onSequencePlay)
        this.sequencer.on('start', ()=>this.setState({playing:true}))
        this.sequencer.on('stop', ()=>{
            Global.engine.master.stop()
            if(!this.sequencer || !this.sequence.length) return
            const seq = this.sequence[0]
            const state = {playing:false, loopStart:seq.sounds[0].opt.start, loopEnd:seq.sounds[0].opt.start+seq.duration, loop:true, loopIndex:seq.loopIndex, index:seq.index}
            this.setState(state)
        })
        this.sequencer.on('updating', (on)=>this.setState({updating:on}))
        this.sequencer.on('paused', (on)=>this.setState({paused:on}))
        this.sequencer.on('browse', (index, loopIndex)=>this.playSample(index, loopIndex))
        Global.engine.on('change'+this.sampleId,(duration)=>{
            this.setState({duration})
        })
        
    }
    async initDrumKit(kit){
        console.log('INIT DRUMS', kit.name)
        this.setState({initDrums:true})
        return new Promise((resolve, reject)=>{
            const total = Object.keys(kit.samples).length
            let loaded = 0;

            Object.keys(kit.samples).forEach((type)=>{
                const sample = kit.samples[type]
                Global.engine.add(type, kit.path + '/' + sample.file, sample.file, sample.state)
                Global.engine.once('load'+type, ()=>{
                    if(++loaded === total){
                        this.setState({initDrums:false})
                        resolve()
                        console.log('INIT DRUMS DONE!', kit.name)
                    }
                })
                Global.engine.load(type)
            })
        })
    }
    async onDrumkitChange(id){
        const kit  = DRUMKITS.filter((k)=> k.id === id)[0]
        if(!kit) 
            return console.error('kit not found', id)
        const current = {...this.state.config.drums};
        Object.keys(current.samples).forEach((type)=>{
            Global.engine.remove(type)
        })
        await this.initDrumKit(kit)
        this.setConfig('drums', kit)
        this.setState({initDrums:false})
    }
    componentWillUnmount() {
        this.removeListeners()
        this.sequencer.stop()
        this.props.onQuit()
    }
    addListeners(){
        document.body.addEventListener('keydown', this.onKeyDown)
        document.body.addEventListener('keyup', this.onKeyUp)
        document.querySelectorAll('input').forEach((el)=>{
            el.addEventListener('mouseup',()=>el.blur())
        })
        //console.log(inputs)

    }
    removeListeners(){
        document.body.removeEventListener('keydown', this.onKeyDown)
        document.body.addEventListener('keyup', this.onKeyUp)
    }
    onKeyDown(e){
        const key = e.key;
                
        if(e.target.tagName === 'INPUT') return
        switch (key) {
            case ' ':
                !this.sequencer.isPlaying() && !this.sequencer.isPaused() ? this.play() : this.sequencer.isPaused() ? this.sequencer.unpause() : this.sequencer.pause()
            break;
            case 'ArrowLeft':
                this.browse(false)
                e.preventDefault()
            break;
            case 'ArrowRight':
                this.browse(true)
                e.preventDefault()
            break;
            case 'ArrowDown':
                this.onArrowKey(key,true)
                e.preventDefault()
            break;
            case 'ArrowUp':
                this.onArrowKey(key,true)
                e.preventDefault()
            break;
            case 'Backspace':
                this.removeSelection(this.state.loopIndex)
                e.preventDefault()
            break;
            default:
            break;
        }
    }
    onKeyUp(e){
        const key = e.key;
        if(e.target.tagName === 'INPUT') return
        switch (key) {
            case 'ArrowDown':
                this.onArrowKey(key, false)
            break;
            case 'ArrowUp':
                this.onArrowKey(key, false)
            break;
            case 'Backspace':
                e.preventDefault()
            break;
            default:
            break;
        }
        
    }
    onArrowKey(key, pressed){
        if(!pressed){
            clearInterval(this.arrowInterval[key])
            return this.arrowInterval[key] = undefined;
        }
        if(this.arrowInterval[key]) return

        let interval = 30;
        if(key === 'ArrowUp' || key === 'ArrowDown')
            interval = this.state.config.groove === 'straight' ? 30 : 10

        this.arrowInterval[key] = setInterval(()=>{
            const {tempo, stretch, groove, volume} = this.state.config;
            
            switch (key) {
                case 'ArrowDown':
                    if(groove === 'straight')
                        this.setConfig('tempo', tempo>0 ? tempo-1 : 1)
                    else if(groove === 'groove')
                        this.setConfig('stretch', stretch>-10000 ? stretch-1 : -1000)
                break;
                case 'ArrowUp':
                    if(groove === 'straight')
                        this.setConfig('tempo', tempo>=300 ? 300 : tempo+1)
                    else if(groove === 'groove')
                        this.setConfig('stretch', stretch<1000 ? stretch+1 : 1000)
                break;
                default:
                break;
            }
        },interval)
    }
    onSampleNoteChange(note){
        this.setConfig('sampleNote',note)
    }
    onDrumNoteChange(note){
        this.setConfig('drumNote',note)   
    }
    setConfig(key, conf, temp){
        const config = {...this.state.config}
        config[key] = typeof config[key] === 'object' ? {...config[key],...conf} : conf
        
        this.setState({config}, ()=>{
            if(temp) return;
            this.applyNewConfig(key, conf)
            localStorage.setItem('wave-config', JSON.stringify(config))
        })
    }
    applyNewConfig(key, val){
        if(key === 'volume')
            return Global.engine.volume(this.sampleId, val)
        else if(key === 'drums')
            return 
        else if(key === 'tempo'){
            if(this.state.config.groove === 'groove'){

                let max = Global.engine.duration(this.sampleId)
                let min = max;
                this.sequence.forEach((seq)=> {
                    console.log(seq.duration)
                    if(seq.duration < min)
                        min = seq.duration;
                })
                
                const minDuration = min+(val/300)*(max-min)
                //console.log(val, min,max, minDuration)
                return this.setConfig('minDuration', minDuration)
            }
            else
                this.sequencer.tempo(val, this.state.config.groove === 'groove')
            
        }
        else if(key === 'minDuration')
            return this.update(0)
        else if(key === 'drumsOffset'){
            this.drumsTimeouts.forEach((id)=>clearTimeout(id))
            this.drumsTimeouts = []
        }
        else if(key === 'pitch'){
            return this.setState({processing:true}, ()=>{
                setTimeout(()=>{
                    Global.engine.pitch(this.sampleId, val)
                    this.setState({processing:false})    
                },1000)
                
            })
            
        }
        else if(key === 'rate'){
            Global.engine.rate(this.sampleId, val)
        }
        else if(key === 'delayTime'){
            return Global.engine.effectParams(this.sampleId, 0, {time:val})
        }
        
        this.update()
    }
    setDrum(type, opt){
        const drums = {...this.state.config.drums}
        drums.samples[type].state = {...drums.samples[type].state, ...opt}
        if(opt.volume !== undefined)
            Global.engine.volume(type, opt.volume)
        this.setConfig('drums', drums)
    }
    switchDrum(idx,type){
        const drums = {...this.state.config.drums}
        if(drums.samples[type].state.indexes.includes(idx))
            drums.samples[type].state.indexes = drums.samples[type].state.indexes.filter((i)=>i!=idx)
        else
            drums.samples[type].state.indexes.push(idx)
        this.setConfig('drums', drums)
    }
    addSelection(sel){
        if(sel.start  === 0 && sel.end === 0) return
        const selections = this.selections.push({...sel})
        const playing = this.state.playing;
        const state = {selections, loopIndex:selections-1}
        if(!playing) state.index = selections-1
            
        this.setState(state, ()=>{
            if(!playing)
                this.update()
            else{
                const event = this.selectionToEvent(selections-1)
                this.sequencer.add(event)
                this.updateSequence()
            }
        })
        
    }
    updateSelection(sel){
        if(this.state.playing) return //console.error('update on play')
        
        clearTimeout(this.updateSelectionTimeout)
        this.updateSelectionTimeout = setTimeout(()=>{
            this.selections = this.selections.map((s)=> s.idx === sel.idx ? sel : s)
            this.update()
        },200)
    }
    removeSelection(loopIndex){
        if(loopIndex === -1) return
        console.log('remove',loopIndex)
        this.selections = this.selections.filter((sel)=>sel.idx !==loopIndex)
        this.update()
        if(this.selections.length === 0){
            this.stop()
            this.setState({loopIndex:-1, loopStart:0, loopEnd:0})
        }
    }
    onSequencePlay(index, loopIndex){
        const seq = this.sequence[index]
        if(!seq) return console.error('seq not there', index)
        this.playSample(index, loopIndex)
        //if(seq.disabled) return //console.error('disabled')
        //const {drums} = this.state.config;
        //this.playDrums(seq.sounds.filter((s)=>s.id !== this.sampleId &&))
        this.playDrums(index)
    }
    playSample(index, loopIndex){

        const seq = this.sequence.filter((s)=>s.loopIndex === loopIndex)[0]//this.sequence[index]
        if(!seq) 
            return console.error('sequence not found', index)
        const sound = seq.sounds.filter((s)=>s.id===this.sampleId)[0]
        if(!seq.disabled)
            Global.engine.play(sound.id, {...sound.opt, duration:seq.duration})

        const state = {loopStart:sound.opt.start, loopEnd:sound.opt.start+seq.duration, loop:true, loopIndex:seq.loopIndex, index:seq.index}
        this.setState(state)
    }
    playDrums(index){
        //sounds.forEach((sound)=>{
        const {drumsOffset} = this.state.config;
        const {samples} = this.state.config.drums;
        
        Object.keys(samples).filter((type)=>samples[type].state.indexes.includes(index)).forEach((type)=>{

            const timeoutId = setTimeout(()=>Global.engine.play(type), drumsOffset)
            this.drumsTimeouts.push(timeoutId)
        })
            
        //})
    }
    playPad(index){
        if(this.sequencer.isPlaying())
            return this.play(index)
            
        this.playSample(index, this.sequence[index].loopIndex)
    }
    async play(startAt=0){
        
        if(!this.selections.length) return alert('Click on wave to add loops')
        const groove = this.state.config.groove;
        this.updateSequence()
        this.sequencer.start([...this.sequence], true, groove === 'groove' ? true : false, startAt)
    }
    genepitchSequence(){
        const sequence = []
        const length = this.selections.length;
        for (var i = 0; i < length; i++)
            sequence.push(this.selectionToEvent(i))
        return sequence;
    }
    updateSequence(){
        const sequence = this.genepitchSequence()
        this.sequence = sequence;
        this.setState({sequence})
        return this.sequence;
    }
    selectionToEvent(i){
        const selection = {...this.selections[i]}
        const {stretch, fade, groove, minDuration} = this.state.config;
        const dur = groove === 'straight' ? this.tempoToDuration() : (selection.end-selection.start)+(stretch/1000)
        const duration = dur <= 0 ? minDuration : dur
        const drum = {id:(i % 2) ? 'snare' : 'kick', duration, opt:{fadeIn:0, fadeOut:0, enableElapsed:false}}
        const hihat = {id:'hihat', duration, opt:{fadeIn:0,fadeOut:0,enableElapsed:false}}
        const event = {
            sounds:[{
                id:this.sampleId, 
                opt:{
                    start:selection.start,
                    end:selection.end,
                    fadeIn:fade.in/10, 
                    fadeOut:fade.out/10,
                    enableElapsed:true,
                    fadeType:'exponential',
                    duration,
                },
                
            },drum, hihat],
            //selection:selection,
            duration:duration,
            disabled: this.state.disabled.includes(i),
            loopIndex:selection.idx,
            index:i
        }
        return event;
    }
    update(delay = 100){
        clearTimeout(this.updateTimeout)
        this.updateTimeout = setTimeout(()=>{
            const sequence = this.genepitchSequence()
            this.sequencer.update([...sequence], true, this.state.config.groove === 'groove' ? true : false, ()=>{
                this.updateSequence()
            })    
        },100)
    }
    enable(idx, on = true){
        const disabled = [...this.state.disabled].filter((i)=>i!==idx)
        if(on === true)
            disabled.push(idx)
        this.setState({disabled}, ()=>{
            this.updateSequence()
        })
    }
    stop(){
        this.sequencer.stop()
        this.setState({playing:false})
    }
    pause(on){
        if(on)
            this.sequencer.pause()
        else
            this.sequencer.unpause()
    }
    clear(){
        this.stop()
        this.selections = []
        this.setState({loopIndex:-1, config:defaultConfig, loopStart:0, loopEnd:0, selections:0, index:-1, sequence:[]})
        Global.engine.volume(this.sampleId, defaultConfig.volume)
        this.sequencer.tempo(defaultConfig.tempo)
    }
    
    browse(ffw){
        this.sequencer.browse(ffw)
    }
    toggleGroove(){
        const grooveIdx = this.state.grooveIdx+1 >= GROOVES.length ? 0 : this.state.grooveIdx+1;
        this.setConfig('groove', GROOVES[grooveIdx])
        this.setState({grooveIdx})
    }
    onUpload(buffer, filename){
        this.clear()
        const objURL = URL.createObjectURL(new Blob([buffer], {type: Global.fileToMimeType(filename)}));
        Global.engine.replace(this.sampleId, objURL, filename);
    }
    onUploadProgress(progress){
        console.log(progress)
    }
    onUploadError(err){
        console.error(err)
    }
    onOpenFile(e){
        this.fileUploaderRef.current.removeEventListener('change',this.onFileChange)
        this.fileUploaderRef.current.addEventListener('change', this.onFileChange.bind(this))
        this.fileUploaderRef.current.click()
        e.stopPropagation()
    }
    onFileChange(event){
        console.log('upload file from open button', event.target.files)
        if(!event.target.files.length) return 
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.addEventListener('load', (e)=>{
            this.onUpload(e.srcElement.result, file.name)
            this.setState({uploading:false, error:null, progress:100})
        })
        reader.addEventListener('progress', (e)=>{
            this.setState({progress:parseInt((e.loaded/e.total)*100)})
        })
        reader.addEventListener('error', (err)=>{
            this.setState({uploading:false, error:err})
        })
        reader.addEventListener('abort', ()=>{
            this.setState({uploading:false})
        })
        reader.readAsArrayBuffer(file)
        this.setState({uploading:true})
    }
    onUploadSampleFromFile(){
    }
    
    tempoToDuration(){
        return 60/this.state.config.tempo/this.state.config.note
    }
    sleep(ms){
        return new Promise((resolve)=>setTimeout(()=>resolve(), ms))
    }
    handleSelectionStart(){
        //Global.engine.stop(this.sampleId)
    }
    sample(start){
        this.clear()

        if(start){
            if(this.state.sampling) return
            this.setState({sampling:true})
            Global.engine.sample(this.sampleId, true).then((recording)=>{
                //const objURL = URL.createObjectURL(new Blob([recording.buffer], {type: Global.fileToMimeType(recording.filename)}));
                //Global.engine.replace(this.sampleId, objURL, recording.filename);
            }).catch((err)=>{
                this.setState({sampling:false})
            })
            Global.engine.once('load', ()=>{
                this.setState({sampling:false, duration:Global.engine.duration(this.sampleId)})
            })
        }else{
            if(!this.state.sampling) return
            Global.engine.sample(this.sampleId, false);
        }
    }
    render() {
        const {
            init,
            progress,
            uploading,
            duration, 
            playing,
            updating,
            config, 
            loopStart,
            loopEnd,
            loopIndex,
            paused,
            index,
            sampling,
            loading,
            sequence,
            processing,
            lodaingMessage
        } = this.state

        if(!init || loading) return <div id={'wave-loading'}><div id={'wave-loading-message'}><div>{lodaingMessage || 'loading'}</div></div></div>
        const inputSelect = this.inputDeviceSelect('down', true)
        const switchStyle = {animation: updating ? 'updating 0.1s cubic-bezier(1, 0.5, 1, 1) infinite alternate': undefined}
        const {drums} = config;
        const counter = (index === undefined ? '00' : (index+1)<10 ? '0' + (index+1) : (index+1)) + ' / ' + (sequence.length < 10 ? '0' + sequence.length : sequence.length)

        const pads = sequence.map((seq, idx)=>
            <div key={'pad'+idx} className='wave-sequencer-pad-wrap'>
                <div 
                    className={idx === index ? 'wave-sequencer-pad-playing' : 'wave-sequencer-pad'}
                    onClick={()=>this.playPad(idx)}
                ></div>
                <div className='wave-sequencer-pad-switch' onClick={()=>this.enable(idx, !seq.disabled)}>
                    <div 
                        className={seq.disabled ? 'wave-sequencer-pad-switch-disabled' : idx === index ? 'wave-sequencer-pad-switch-on-active' : 'wave-sequencer-pad-switch-on'}
                        style={switchStyle}
                    ></div>
                </div>
                <div className='wave-sequencer-drum-switches'>
                    {Object.keys(drums.samples).map((type,i)=>
                        <div
                            key={'ds-'+i}
                            title={type}
                            className={drums.samples[type].state.indexes.includes(idx) ? 'wave-sequencer-drum-switch-on' : 'wave-sequencer-drum-switch-off'} 
                            onClick={()=>this.switchDrum(idx,type)}>
                        </div>
                    )}
                </div>
            </div>
        )
        return (
            <div id='wave-container'>
                <div id='wave-top'>
                    <div className={'wave-button-browse'} onClick={()=>this.browse(false)}><BsChevronLeft/></div>
                    <div className={'wave-count'}>{counter}</div>
                    <div className={'wave-button-browse'} onClick={()=>this.browse(true)}><BsChevronRight/></div>
                    
                </div>
                <div id='wave-controls'>
                    <div className={playing ? 'wave-button-pressed' : 'wave-button'} onClick={()=>playing ? this.stop() : this.play()} >{'PLAY'}</div>
                    <div className={paused ? 'wave-button-pressed' : 'wave-button'} onClick={()=>this.pause(!paused)}>{'PAUSE'}</div>
                    <div className={'wave-button'} onClick={()=>this.sample(!sampling)}>{sampling ? 'STOP' : 'REC' }</div>
                    <div className={'wave-button'} onClick={()=>this.clear()}>{'CLEAR'}</div>
                    <div className={'wave-button'} onClick={()=>this.toggleGroove()}>{config.groove.toUpperCase()}</div>
                </div>
                <div id='wave-waveform'>
                    {sampling ?  
                        <OscilloscopeVisualizer id={'input'} color={'rgb(255, 0, 0)'} ready={init} options={{fftSize:1024}}/>
                    :
                    processing ? 
                        <div id='wave-processing'>patience...</div>
                    :
                        <Waveform 
                            id={this.sampleId}
                            key={'effingk'}
                            bits={8}
                            color={'rgb(136, 230, 230)'} 
                            bgcolor={'#6a026a'}
                            markerColor={'rgba(255, 255, 255,0.8)'} 
                            enableElapsed={true}
                            //enableTimecode={true}
                            duration={duration}
                            //disabled={playing} 
                            loop={true}
                            loopStart={loopStart}
                            loopEnd={loopEnd}
                            loopIndex={loopIndex}
                            rate={config.rate}
                            moveWithoutModifier={true}
                            minDuration={config.minDuration}
                            onSelection={(selection)=>this.addSelection(selection)}
                            onSelectionChange={(selection)=>this.updateSelection(selection)}
                            onSelectionStart={()=>this.handleSelectionStart()}
                            onUpload={(buffer, filename)=>this.onUpload(buffer, filename)}
                            onUploadProgress={(progress)=>this.onUploadProgress(progress)}
                            onUploadError={(err)=>this.onUploadError(err)}
                        />
                    }
                </div>
                <div id='wave-sequencer' className={updating ? 'wave-sequencer-updating' : undefined }>
                    {pads}
                </div>
                <div id='wave-settings'>
                    <div className='wave-sliders'>
                        <div className='wave-slider'>
                            <div>volume</div>
                            <div>
                                <input
                                    type="range" 
                                    min="0.00001"
                                    max="1.0"
                                    step="0.01"
                                    value={config.volume} 
                                    onChange={(e)=>this.setConfig('volume',parseFloat(e.target.value))}
                                />
                            </div>
                            <div>{parseInt(config.volume*100)}%</div>
                        </div>
                        <div className='wave-slider'>
                            <div>tempo</div>
                            <div>
                                <input
                                    type="range" 
                                    min={1}
                                    max="300"
                                    step="1"
                                    reverse={'true'}
                                    //disabled={!(config.groove === 'straight')} 
                                    value={config.tempo} 
                                    onChange={(e)=>this.setConfig('tempo', parseInt(e.target.value))}
                                />
                            </div>
                            <div>{parseInt(config.tempo)}bpm</div>
                        </div>
                        {/*
                        <div className='wave-slider'>
                            <div>stretch</div>
                            <div>
                                <input
                                    type="range" 
                                    min={-1000}
                                    max="1000"
                                    step="1"
                                    disabled={!(config.groove === 'groove')}
                                    value={config.stretch} 
                                    onChange={(e)=>this.setConfig('stretch', parseInt(e.target.value))}
                                />
                            </div>
                            <div>{parseInt(config.stretch)}ms</div>
                        </div>
                    */}
                        <div className='wave-slider'>
                            <div>fadein</div>
                            <div>
                                <input
                                    type="range" 
                                    min="0.0"
                                    max="10.0" 
                                    step="0.01"
                                    value={config.fade.in} 
                                    onChange={(e)=>this.setConfig('fade', {in:parseFloat(e.target.value)})}
                                />
                            </div>
                            <div>{parseInt((config.fade.in*100))}ms</div>
                        </div>
                        <div className='wave-slider'>
                            <div>fadeout</div>
                            <div>
                                <input
                                    type="range" 
                                    min="0.0"
                                    max="10.0" 
                                    step="0.01"
                                    value={config.fade.out} 
                                    onChange={(e)=>this.setConfig('fade',{out:parseFloat(e.target.value)})}
                                />
                            </div>
                            <div>{parseInt((config.fade.out*100))}ms</div>
                        </div>

                        <div className='wave-slider'>
                            <div>pitch</div>
                            <div>
                                <input
                                    type="range" 
                                    min={0.0}
                                    max="2.0"
                                    step="0.1"
                                    value={config.pitch} 
                                    onChange={(e)=>this.setConfig('pitch', parseFloat(e.target.value), true)}
                                    onMouseUp={(e)=>this.setConfig('pitch', parseFloat(e.target.value))}
                                />
                            </div>
                            <div>{(config.pitch-1.0).toFixed(1)}ct</div>
                        </div>
                        <div className='wave-slider'>
                            <div>rate</div>
                            <div>
                                <input
                                    type="range" 
                                    min={0.0}
                                    max="2.0"
                                    step="0.1"
                                    value={config.rate} 
                                    onChange={(e)=>this.setConfig('rate', parseFloat(e.target.value), true)}
                                    onMouseUp={(e)=>this.setConfig('rate', parseFloat(e.target.value))}
                                />
                            </div>
                            <div>{(config.rate-1.0).toFixed(1)}</div>
                        </div>
                        <div className='wave-slider'>
                            <div>delay</div>
                            <div>
                                <input
                                    type="range" 
                                    min="0.01"
                                    max="1.0" 
                                    step="0.01"
                                    value={config.delayTime}
                                    onChange={(e)=>this.setConfig('delayTime',parseFloat(e.target.value))}
                                />
                            </div>
                            <div>{(config.delayTime*1000).toFixed(0)}ms</div>
                        </div>
                        {/*
                        <div className='wave-slider'>
                            <div>mindur</div>
                            <div>
                                <input
                                    type="range" 
                                    min="100"
                                    max="2000" 
                                    step="1"
                                    value={parseInt(config.minDuration*1000)} 
                                    onChange={(e)=>this.setConfig('minDuration',parseFloat(e.target.value/1000))}
                                />
                            </div>
                            <div>{parseInt((config.minDuration*1000))}ms</div>
                        </div>
                        */}                       
                        
                    </div>
                    <div className='wave-sliders'>
                        <Select
                            value={config.drums.id} 
                            options={DRUMKITS.map((kit)=>{return {value:kit.id, label:kit.name}})}
                            center={true}
                            direction={'down'}
                            backgroundColor={'transparent'}
                            onChange={(val)=>this.onDrumkitChange(val)} 
                        />
                        {/*
                        <div className='wave-slider'>
                            <div>volume</div>
                            <div>
                                <input
                                    type="range" 
                                    min="0.01"
                                    max="1.0" 
                                    step="0.001"
                                    value={config.drumsVolume}
                                    onChange={(e)=>this.setConfig('drumsVolume', parseFloat(e.target.value))}
                                />
                            </div>
                            <div>{parseInt(config.drumsVolume*100)}%</div>
                        </div>
                        */}
                        
                        {Object.keys(config.drums.samples).map((type,idx)=>
                            <div className='wave-slider' key={idx} >
                                <div>{type}</div>
                                <div>
                                    <input
                                        type="range" 
                                        min="0.0"
                                        max="1.0" 
                                        step="0.01"
                                        value={config.drums.samples[type].state.volume}
                                        onChange={(e)=>this.setDrum(type, {volume:parseFloat(e.target.value)})}
                                    />
                                </div>
                                <div>{parseInt(config.drums.samples[type].state.volume*100)}%</div>
                            </div>
                        )}
                        <div className='wave-slider'>
                            <div>offset</div>
                            <div>
                                <input
                                    type="range" 
                                    min="0"
                                    max="300" 
                                    step="1"
                                    value={config.drumsOffset}
                                    onChange={(e)=>this.setConfig('drumsOffset', parseInt(e.target.value))}
                                />
                            </div>
                            <div>{config.drumsOffset}ms</div>
                        </div>
                        
                    </div>
                </div>
                <div id='wave-bottom'>
                    <div id='wave-drop' onClick={(e)=>this.onOpenFile(e)}>
                        {progress && uploading ? progress + '%'  : 'DROP / OPEN'} 
                        <FileUploader
                            id={'effing'} 
                            multi={false}
                            backgroundColor={'rgba(0,0,0,0.1)'}
                            label={''}
                            onUpload={(buffer, filename) => this.onUpload(buffer, filename)}
                            onUploadProgress={(progress)=>this.onUploadProgress(progress)}
                            onUploadError={(err)=>this.onUploadError(err)}
                        />
                        <form id={"upload-file-form"} ref={this.fileUploaderFormRef} style={{display: "none"}} onSubmit={(e)=>this.onUploadSampleFromFile(e)}> 
                             <input type="file" id={"upload-file"} accept={'audio/*,video/*'} ref={this.fileUploaderRef}  style={{display: "none"}}/>
                        </form>
                    </div>
                    {inputSelect}
                </div>
            </div>
        )
    }
}
export default Wave;