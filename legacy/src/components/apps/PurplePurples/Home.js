import React, { Component } from "react";
import "./Home.css";
import Select from '../../util/Select';

class Home extends Component {
    constructor(props) {
        super(props);
        this.state = {
            init: props.init,
            inputDevices: props.inputDevices,
            inputDeviceId:props.inputDeviceId,
            midiDevices: props.midiDevices,
            midiInputDeviceId:props.midiInputDeviceId,
            midiSupported:props.midiSupported,
            inputNotAllowed:props.inputNotAllowed,
            width:0,
            height:0,
            purples:false,
            intro:true
        };
        this.canvas = null;
        this.flackaoRef = React.createRef()
        this.containerRef = React.createRef()
        this.x = 0
        this.y = 0
    }
    componentDidMount() {
        this.setState({width:this.containerRef.current.clientWidth, height:this.containerRef.current.clientHeight}, ()=>{
            this.canvas = document.getElementById('flackao')
            this.intro()
        })
        window.addEventListener('resize', ()=>{
            if(this.containerRef.current)
                this.setState({width:this.containerRef.current.clientWidth, height:this.containerRef.current.clientHeight})
        })
    }
    componentWillUnmount(){
        this.cancelFlackao = true;
        this.cancelBlackao = true;
        this.cancelCrackao = true;
    }
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    intro(){
        this.flackao()
        this.setState({intro:false})
    }
    async flackao(){

        const random = (min,max)=>{
            return (Math.floor(Math.random() * (max-min)) + min)+1
        }
        const sleep = (ms)=>{
            return new Promise((resolve)=>setTimeout(()=>resolve(), ms))
        }
        const ctx = this.canvas.getContext('2d')
        
        for (var i = 0, size=0; i < 10000000; i++ ) {
            
             
            const w = this.state.width;
            const h = this.state.height;
            const rw = random(0,w/2)
            const rh = random(0,h)
            //rgb(68,0,63)
            for (var y=0; y < h; y+=(h/100), size+=1) {
                
                ctx.fillStyle = 'rgb(64, 0, ' +random(50, 63) + ')'
                let w2 = random(0,w)-100
                let x2 = this.x+random(0,w/2)//random(0,w)
                let h2 = random(20,29)

                ctx.fillRect(x2,y,w2,h2); 
                await sleep(30)
                
                ctx.clearRect(x2,y,w2,h2);
                const x3 = random(0,w)
                const y3 = random(0,h)
                ctx.fillStyle = 'rgb(68, 0, '+(random(10,30+(size/2)))+')'
                //ctx.fillRect(x3,y3,5,5); 
                await sleep(15)
                ctx.fillStyle = 'rgb(68, 0, ' + random(50,67) + ')'
                ctx.fillRect(x3,y3,random(1,3),random(0,h)); 
                await sleep(30)
                ctx.fillStyle = 'rgb(68, 5, 90)'
                ctx.fillRect(random(0,w), random(0,h), random(1,4)+(size/10), random(1,4)+(size/10));
                await sleep(60)
                if(this.cancelFlackao) return

            }   
            
            await sleep(random(100, 2000))
            //ctx.clearRect(0,0,w,h)
            console.log('looopit', 'flackao')
            if(size>100)
                size = 0;
            
        }
        console.log('DEON')
    }
    async crackao(){

        const random = (min,max)=>{
            return (Math.floor(Math.random() * max) + min)
        }
        const sleep = (ms)=>{
            return new Promise((resolve)=>setTimeout(()=>resolve(), ms))
        }
        const ctx = this.canvas.getContext('2d')
        
        for (var i = 0; i < 10000000; i++) {
            
             
            const w = this.state.width;
            const h = this.state.height;
            const rw = random(0,w/2)
            const rh = random(0,h)
            
            for (var y=0; y < h; y+=(h/100)) {
                //rgb(68,0,63)
                ctx.fillStyle = 'rgb(68, 0, ' +random(40, 60) + ')'
                let w2 = random(0,this.x)
                let x2 = random(0,w/2)
                let h2 = random(20,29)

                ctx.fillRect(x2,y,w2,h2); 
                await sleep(30)
                ctx.clearRect(x2,y,w2,h2);
                ctx.fillStyle = 'rgb(68, 0, 60)'
                ctx.fillRect(random(0,w),random(0,h),5,5); 
                await sleep(30)
                
                ctx.fillStyle = 'rgb(68, 0, 50)'
                ctx.fillRect(random(0,w),random(0,h),5,5); 
                await sleep(30)
                ctx.fillStyle = 'rgb(68, 0, 90)'
                ctx.fillRect(random(0,w),random(0,100),random(1,10),random(1,h));
                if(this.cancelCrackao) return;
            }   
            

            await sleep(random(100, 2000))
            //ctx.clearRect(0,0,w,h)
            console.log('looopit', 'crackao')
            
        }
        console.log('DEON')
    }
    
