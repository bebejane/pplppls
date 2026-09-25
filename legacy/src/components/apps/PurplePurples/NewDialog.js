import React, { Component } from "react";
import "./NewDialog.css";

class NewDialog extends Component {
    constructor(props) {
        super(props);
        this.state = {

        };
        this.ref = React.createRef()
        this.refCols = React.createRef()
        this.refRows = React.createRef()
    }
    componentDidMount() {

    }
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    onSubmit(e){
        console.log('submit')
        if(this.ref.current.value)
            this.props.onSubmit(this.ref.current.value, parseInt(this.refCols.current.value), parseInt(this.refRows.current.value)) 
        e.preventDefault()
    }
    onKeyDown(e){
        if(e.key === 'Escape')
            this.props.onClose()
    }
    render() {

        return (
            <div id={"new-dialog"} onMouseMove={(e)=>e.stopPropagation()}>
                <div id={"new-dialog-box"}>
                    New<br/>
                    <form onSubmit={(e)=>this.onSubmit(e)} id={'new-dialog-form'}>
                        <input id={'new-dialog-model'} ref={this.ref} placeholder={'name it....'} spellCheck={false} autoComplete={'off'}  type='text' autoFocus={true} onKeyDown={(e)=>this.onKeyDown(e)}/>
                        <input id={'new-dialog-cols'} ref={this.refCols} placeholder={'COLS'} min={1} max={30} spellCheck={false} autoComplete={'off'}  type='number' defaultValue={3} onKeyDown={(e)=>this.onKeyDown(e)}/>
                        <input id={'new-dialog-rows'} ref={this.refRows} placeholder={'ROWS'} min={1} max={30} spellCheck={false} autoComplete={'off'}  type='number' defaultValue={3} onKeyDown={(e)=>this.onKeyDown(e)}/>
                        <input type={'submit'} value={'ADD'}/>
                    </form>
                    <div id={"new-dialog-close"} onClick={()=>this.props.onClose()}>X</div>
                </div>

            </div>
        );
    }
}

export default NewDialog;
