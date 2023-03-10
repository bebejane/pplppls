//console.log = ()=>{}
import Global from '../Global'
import React, { Component } from "react";
import PurplePurples from './apps/PurplePurples';
import PitchShifter from './apps/PitchShifter';
import MultiMixer from './apps/MultiMixer';
import InputTest from './apps/InputTest';
import Spyders from './apps/Spyders';
import Smokey from './apps/Smokey';
import Bloody from './apps/Bloody';
import Test from './apps/Test';
import Effing from './apps/Effing';
import Wave from './apps/Wave';
import Wave2 from './apps/Wave2';
import './App.css';
const IS_DEV = !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
const DEFAULT_APP = IS_DEV ? localStorage.getItem('lastApp') : 'purplepurples'

class App extends Component{

    constructor(opt){
        super(opt)
        this.state = {
            app:DEFAULT_APP,
            quitting:false
        }
        document.body.addEventListener('keydown', (e)=>{
            const key = e.key;
            if(e.target.tagName === 'INPUT') return
            if(key == 'q')
               this.onQuit(this.state.app)
        })
    }
    onQuit(app){
        
        setTimeout(()=>{
            if(Global.engine)
                Global.engine.destroy(true);
            this.setState({quitting:false});
        }, 500)

        this.setState({quitting:true, app:null})
        localStorage.removeItem('lastApp')
    }
    runApp(id){
        localStorage.setItem('lastApp', id)
        this.setState({app:id})
    }
    render(){
        const {app, quitting} = this.state;

        return (
            <div className="App">
                {app === 'purplepurples'  && <PurplePurples onQuit={()=>this.onQuit('purplepurples')}/> }
                {app === 'multimixer'  && <MultiMixer numChannels={2} onQuit={()=>this.onQuit('multimixer')}/> }
                {app === 'inputtest'  && <InputTest onQuit={()=>this.onQuit('inputtest')}/> }
                {app === 'pitchshifter'  && <PitchShifter onQuit={()=>this.onQuit('pitchshifter')}/> }
                {app === 'spyders'  && <Spyders onQuit={()=>this.onQuit('spyders')}/> }
                {app === 'smokey'  && <Smokey onQuit={()=>this.onQuit('smokey')}/> }
                {app === 'bloody'  && <Bloody onQuit={()=>this.onQuit('bloody')}/> }
                {app === 'effing'  && <Effing onQuit={()=>this.onQuit('effing')}/> }
                {app === 'wave'  && <Wave onQuit={()=>this.onQuit('wave')}/> }
                {app === 'wave2'  && <Wave2 onQuit={()=>this.onQuit('wave2')}/> }
                {app === 'test'  && <Test onQuit={()=>this.onQuit('test')}/> }
                {!app && !quitting &&
                    <div id='splash'>
                        <div key={'purpl'} onClick={()=>this.runApp('purplepurples')}>purplepurples</div>
                        <div key={'spyders'} onClick={()=>this.runApp('spyders')}>spyders</div>
                        <div key={'smokey'} onClick={()=>this.runApp('smokey')}>smokey</div>
                        <div key={'shifter'} onClick={()=>this.runApp('pitchshifter')}>shifters</div>
                        <div key={'inputt'} onClick={()=>this.runApp('inputtest')}>1 2 3 4 5 check</div>
                        <div key={'multi'} onClick={()=>this.runApp('multimixer')}>unresolved</div>
                        <div key={'effi'} onClick={()=>this.runApp('effing')}>effigs</div>
                        <div key={'wavy'} onClick={()=>this.runApp('wave')}>waving</div>
                        <div key={'wavy2'} onClick={()=>this.runApp('wave2')}>wavey2</div>
                        {/*<div key={'bloody'} onClick={()=>this.runApp('bloody')}>bloody</div>*/}
                        <div key={'test'} onClick={()=>this.runApp('test')}>test</div>
                    </div>
                }
                {quitting &&
                    <div id='splash'>
                        Quitting...
                    </div>   
                }
            </div>
        );
    }
}

export default App;
