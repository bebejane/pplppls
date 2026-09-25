import React, { Component } from "react";
import "./TitleBar.css";

class TitleBar extends Component {
    constructor(props) {
        super(props);
        this.state = {
            title:props.title
        };
    }
    componentDidMount() {
    }
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    onDoubleClick(e){
        const win = window.require('electron').remote.getCurrentWindow()
        if(!win.isMaximized())
            win.maximize()
        else
            win.unmaximize()
    }
    render() {
        const { title } = this.state;
        return (
            <div id={"titlebar"} onDoubleClick={()=>this.onDoubleClick()}>
                <div id="titlebar-left"></div>
                <div id="titlebar-center">{title}</div>
                <div id="titlebar-right"></div>
            </div>
        );
    }
}
export default TitleBar;
