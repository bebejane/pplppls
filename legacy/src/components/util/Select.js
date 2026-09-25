import React, { Component } from "react";
import "./Select.css";

class Select extends Component {
    constructor(props) {
        super(props);
        this.state = {
            value:props.value,
            options:props.options,
            center:props.center || false,
            direction:props.direction || 'up',
            display:false,
            x:0,
            y:0,
            width:0,
            
        };
        this.selectRef = React.createRef()
        this.optionsRef = React.createRef()
        this.onResize = this.onResize.bind(this)
    }
    componentDidMount() {
        window.addEventListener('resize', this.onResize)
        this.setState({display:false, width:this.getWidth()})
    }
    componentWillUnmount() {
        window.removeEventListener('resize', this.onResize)
    }
    componentDidUpdate(){
        if(this.state.width !== this.getWidth())
            this.setState({width:this.getWidth()})
    }
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    onResize(e){
        if(this.selectRef.current)
            this.setState({x:this.selectRef.current.offsetLeft,width:this.getWidth()})
    }
    onClick(value){
        this.setState({display:false})
        if(this.props.onChange)
            this.props.onChange(value)
        if(this.props.onClick)
            this.props.onClick(value)

    }
    onDisplay(on){
        if(this.props.onClick)
            this.props.onClick()
        if(!on) 
            return this.setState({display:false})

        const select = this.selectRef.current
        const options = this.optionsRef.current
        const width = this.getWidth()
        const y = this.state.direction === 'down' ? (select.offsetTop + select.clientHeight) :  (select.offsetTop - options.clientHeight)
        const x = select.offsetLeft
        this.setState({display:on, x, y, width})      
    }
    getWidth(){
        if(!this.selectRef.current || !this.optionsRef.current) return 0
        return this.selectRef.current.clientWidth// >  this.optionsRef.current.clientWidth ? this.selectRef.current.clientWidth : this.optionsRef.current.clientWidth       
    }
    render() {
        const { options, display, x, y, value, width, center} = this.state;
        const selected = options.filter((o)=>o.value === value)[0] || options[0] || {}
        if(!options.length) return null
            
        return (
            <div className={"select"} ref={this.selectRef}>
                <div
                    className={'selected-option'}
                    onClick={()=>this.onDisplay(!display)}
                    style={{minWidth:(width)+'px', visibility: selected.label ? 'visible' : 'hidden', justifyContent: center ? 'center' : undefined}}
                >{selected.label}
                </div>
                <div className={'options'} ref={this.optionsRef} style={{top:y,left:x, visibility: display ? 'visible': 'hidden'}}>
                    {options.filter((o)=>o.value !== selected.value).map((o, idx)=>
                        <div
                            key={idx} 
                            className={'select-option'}
                            style={{minWidth:width+'px', maxWidth:width+'px', justifyContent: center ? 'center' : undefined}}
                            onClick={()=>this.onClick(o.value)}
                        >{o.label}
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

export default Select;