    async blakao(){

        const random = (min,max)=>{
            return (Math.floor(Math.random() * max) + min)
        }
        const sleep = (ms)=>{
            return new Promise((resolve)=>setTimeout(()=>resolve(), ms))
        }
        const ctx = this.canvas.getContext('2d')
        const w = this.state.width
        const h = this.state.height

        for (var i = 0; i < 100000; i++) {
            
            const rw = random(0,w/2)
            const rh = random(0,h)
            
            for (var y=0; y < h; y+=1) {
                //rgb(68,0,63)
                
                ctx.fillStyle = 'rgb(68, 0, 79)'
                ctx.fillRect(random(0,w),random(0,h/2),5,5); 
                await sleep(50)
                ctx.fillStyle = 'rgb(68, 0, 50)'
                ctx.fillRect(random(0,w),0,random(1,30),random(0,h));
                if(this.cancelBlakao) return;    
            }   
            
         
            await sleep(random(100, 2000))
            console.log('looopit', 'blackao')
            //ctx.clearRect(0,0,w,h)
        }
    }
    onMouseMove(e){
        
        this.x = e.pageX
        this.y = e.pageY
        
    }
    onCancelFlackao(){
        
    }
    onDeviceChange(deviceId){
        this.props.onDeviceChange(deviceId)
    }
    onStart(e){

        e.stopPropagation()

        if(!this.state.purples){
            this.cancelFlackao = true;
            setTimeout(()=>this.blakao(), 500)
            return this.purples()
        }
        //else
          //  return this.setState({purples:false})
        

        //this.onCancelFlackao()

        this.cancelFlackao = true;
        this.cancelBlakao = true
        this.setState({purplas:true, started:true})
        setTimeout(()=>this.props.onStart(),50)
    }
    purples(){
        this.setState({purples:true})
    }
    render() {
        const { intro, started, purples, purplas, init, inputDevices, inputDeviceId, midiInputDeviceId, midiDevices, midiDeviceId, inputNotAllowed, height, width, midiSupported} = this.state;
        if (init || started) return null
        
        return (
            <div id={"home"} ref={this.containerRef} onMouseMove={(e)=>this.onMouseMove(e)}>
                
                {!intro && 
                    <div id={"home-container"} >
                        <div id={"home-header"}>
                            {/*
                            <div>
                                <div className={'home-select-header'}>INPUT</div>
                                <Select 
                                    value={inputDeviceId} 
                                    options={inputDevices.map((d)=>{return {value:d.deviceId, label:d.label}})}
                                    center={true}
                                    direction={'down'}
                                    onChange={(val)=>this.onDeviceChange(val)} 
                                />
                                {inputDevices.length === 0 &&  !inputNotAllowed && <div className={"home-btn"} onClick={(e) => this.props.onRequestInput()}>CHOOSE INPUT</div>}
                                {inputNotAllowed && <div className='home-not-supported'>Input denied</div>}
                            </div>
                            
                            <div>
                                <div className={'home-select-header'}>MIDI</div>
                                <Select 
                                    center={true}
                                    direction={'down'}
                                    value={midiDeviceId} 
                                    options={midiDevices.map((d)=>{return {value:d.deviceId, label:d.name}})}
                                    onChange={(val)=>this.props.onMidiDeviceChange(val)} 
                                />
                                {midiDevices.length === 0 &&
                                    <Select 
                                        center={true}
                                        direction={'down'}
                                        value={0} 
                                        options={[{value:0, label: !midiSupported ? 'Not supported' : 'Not connected'}, {value:1, label: 'Use Chrome Browser'}]}
                                    />
                                }

                            </div>
                            */}
                        </div>
                        <div className={purples ?  'purples' : 'purple'} onClick={(e) => this.onStart(e, purples)}>{purples ? 'PURPLES' : 'PURPLE'}</div>
                    </div>
                }
                <canvas id={'flackao'} ref={this.flackaoRef} width={width} height={height}/>
            </div>
        );
    }
}
export default Home;
