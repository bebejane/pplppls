import React, { Component } from "react";
import "./SaveDialog.css";

class SaveDialog extends Component {
    constructor(props) {
        super(props);
        this.state = {
            model:props.model,
        };
        this.ref = React.createRef()
    }
    componentDidMount() {

    }
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    onSubmit(e){
        
        if(this.ref.current.value)
            this.props.onSubmit(this.ref.current.value)
        e.preventDefault()
    }
    onKeyDown(e){
        if(e.key === 'Escape')
            this.props.onClose()
    }
    render() {
        const { model} = this.state;

        return (
            <div id={"save-dialog"} onMouseMove={(e)=>e.stopPropagation()}>
                <div id={"save-dialog-box"}>
                    Save<br/>
                    <form onSubmit={(e)=>this.onSubmit(e)}>
                        <input onKeyDown={(e)=>this.onKeyDown(e)} id={'save-dialog-model'} ref={this.ref} placeholder={'name it....'} spellCheck={false} autoComplete={'off'}  type='text' defaultValue={model} autoFocus={true}/>
                    </form>
                    <div id={"save-dialog-close"} onClick={()=>this.props.onClose()}>X</div>
                </div>

            </div>
        );
    }
}

export default SaveDialog;
