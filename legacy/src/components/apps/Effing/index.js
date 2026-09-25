import Global from '../../../Global'
import React from 'react';
import PurpleApp from '../'
import Switch from 'react-switch';
import FrequencyVisualizer from '../../visualizers/FrequencyVisualizer';
import VolumeVisualizer from '../../visualizers/VolumeVisualizer';
import OscilloscopeVisualizer from '../../visualizers/OscilloscopeVisualizer';
import FileUploader from '../../util/FileUploader';
import Waveform from '../../util/Waveform';
import Select from '../../util/Select';
import Chain from './Chain'
import WAAClock from 'waaclock'
import './index.css'

const PATTERNS = ['Up', 'Down', 'UpDown', 'DownUp', 'Random']
const TYPES = ['sequence', 'loops']
const defaultConfig = {bpm:120, note:1, sig:1, pattern:PATTERNS[0], type:TYPES[0]}

class Effing extends PurpleApp {
    constructor(props) {
        super(props);
        this.state = {
            ...this.state,
            effects:[],
            chain:[],
            settingsIdx:null,
            sampling:false,
            loop:true,
            click:false,
            loopStart:167.8082612244898,
            loopEnd:194.40082721088436,
            config:localStorage.getItem('effing-config') ? JSON.parse(localStorage.getItem('effing-config')) : defaultConfig,
            selections:[],
            playing:false,
        }
        this.engineOptions = {
            sampleRate: 44100,
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
        this.appId = this.soundId
        this.soundId = 'effing'
        this.soundIdCopy = 'effingcopy'
        this.inputSelect = null
        this.recordings = []
        this.selections = []
        this.stopped = false;
        
    }
    componentWillUnmount() {
        if(this.clock) this.clock.stop()
        this.props.onQuit('effing')
    }
    initDone(){
        console.log('INIT DONE effing!!!')
        
        this.setState({init:false})
        Global.engine.once('load', (id)=>{
            console.log('loaded', id)
            const duration = Global.engine.duration(this.soundId)
            const effects = Global.engine.EFFECTS.map((effect, idx)=>{
                return {id:effect.id, name:effect.name, idx, defaults:effect.defaults, params:{...effect.defaults}, enabled:false}
            })
            
            this.setState({init:true, duration, effects})
            Global.engine.add(this.soundIdCopy, '/test/The Egyptians - Thanks To You.mp3', 'The Egyptians - Thanks To You.mp4', null)
            Global.engine.load(this.soundIdCopy)

        })
        Global.engine.add(this.soundId, '/test/The Egyptians - Thanks To You.mp3', 'The Egyptians - Thanks To You.mp4', null)
        Global.engine.load()
        Global.engine.on('sampling', (id, on)=>{
            //this.setState({sampling:on})
        })
        
        Global.engine.on('state'+this.soundId, (state, updated)=>{
            //console.log(updated)
            //if(updated.playing !== undefined)this.setState({playing:updated.playing})
        })
        

    }
    onUpload(buffer, filename){
        this.clearSelections()
        const objURL = URL.createObjectURL(new Blob([buffer], {type: Global.fileToMimeType(filename)}));
        Global.engine.replace(this.soundId, objURL, filename);

    }

    addPlaySelection(sel){
        
        const selections = this.state.selections;
        
        if(this.state.type === 'loops' && (!sel.start && !sel.start)) return;

        selections.push({...sel, idx:selections.length, on:true})
        this.updateSelections(selections)
    }
    enableSelection(idx, on){
        const selections = this.state.selections;
        selections[idx].on = on;
        this.updateSelections(selections)
    }
    updateSelections(selections){
        this.setState({selections:[...selections]}, ()=>{
            //if(this.state.playing) this.restart()
        })
    }
    
    async play(type = this.state.config.type){
        const selections = this.state.selections;
        console.log('PLAY', type)
        if(!selections.length) 
            return console.error('no selections')

        this.setState({playing:true})
        for(let i = 0; !this.stopped ;i++){
            const seq = this.generateSequence(selections);
            if(type === 'loops')
                await this.playLoops(seq)
            else
              await this.playSequence(seq)
        }
        
        this.stopped = false;
        //this.setState({playing:false})
        console.log('done')
    }
    playSequence(sequence){
        return new Promise((resolve)=>{
            const duration = this.tempoToDuration();
            console.log(duration)
            const length = sequence.length;
            
            const ct = Global.engine.context.currentTime;
            const stop = ()=>{ this.clock.stop(); resolve()}
            this.clock = new WAAClock(Global.engine.context)
            this.clock.start()
            this.clock.callbackAtTime(()=>stop(), ct+(length*duration)/1000);
            sequence.forEach((seq, i)=>{
                this.clock.callbackAtTime(()=>{
                    if(this.stopped) return stop()
                    this.playSelection(seq, duration/1000)
                }, ct+((i*duration)/1000));
            })
        })
    }
    async playLoops(sequence){

        console.log('play loops', sequence.length)
        for (var i = 0; i < sequence.length; i++)
            await this.playSelection(sequence[i])
        return Promise.resolve()
    }
    playSelection(sel, dur){
        const duration = dur ? dur : sel.end-sel.start;
        const start = dur ? sel.time : sel.start;
        console.log('duration', duration)
        return new Promise((res,rej)=>{
            if(sel.on) {
                Global.engine.once('ended', ()=>res())
                Global.engine.play(this.soundId, {start,duration})    
            } else
                setTimeout(()=>res(), duration)

            const state = {click:true, sequenceId:sel.idx}
            const loop = {loopStart:sel.time, loopEnd:sel.time+(duration/1000)}
            //console.log(state)
            this.setState(state); 
            setTimeout(()=>this.setState({click:false, sequenceId:null}),50)
        })
    }
    stop(){
        console.log('STOP')
        return new Promise((resolve)=>{
            if(this.state.playing) 
                this.stopped = true
            this.setState({playing:false}, ()=>{
                Global.engine.stop(this.soundId)
                resolve()
            })    
        })
    }
    restart(){
        console.log('RESTART')
        this.stop().then(()=>this.play())
    }
    
    generateSequence(loops){
        const pattern = this.state.config.pattern;
        let selections = [...loops];
        if(pattern === 'Up')
            selections = [...selections]
        else if(pattern === 'Down')
            selections = [...selections.reverse()]
        else if(pattern === 'UpDown')
            selections = [...selections, ...selections.slice(1,selections.length-1).reverse()]
        else if(pattern === 'DownUp')
            selections = [...selections.slice(0).reverse(), ...selections.slice(1,selections.length-1)] 
        else if(pattern === 'Random')
            selections = [...selections.sort((a,b)=>0.5 - Math.random())]

        return selections
    }
    
    
    playSequenceSound(idx){
        const sel = this.state.selections[idx]
        Global.engine.once('ended', ()=>this.setState({sequenceId:null}))
        Global.engine.play(this.soundIdCopy, {start:sel.time, duration:this.tempoToDuration()/1000})
        this.setState({sequenceId:idx})

    }
    clearSelections(){
        this.stop()
        this.selections = []
        this.setState({selections:[]})
    }
    tempoToDuration(){
        return 60000/this.state.config.bpm/this.state.config.note
    }
    setConfig(conf = {}){
        console.log('config', conf)
        const config = {...this.state.config, ...conf}

        this.setState({config}, ()=>{
            if((conf.pattern || conf.type) && this.state.playing)
                this.restart()
            localStorage.setItem('effing-config', JSON.stringify(config))
        })
    }

    handleSelection(sel){
        this.addPlaySelection(sel)
        return
        if(sel.start === 0 && sel.end === 0){
            Global.engine.loop(this.soundId, false)
            Global.engine.stop(this.soundId)
        }else{
            
            Global.engine.loop(this.soundId, true, sel)
            Global.engine.play(this.soundId)
        }
    }
    handleSelections(sel){
        if(sel.start === 0 && sel.end === 0)
            return
        this.selections.push(sel)
    }
    handleSelectionStart(){
        //Global.engine.stop(this.soundId)
    }
    handleSelectionChange(sel){

    }
    showSettings(id, idx){
        this.setState({settingsIdx:idx})
    }
    
    bypassEffect(id, idx, bypass){
        console.log('toggleBypass', id, idx)
        Global.engine.effectBypass(this.soundId, idx, bypass)
        this.update()
    }
    addEffect(id, idx){
        const effect = Global.engine.addEffect(this.soundId, id, true)
        this.update()
        setTimeout(()=>this.showSettings(id, effect.idx), 10)
    }
    removeEffect(id, idx){
        Global.engine.removeEffect(this.soundId, idx)
        this.update()
        let settingsIdx = this.state.settingsIdx
        if(settingsIdx !== null)
            settingsIdx = settingsIdx > idx ? settingsIdx-1 : settingsIdx;
        this.setState({settingsIdx})
    }
    moveEffect(id, idx, fromIdx, toIdx){
        Global.engine.moveEffect(this.soundId, idx, toIdx)
        this.update()
    }
    effectParam(id, idx, key, val){
        
        let effect = this.get(id, idx)
        if(!effect) return console.log('not there', id, idx, this.state.chain)
        const param = {}
        const type = effect.defaults[key].type
        param[key] =  type === 'float' ? parseFloat(val) : type === 'integer' ? parseInt(val) : type === 'boolean' ? (val > 0) : val;
        Global.engine.effectParams(this.soundId, effect.idx, param)
        this.update()
    }
    get(id, idx){
        return this.state.chain.filter((eff)=>eff.id === id && eff.idx === idx)[0]
    }
    update(cb = ()=>{}){
        const chain = Global.engine.effectParams(this.soundId)
        this.setState({chain},cb)
    }

    blockDrop(e){
        e.preventDefault()
        e.stopPropagation()
    }
    sample(start){
        this.clearSelections()

        if(start){
            if(this.state.sampling) return
            this.setState({sampling:true})
            Global.engine.sample(this.soundId, true).then((recording)=>{
                this.recordings.push(recording)
            }).catch((err)=>{

            })
            Global.engine.once('load', ()=>{
                this.setState({sampling:false, duration:Global.engine.duration(this.soundId)})
            })
        }else{
            if(!this.state.sampling) return
            Global.engine.sample(this.soundId, false);
        }
    }
    render() {
        const {
            init, 
            effects, 
            selectedEffect, 
            effectId, 
            chain, 
            settingsIdx, 
            sampling, 
            duration, 
            playing,
            config, 
            click, 
            sequenceId,
            loopStart,
            loopEnd,
            type,
            selections,
        } = this.state
        if(!init) return <div id={'effing-loading'}>loading</div>

        const inputSelect = this.inputDeviceSelect('down', true)
        
        return (
            <div id='effing-container'>
                <div id='effing-top'>
                    <div id='effing-controls'>
                        <div className={playing ? 'effing-button-stop' : 'effing-button-play'} onClick={()=> playing ? this.stop() : this.play(type)}>
                            {playing ? 'STOP' : 'PLAY' + (selections.length ? ' ' + selections.length : '')}
                        </div>
                        <div className={sampling ? 'effing-button-stop' : 'effing-button-rec'} onClick={()=>this.sample(!sampling)} >
                            {sampling ? 'STOP' : 'REC'}
                        </div>
                        <div className={'effing-button-stop'} onClick={()=>this.clearSelections()} >
                            CLEAR
                        </div>
                    </div>
                    <div id='effing-tempo'>
                        <input
                            type="range" 
                            min="1"
                            max="300" 
                            step="1"
                            value={config.bpm}
                            reverse={'true'}
                            onChange={(e)=>this.setConfig({bpm:parseInt(e.target.value)})}
                        />
                        <Select 
                            value={config.pattern} 
                            options={PATTERNS.map((name)=>{return {value:name, label:name}})}
                            center={true}
                            direction={'down'}
                            onChange={(val)=>this.setConfig({pattern:val})} 
                        />
                        <Select 
                            value={config.type} 
                            options={TYPES.map((name)=>{return {value:name, label:name}})}
                            center={true}
                            direction={'down'}
                            onChange={(val)=>this.setConfig({type:val})} 
                        />
                        {/*<div id={'effing-click'} style={{backgroundColor:click ? 'pink': 'transparent'}}></div>*/}
                    </div>
                    <div id='effing-sequencer'>                    
                        {selections.map((sel, idx)=>
                            <div className={'effing-sequencer-pad-wrap'} key={idx} >
                                <div onClick={()=>this.playSequenceSound(idx, type)} className={sequenceId === idx ? 'effing-sequencer-pad-playing' : 'effing-sequencer-pad'}></div>
                                <div onClick={()=>this.enableSelection(idx, !sel.on, type)} className={sel.on ? 'effing-sequencer-pad-switch-on' : 'effing-sequencer-pad-switch-off'}></div>
                            </div>
                        )}
                    </div>

                </div>
                <div id='effing-waveform'>
                    {sampling ?  
                        <OscilloscopeVisualizer id={'input'} color={'rgb(255, 0, 0)'} ready={init} options={{fftSize:1024}}/>
                    :
                        <Waveform 
                            id={this.soundId}
                            key={'effingk'}
                            bits={8}
                            color={'rgb(136, 230, 230)'} 
                            bgcolor={'rgba(0,0,0,0.1)'}
                            markerColor={'rgba(255, 255, 255,0.8)'} 
                            enableElapsed={true}
                            duration={duration}
                            loopStart={loopStart}
                            loopEnd={loopEnd}
                            onSelection={(selection)=>this.handleSelection(selection)}
                            onSelectionStart={()=>this.handleSelectionStart()}
                        />
                    }
                </div>
                <div id='effing-effects'>
                    <Chain 
                        effects={effects}
                        items={chain}
                        settingsIdx={settingsIdx}
                        onBypass={(id, idx, bypass)=>this.bypassEffect(id, idx, bypass)} 
                        onAdd={(id)=>this.addEffect(id)}
                        onRemove={(id, idx)=>this.removeEffect(id, idx)}
                        onMove={(id, idx, fromIdx, toIdx)=>this.moveEffect(id, idx, fromIdx, toIdx)}
                        onSettings={(id, idx)=>this.showSettings(id, idx)}
                        //onSettings={(id, idx)=>this.showSettings(id,idx)}
                        onEffectParam={(id, idx, param, val)=>this.effectParam(id, idx, param, val)}
                        />
                </div>
                <div id='effing-bottom'>
                    {inputSelect}
                    <div id='effing-drop'>
                        DROP FILE
                        <FileUploader
                            id={'effing'} 
                            multi={false}
                            backgroundColor={'rgba(0,0,0,0.1)'}
                            label={''}
                            onUpload={(buffer, filename) => this.onUpload(buffer, filename)}
                        />
                    </div>
                </div>
            </div>
        )
    }
}
export default Effing;