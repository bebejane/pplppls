
import React, { Component } from 'react';
import {SortableContainer, SortableElement} from 'react-sortable-hoc';
import arrayMove from 'array-move';
import {BsToggleOff, BsToggleOn}  from 'react-icons/bs'
import {IoMdRemoveCircleOutline}  from 'react-icons/io'
import {GoSettings}  from 'react-icons/go'
import './Chain.css';

const SortableItem = SortableElement(({value, index, effect, settingsIdx, onBypass, onRemove, onSettings}) => {
    return (
        <div className={'chain-effect-wrap'}>
            <div className={'chain-effect-item'} onClick={()=>onSettings(effect.id, effect.idx)} style={effect.idx === settingsIdx ? {backgroundColor:'rgba(255,255,255,0.2)'}: {}}>
                <div className={'chain-effect-toggle'} style={!effect.bypassed ? {color:'rgba(255,255,255,1)'}: {}} onClick={()=>onBypass(effect.id, effect.idx, !effect.bypassed)}>
                    {effect.bypassed ? <BsToggleOff size={16}/> : <BsToggleOn size={16}/>}
                </div>
                <div className={'chain-effect-name'}>{value}</div>
                <div className={'chain-effect-remove'} onClick={()=>onRemove(effect.id, effect.idx)}><IoMdRemoveCircleOutline size={16}/></div>
                {/*<div className={'chain-effect-remove'} style={effect.idx === settingsIdx ? {color:'rgba(255,255,255,1)'}: {}} onClick={()=>onSettings(effect.id, effect.idx)}><GoSettings size={16}/></div>*/}
                
            </div>
            <div className={'chain-effect-connector'}>|</div>
        </div>
    )
});
const SortableList = SortableContainer(({items, effects, settingsIdx, onBypass, onRemove, onSettings}) => {
  return (
    <div>
      {items.map((value, index) => (
        <SortableItem 
            key={`item-${value+index}`} 
            index={index} 
            value={value} 
            effect={effects.filter((e)=>e.id === value && e.idx === index)[0]} 
            settingsIdx={settingsIdx}
            onBypass={onBypass}
            onRemove={onRemove}
            onSettings={onSettings}
        />
      ))}
    </div>
  );
});


class Chain extends Component {
    constructor(props){
        super(props)
        this.state = {
            effects:props.effects,
            items:props.items,
            effect:props.effect,
            settingsIdx:props.settingsIdx,

        }
    }
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    
    onDragOver(e){
        e.preventDefault();
    }
    onDragStart(e, id){
        console.log('dragstart on: ', id);
        e.dataTransfer.setData('effectId', id);
    }
    onDrop(e){
        const id = e.dataTransfer.getData('effectId');
        const effect = this.state.effects.filter((eff)=>eff.id === id)[0]
        this.props.onAdd(effect.id)
    }
    onSortEnd(e){
        const {oldIndex, newIndex} = e;
        const effect = this.state.items[oldIndex]
        this.onMove(effect.id, effect.idx, oldIndex, newIndex)
    }
    onBypass(id, idx, bypass){
        this.props.onBypass(id, idx, bypass)
    }
    onRemove(id, idx){
        this.props.onRemove(id, idx)
    }
    onMove(id, idx, fromIdx, toIdx){
        this.props.onMove(id, idx, fromIdx, toIdx)
    }
    onSettings(id, idx){
        this.props.onSettings(id, idx)
    }
    onEffectParam(id, idx, param, val){
        this.props.onEffectParam(id, idx, param, val)
    }
    onClick(e){
        console.log(e)
    }
    handleDropOut(e){
        console.log(e)
    }
    render(){

        const {effects, items, settingsIdx} = this.state;
        const effect = settingsIdx !== null  ? items[settingsIdx] : null;
        //console.log(effect)
        return (
            <div id={'chain-container'}>
                <div id={'chain-top'} >
                    <div id={'chain-effects-selector'} >
                        {effects.map((effect,idx)=>
                            <div
                                key={idx}
                                className={'chain-effects-selector-item'}
                                onDragStart={(event) => this.onDragStart(event, effect.id)}
                                draggable
                            >{effect.id}
                            </div>
                        )}
                    </div>
                </div>
                <div id={'chain-bottom'} >
                    <div 
                        id={'chain-effects-container'}
                        onDragOver={(event)=>this.onDragOver(event)}
                        onDrop={(event)=>this.onDrop(event, 'Done')}
                    >   {items.length ? 
                            <SortableList 
                                className={'chain-list'}
                                items={items.map((eff)=>eff.id)}
                                effects={items}
                                settingsIdx={settingsIdx}
                                axis={'y'}
                                distance={1}
                                onBypass={(id, idx, bypass)=>this.onBypass(id, idx, bypass)}
                                onRemove={(id, idx)=>this.onRemove(id, idx)}
                                onSettings={(id, idx)=>this.onSettings(id, idx)}
                                onSortEnd={(e)=>this.onSortEnd(e)}
                            />    
                        :
                            <div className={'chain-list-empty'}>Drag here</div>
                        }
                    </div>
                    {effect ?
                        <div id='chain-effect-settings'>
                                <div className={'chain-effect-param-wrap'}>
                                    {Object.keys(effect.params).map((type, idx)=>
                                        <div key={idx} className={'chain-effect-param-container'}>
                                            <div>{type}</div>
                                            <div key={idx} className={'chain-effect-param-slider'}>
                                                <div>
                                                    {effect.defaults[type].type !== 'boolean' ?
                                                        <input
                                                            type={'range'}
                                                            min={effect.defaults[type].min}
                                                            max={effect.defaults[type].max}
                                                            defaultValue={effect.defaults[type].value}
                                                            step={effect.defaults[type].max/100}
                                                            onChange={(e)=>this.onEffectParam(effect.id, effect.idx, type, e.target.value)}
                                                        />
                                                    :
                                                        <input
                                                            type={'range'}
                                                            min={0}
                                                            max={1}
                                                            defaultValue={effect.defaults[type].value ? 1 : 0}
                                                            step={1}
                                                            onChange={(e)=>this.onEffectParam(effect.id, effect.idx, type, e.target.value)}
                                                        />
                                                    }
                                                </div>
                                                <div>
                                                    {effect.params[type]}
                                                </div>
                                                
                                            </div>
                                        </div>  
                                    )}
                                </div>
                        </div>
                    :
                        <div id='chain-effect-settings-empty'>
                            <div className={'chain-list-empty'}></div>
                        </div>
                    }
                </div>
            </div>
        )
    }
}

export default Chain
