import WAAClock from 'waaclock'
import {EventEmitter} from 'events'

class Sequencer2 extends EventEmitter{
    constructor(context, opt){
        super()
        this.context = context;
        this.sequence = opt.sequence || []
        this.clock = new WAAClock(this.context)

        this._bpm = opt.bpm || 120;
        this._note = opt.note || 4;
        this._division = opt.division || 1;
        this._loop = opt.loop || false;
        this._current = 0;
        this._playing = false;
        this._stopped = true;
        this._paused = false;
        this._pausedAt = -1;
        this._startAt = 0;
        this._beats = []
        this._sequence = []
        this._DEBUG = false//true
        this._onPlay = this._onPlay.bind(this)
    }
    start(sequence = this.sequence, startAt = 0, opt = {}){
        if(this._paused || sequence.length === 0) 
            return 
        this._playing = true;
        this._current = startAt;
        this._startAt = startAt;
        this._beats = []
        this._loop = opt.loop === undefined ? this._loop : opt.loop;
        this._note = opt.note === undefined ? this._note : opt.note;
        this._division = opt.division === undefined ? this._division : opt.division;
        this.sequence = [...sequence]
        
        this.clock.stop()
        this.clock.start()
        const ct = this.context.currentTime;
        let offset = 0;
        this.sequence.slice(startAt).concat(this.sequence.slice(0,startAt)).forEach((event, idx)=>{
            const evt = this.clock.callbackAtTime(this._onPlay, ct+offset)
            offset += this.beatDuration(event)
            if(this._loop)
                evt.repeat( this.barDuration())
            this._beats.push(evt)
        })

        this.emit('start')
        this.log('START SEQUENCE (' + this.sequence.length + ')', 'loop=', opt.loop, 'startAt=', startAt )
    }
    _onPlay(){
        if(!this._playing || !this.sequence[this._current]) return;
        this.log(this._current)
        this.emit('play', this.sequence[this._current].id, this._current)
        if(this._current === this.sequence.length-1){
            this._current = 0
            this.log('ENDED SEQUENCE')
            this.emit('end')
            if(!this._loop)
                this.stop()
            return 
        }
        this._current++;
    }
    add(event){
        this.sequence.push(event)
        this.once('end', ()=>{
            this._current = this.sequence.length-1
            this.once('end', ()=>{
                const evt = this.clock.callbackAtTime(()=>{
                    this.start(this.sequence, 0)
                    this.emit('updating',false)
                },this.context.currentTime + this.beatDuration(event))
                this.clear()
                this._beats.push(evt)
                this.log('ADD EVENT', this.context.currentTime + this.barDuration(event))
            })
            this._onPlay(event)
        })
        this.emit('updating',true)
    }
    remove(index){

    }
    update(sequence, opt, cb = ()=>{}){
        cb = typeof opt === 'function' ? opt : cb;
        if(this._playing){
            this.once('end', ()=>{
                this.clear()
                const evt = this.clock.callbackAtTime(()=>{
                    this.start(sequence, 0, opt)
                    this.emit('updating',false)
                    cb()
                }, this.context.currentTime + this.beatDuration(this.sequence[this.sequence.length-1]))
                this._beats.push(evt)
            })
            this.emit('updating',true)
        }else{
            this.sequence = sequence;
            cb()
        }
    }
    stop(){
        if(!this._playing) return
        this.clock.stop()
        this._playing = false
        this._paused = false
        this._pausedAt = -1
        this._current = 0;
        this._beats = []
        this.emit('updating',false)
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
        this.start(this.sequence, this._pausedAt)
        this.emit('paused',false)
    }
    isPaused(){
        return this._paused;
    }
    isPlaying(){
        return this._playing && !this._paused;
    }
    browse(ffw){
        if(this.sequence.length === 0) return
        this.pause()
        if(ffw)
            this._pausedAt = this._pausedAt < this.sequence.length-1 ? this._pausedAt+1 : this.sequence.length-1
        else
            this._pausedAt = this._pausedAt > 0 ? this._pausedAt-1 : 0
        this._current = this._pausedAt;
        console.log(this._current)
        this.emit('browse', this.sequence[this._current].id, this._current)
    }
    tempo(bpm){
        if(bpm < 1 || bpm > 300) return console.error('bmp out of range')
        
        const ratio = this._bpm/bpm;
        this._bpm = bpm;
        if(this._beats.length)
            this.clock.timeStretch(this.context.currentTime, this._beats, ratio)
    }
    note(note){
        this.update(this.sequence,{note:note})
    }
    loop(on){
        this.update(this.sequence,{loop:on})
    }
    beatDuration(event){
        return (60/this._bpm)/(this._note/4)
    }
    barDuration(){
       return this._note*this.beatDuration()*(this.sequence.length/this._note)
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
export default Sequencer2