import WAAClock from 'waaclock'
import {EventEmitter} from 'events'
 
const defaultOptions = {
    loop:true,
    signature:4,
    bpm:120,
    byDuration:false,
    jumpDisabled:false
}
class Sequencer extends EventEmitter{
    constructor(context, opt = {}){
        super()
        this.context = context;
        this.options = {...defaultOptions, ...opt};
        this.clock = new WAAClock(this.context)
        this.sequence = []
        this.signature = this.options.signature
        this.bpm = this.options.bpm
        this._events = []
        this._current = 0;
        this._stopped = true;
        this._paused = false;
        this._onPlay = this._onPlay.bind(this)
    }
    start(sequence = this.sequence, opt = {}){
        this.options = {...this.options, ...opt};
        this.stop()
        //this.log('START SEQUENCE (' + this.sequence.length + ')', 'byDuration=', this.options.byDuration, 'loop=', this.options.loop, 'startAt=', this.options.startAt )
        if(this.options.jumpDisabled)
            sequence = sequence.filter((seq)=>!seq.disabled)
        this.sequence = [...sequence];
        this._stopped = false;
        this._paused = false
        this._current = 0;
        this.clock.start()
        const ct = this.context.currentTime;
        let offset = 0;
        this.sequence.forEach((event, idx)=>{
            const evt = this.clock.callbackAtTime(this._onPlay, ct+offset)
            offset += this.beatDuration(event)
            if(this.options.loop){
                const barDuration  =this.barDuration()
                evt.repeat(barDuration)
            }
            this._events.push(evt)
            console.log(offset)
        })
        
    }
    _onPlay(event){
        if(this._stopped) return console.log('was stoped onPlay');
        this.log(this._current)
        this.emit('play', this._current, this.sequence[this._current].loopIndex)
        if(this._current === this.sequence.length-1){
            this._current = 0
            this.log('ENDED SEQUENCE')
            return this.emit('end')
            //if(!this.options.loop)this.stop()
        }
        this._current++;
    }
    add(event){
        this.sequence.push(event)
        this.once('end', ()=>{
            this._current = this.sequence.length-1
            this.once('end', ()=>{
                const evt = this.clock.callbackAtTime(()=>{
                    this.start(this.sequence)
                },this.context.currentTime + this.beatDuration(event, this.options))
                this.clear()
                this.log('ADD EVENT', this.context.currentTime + this.barDuration(event))
            })
            this._onPlay(event)

        })
    }
    update(sequence, opt = {}, cb = ()=>{}){
        this.options = {...this.options, ...opt}
        if(!this._stopped){
            this.once('end', ()=>{
                this.clock.callbackAtTime(()=>{
                    this.start(sequence, opt)
                    if(cb) cb()
                },this.context.currentTime + this.beatDuration(this.sequence[this.sequence.length-1]))
                this.clear()
            })
        }else
            this.sequence = sequence;
    }
    stop(){
        //if(!this._stopped) return this.log('NOT STARTED');
        
        this._stopped = true
        this._paused = false
        this.clear()
        this.clock.stop()
        this._events = []
        this.emit('stop')
        this.log('STOP SEQUENCE')
    }
    clear(){
        this._events.forEach((evt)=>evt.clear())
        this._events = []
        this.log('CLEAR');
    }
    pause(){
        this.stop()
        this._current = this._current>0 ? this._current-1 : this.sequence.length-1;
        this._paused = true
        this.log('paused at', this._current)
    }
    unpause(){
        if(!this._paused) return
        this.log('unpause from', this._current)
        this.start()
    }
    tempo(bpm){
        if(bpm < 1 || bpm > 300) return console.error('bmp out of range')

        const ratio = this.bpm/bpm;
        this.bpm = bpm;
        if(this._events.length)
            this.clock.timeStretch(this.context.currentTime, this._events, ratio)
    }
    beatDuration(event){
        if(this.options.byDuration) 
            return this.beatDurationByTime(event);
        else
            return (60/this.bpm)
    }
    barDuration(){
        if(this.options.byDuration) 
            return this.barDurationByTime()
        else
            return this.options.signature*this.beatDuration()*(this.sequence.length/this.options.signature)
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
        this.sequence.forEach((event)=>{
            duration += this.beatDurationByTime(event)
        })
        return duration;
    }
    log(){
        console.log('sequencer', Array.prototype.slice.call(arguments).join(' '))
    }

}
export default Sequencer