
import React, { Component } from "react";
import "./Effects.css";
import Slider from 'react-input-slider';
import Switch from 'react-switch';
import {FiDelete} from 'react-icons/fi'

class Effects extends Component {
    constructor(props){
        super(props)
        this.state = {
        	id:props.id,
            show:props.show,
            effects:props.effects
        }

        this.ref = React.createRef()

    }
    componentDidMount(){
        setTimeout(()=>this.setState({open:true}), 2000)
    }
    onChangeMidiDevice(id){

    }
    onChangeInputDevice(id){

    }
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    onClose(){
        this.props.onClose()
    }
    onChangeParam(idx, param, val){
        
    	const effect = this.state.effects[idx];
    	const params = {}
    	params[param] = typeof effect.defaults[param].max === 'boolean' ? val <= 0.5 ? false : true : val
    	global.engine.effectParams(this.state.id, idx, params)
    }
    onBypass(idx, bypass){
        global.engine.effectBypass(this.state.id, idx, !bypass)
    }
    onAddEffect(type){
        global.engine.addEffect(this.state.id, type, {}, true)
    }
    onRemoveEffect(idx){
        global.engine.removeEffect(this.state.id, idx)
    }
    render(){
        const {
        	id,
            show,
            effects
        } = this.state
        
        const available = global.engine.effects;

        if(!show) return null
        console.log(effects)
        return(
             <div id={id+'effect'} className={'mixer-channel-effects'}>
                <div className={'mixer-channel-effects-left'}>
                    <div className={'mixer-channel-effects-close'} onClick={()=>this.onClose()}>X</div>
                 	{effects.map((effect, eidx)=>
    	                <div key={eidx } className={'mixer-channel-effect'}>
    	                    <div className={'mixer-channel-effect-name'}>{effect.type.substring(0,10)}</div>
    	                    <div className={'mixer-channel-effect-params'}>
    	                    	{Object.keys(effect.params).map((k, idx)=>
    	                    		<React.Fragment key={idx}>
                                        <div className={'mixer-channel-effect-param-top'}>
                                            <div className={'mixer-channel-effect-param-name'}>
                                                {k}
                                            </div>
            		                    	<div className={'mixer-channel-effect-param-value'}>
            		                    		{effect.params[k] && effect.params[k].toFixed ? effect.params[k].toFixed(2) : effect.params[k]}
            		                    	</div>
                                        </div>
        								<div className={'mixer-channel-effect-param-slider'}>
        			                    	<Slider
        			                            id={effect.type+k}
        			                            key={effect.type+k+idx} 
        			                            axis={'x'}
        			                            xmax={typeof effect.defaults[k].max === 'boolean' ? 1 : effect.defaults[k].max}
        			                            xmin={typeof effect.defaults[k].min === 'boolean' ? 0 : effect.defaults[k].min}
        			                            x={typeof effect.defaults[k].max === 'boolean' ? (effect.params[k] ? 1 : 0) : effect.params[k]}
                                                xstep={typeof effect.defaults[k].max === 'boolean' ? 0.01 : (effect.defaults[k].max-effect.defaults[k].min)/100}
        			                            xreverse={false}
        			                            onChange={(axis)=>this.onChangeParam(eidx, k, axis.x)}
        			                            styles={trackStyle}
        			                        />
        			                    </div>
    			                    </React.Fragment>
    			                 )}
                                 <div className={'mixer-channel-effect-bottom'}>
                                    <div className={'mixer-channel-effect-bypass'}>
                                        <Switch 
                                            height={15} 
                                            width={30} 
                                            checked={!effect.bypassed}
                                            onChange={(checked)=>this.onBypass(eidx, checked)}
                                        />
                                    </div>
                                    <div className={'mixer-channel-effect-remove'}><FiDelete onClick={()=>this.onRemoveEffect(eidx)}/></div>
                                </div>
    	                    </div>
    	                </div>
    	            )}
                </div>
                <div className={'mixer-channel-effects-right'}>                
                    <div className={'mixer-channel-effect-add'}>
                        {available.map((name, idx)=>
                            <div key={idx} className={'mixer-channel-effect-add-icon'} onClick={()=>this.onAddEffect(name)}>{name.substring(0,3)}</div>
                        )}
                    </div>
                </div>
            </div>
        )
    }
}
const trackHeight = '10px';
const trackStyle = {
    track: {
        height:trackHeight,
        width:'100px',
        backgroundColor: 'pink',
        borderRadius:0
    },
    active: {
      backgroundColor: 'pink',
      borderRadius:0
    },
    thumb: {
      width: trackHeight,
      height: trackHeight,
      borderRadius:0,
      backgroundColor:'rgba(255,255,255,0.8)'
    },
    disabled: {
      opacity: 0.5
    }
}
export default Effects
