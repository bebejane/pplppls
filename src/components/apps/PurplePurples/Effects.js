import React, { Component } from "react";
import "./Effects.css";
import {
    GiEchoRipples
} from "react-icons/gi";

class Effects extends Component {
    constructor(props) {
        super(props);
        this.state = {
            id: props.id,
            sampling: props.sampling,
            effects:props.effect,
        };
    }
    componentDidMount() {

    }
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    onEffectParams(e, type, key){
        const params = {}
        params[type] = {} 
        params[type][key] = {value:parseFloat(e.target.value)}
        this.props.onEffectParams(type, params)
    }
    onEffectBypass(e, type, active) {
        e.stopPropagation()
        this.props.onEffectBypass(type, active)
    }
    render() {
        const { id, effects} = this.state;

        return (
            <div
                className={"sound-canvas-point-effects"}
                onMouseDown={(e) => {e.stopPropagation();}}
            >
                {Object.keys(effects).map((type, idx)=>
                    <div key={idx} className={'sound-canvas-point-effect'}>
                        <div className={'sound-canvas-point-effect-icon'}>
                            <GiEchoRipples
                                onMouseDown={(e)=>this.onEffectBypass(e, type, !effects[type].bypass.value)} 
                                className={effects[type].bypass.value ? "sound-canvas-point-effect-toggle" :""}/>
                        </div>
                        {!effects[type].bypass.value &&
                            <div key={'p'+idx} className={'sound-canvas-point-effect-params'  + (effects[type].bypass.value ? ' bypass' : '')}>
                                {Object.keys(effects[type]).filter((k)=> k !== 'bypass').map((k, idx) =>{
                                    return(
                                        <React.Fragment key={'e'+idx}>
                                        <div className={'sound-canvas-point-effect-params-name'}>{k} {effects[type][k].value}</div>
                                        <div className={'sound-canvas-point-effect-params-val'}>
                                            <input
                                                id={idx+id}
                                                type="range"
                                                min={effects[type][k].min}
                                                max={effects[type][k].max}
                                                step={effects[type][k].type === 'float' && effects[type][k].value <= 1.0 ? 0.01 : effects[type][k].type === 'boolean' ? 1: 1}
                                                value={effects[type][k].value}
                                                onChange={(e)=>this.onEffectParams(e, type, k)}
                                            />
                                        </div>
                                        </React.Fragment>
                                    )
                                })}
                            </div>
                        }
                    </div>
                )}
            </div>
        );
    }
}


export default Effects;
