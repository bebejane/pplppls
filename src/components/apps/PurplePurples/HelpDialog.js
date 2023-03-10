import React, { Component } from "react";
import "./HelpDialog.css";

import {
    MdPlayArrow,
    MdStop,
    MdRepeat,
    MdVolumeUp,
    MdFiberManualRecord,
    MdSettingsBackupRestore,
} from "react-icons/md";
import { IoMdLock } from "react-icons/io";
import { AiOutlineLink, AiFillPhone } from "react-icons/ai";
import { RiArrowGoBackLine } from "react-icons/ri";
import { GiMagicLamp} from "react-icons/gi";
import { TiWaves } from "react-icons/ti";

class HelpDialog extends Component {
    constructor(props) {
        super(props);
        this.state = {
            model:props.model,
        };
    }
    componentDidMount() {

    }
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    
    render() {
        const { model} = this.state;

        return (
            <div id={"help-dialog"} onMouseMove={(e)=>e.stopPropagation()}>
                <div id={"help-dialog-box"}>
                    <div id={"help-dialog-close"} onClick={()=>this.props.onClose()}>X</div>
                    <div>
                        <table>
                            <tbody>
                            <tr><td colSpan={2}><b>Keys</b></td></tr>
                            <tr><td>SPACE</td><td>Toggle Record</td></tr>
                            <tr><td>RETURN</td><td>Play all</td></tr>
                            <tr><td>C</td><td>Toggle Controls</td></tr>
                            <tr><td>F</td><td>Toggle Fullscreen</td></tr>
                            <tr><td>S</td><td>Toggle Save</td></tr>
                            <tr><td>M</td><td>Toggle Mute</td></tr>
                            <tr><td>B</td>Random<td></td></tr>
                            <tr><td>Q</td>Other stuff<td></td></tr>
                            <tr><td colSpan={2}><br/></td></tr>
                            <tr><td colSpan={2}><b>Mouse</b></td></tr>
                            <tr><td>Right CLick</td><td>Stop</td></tr>
                            <tr><td>CTRL + Click</td><td>Lock</td></tr>
                            <tr><td>CTRL + Move</td><td>Change Loop</td></tr>
                            <tr><td>CMD + Dbl Click</td><td>Zoom</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div>
                        <table>
                            <tbody>
                            <tr><td colSpan={2}><b>Controls</b></td></tr>
                            <tr><td><MdPlayArrow/></td><td>Play/Stop</td></tr>
                            <tr><td><MdFiberManualRecord/></td><td>Record</td></tr>
                            <tr><td><MdVolumeUp/></td><td>Mute</td></tr>
                            <tr><td><MdRepeat/></td><td>Loop</td></tr>
                            <tr><td><RiArrowGoBackLine/></td><td>Reverse</td></tr>
                            <tr><td><AiOutlineLink/></td><td>Map midi note</td></tr>
                            <tr><td><MdSettingsBackupRestore/></td><td>Reset</td></tr>
                            <tr><td><AiFillPhone/></td><td>Solo</td></tr>
                            <tr><td><TiWaves/></td><td>Waveform</td></tr>
                            <tr><td><IoMdLock/></td><td>Lock</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }
}

export default HelpDialog;
