import WAAClock from 'waaclock'
import {EventEmitter} from 'events'

class Sequencer extends EventEmitter{
    constructor(context, engine, opt){
        super()
        this.context = context;
        this.engine = engine;
        this.sequence = opt.sequence || []    
        this.signature = opt.signature || 4;
        this.bpm = opt.bpm || 120;
        this.loop = opt.loop || false;
        this.byDuration = opt.byDuration || false;
        this.jumpDisabled = opt.jumpDisabled || false;
        this.clock = new WAAClock(this.context)
        this._current = 0;
        this._playing = false;
        this._stopped = true;
        this._paused = false;
        this._pausedAt = -1;
        this._startAt = 0;
        this._isUpdating = false;
        this._beats = []
        this._sequence = []
        this._DEBUG = true
        this._onPlay = this._onPlay.bind(this)
    }
    start(sequence = this.sequence, loop = this.loop, byDuration = this.byDuration, startAt = 0){
        if(this._paused || sequence.length === 0) return
        this._playing = true;
        this._current = startAt;
        this._startAt = startAt;
        this._beats = []
        this.loop = loop;
        this.byDuration = byDuration;
        //if(this.jumpDisabled) sequence = sequence.filter((seq)=>!seq.disabled)
        this.sequence = [...sequence]
        this.clock.stop()
        this.clock.start()
        const ct = this.context.currentTime;
        let offset = 0;
        this.sequence.slice(startAt).concat(this.sequence.slice(0,startAt)).forEach((event, idx)=>{
            const evt = this.clock.callbackAtTime(this._onPlay, ct+offset)
            offset += this.beatDuration(event)
            if(loop){
                const barDuration = this.barDuration()
                evt.repeat(barDuration)
            }
            this._beats.push(evt)
        })
        this.emit('start')
        this.log('START SEQUENCE (' + this.sequence.length + ')', 'byDuration=', byDuration, 'loop=', loop, 'startAt=', startAt )
    }
    _onPlay(){
        if(!this._playing || !this.sequence[this._current]) return;
        this.log(this._current)
        this.emit('play', this._current, this.sequence[this._current].loopIndex)
        if(this._current === this.sequence.length-1){
            this._current = 0
            this.log('ENDED SEQUENCE')
            this.emit('end')
            if(!this.loop)
                this.stop()
            return 
        }
        this._current++;
    }
    add(event, cb = ()=>{}){
        if(this.isUpdating()) return cb('UPDATING')
        this._updating(true)
        this.sequence.push(event)
        this.once('end', ()=>{
            this._current = this.sequence.length-1
            this.once('end', ()=>{
                const evt = this.clock.callbackAtTime(()=>{
                    this.start(this.sequence, this.loop, this.byDuration)
                    this._updating(false)
                },this.context.currentTime + this.beatDuration(event))
                this.clear()
                this._beats.push(evt)
                this.log('ADD EVENT', this.context.currentTime + this.barDuration(event))
            })
            this._onPlay(event)
        })
        
    }
    remove(loopIndex, cb = ()=>{}){
        if(this.isUpdating()) return cb('UPDATING')

        if(loopIndex < 0 || loopIndex > this.sequence.length-1)
            throw new Error('Index out of bounds')

        const sequence = this.sequence.filter((seq)=>seq.loopIndex !== loopIndex)
        if(sequence.length === 0)
            return this.stop()

        this.update(sequence, this.loop, this.byDuration,()=>{            
            if(this._paused && this._pausedAt >= loopIndex){
                this.log('paused at', this._pausedAt)
                this._pausedAt = this._pausedAt-1 >-1 ? this._pausedAt-1 : 0;
                this.log('paused at new', this._pausedAt)
            }
            cb()
        })
    }
    update(sequence, loop, byDuration, cb = ()=>{}){
        if(this.isUpdating()) return cb('UPDATING')

        if(this.isPlaying()){
            this.once('end', ()=>{
                this.clear()
                const evt = this.clock.callbackAtTime(()=>{
                    this.start(sequence, loop, byDuration, 0)
                    this._updating(false)
                    cb()
                }, this.context.currentTime + this.beatDuration(this.sequence[this.sequence.length-1]))
                this._beats.push(evt)
            })
            this.emit('updating',true)
        }else{
            this.sequence = sequence;
            this.loop = loop;
            this.byDuration = byDuration;
            this._updating(false)
            cb()
        }
    }
    _update(){

    }
    _updating(on){
        this._isUpdating = on
        this.emit('updating', this._isUpdating)
    }
    stop(){
        if(!this._playing) return
        this.clock.stop()
        this._playing = false
        this._paused = false
        this._pausedAt = -1
        this._beats = []
        this._updating(false)
        this.emit('stop')
        this.emit('paused',false)
        
        this.log('STOP SEQUENCE')
    }
    clear(){
        this._beats.forEach((evt)=>evt.clear())
        this._beats = []
    }
    pause(){
        if(this._paused || !this._playing) return
        this.clear()
        this._pausedAt = this._current === 0 ? this.sequence.length-1 : this._current-1;
        this._paused = true
        this.emit('paused',true)
        this.log('paused at', this._pausedAt, this._current)
    }
    unpause(){
        if(!this._paused) return
        this.log('unpause from', this._pausedAt)
        this._paused = false 
        this.start(this.sequence, this.loop, this.byDuration, this._pausedAt)
        this.emit('paused',false)
    }
    isPaused(){
        return this._paused;
    }
    isPlaying(){
        return this._playing && !this._paused;
    }
    isUpdating(){
        return this._isUpdating;
    }
    browse(ffw){
        if(this.sequence.length === 0) return
        this.pause()
        if(ffw)
            this._pausedAt = this._pausedAt < this.sequence.length-1 ? this._pausedAt+1 : this.sequence.length-1
        else
            this._pausedAt = this._pausedAt > 0 ? this._pausedAt-1 : 0
        this._current = this._pausedAt;
        //this.emit('play', this._current, this.sequence[this._current].loopIndex)
        this.emit('browse', this._current, this.sequence[this._current].loopIndex)
    }
    tempo(bpm){
        if(bpm < 1 || bpm > 300) return console.error('bmp out of range')
       
        const ratio = this.bpm/bpm;
        this.bpm = bpm;
        if(this._beats.length)
            this.clock.timeStretch(this.context.currentTime, this._beats, ratio)
    }
    beatDuration(event){
        if(this.byDuration) 
            return this.beatDurationByTime(event);
        else
            return (60/this.bpm)
    }
    barDuration(){
        if(this.byDuration) 
            return this.barDurationByTime()
        else
            return this.signature*this.beatDuration()*(this.sequence.length/this.signature)
    }
    beatDurationByTime(event){
        if(event.duration) return event.duration
        let duration = 0;
        event.sounds.forEach((item)=>{
            if(item.opt.duration > duration)
                duration = item.opt.duration;
        })
        return duration;
    }
    barDurationByTime(){
        let duration = 0;
        this.sequence.forEach((event)=>duration += this.beatDurationByTime(event))
        return duration;
    }
    log(){
        if(this._DEBUG)
            console.log('sequencer', Array.prototype.slice.call(arguments).join(' '))
    }
    disableLog(on){
        this._DEBUG = !on;
    }
}
export default Sequencer