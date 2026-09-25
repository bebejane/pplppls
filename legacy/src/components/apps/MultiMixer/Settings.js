import React, { Component } from "react";
import "./Settings.css";

class Settings extends Component {
    constructor(props){
        super(props)
        this.state = {
            active:props.active,
            recordings:props.recordings || [],
            midiDevices:props.midiDevices || [],
            inputDevices:props.inputDevices || [],
            show:true
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
        this.setState({show:false})
        this.props.onClose()
    }
    render(){
        const {
            active,
            midiDevices,
            inputDevices,
            recordings
        } = this.state

        if(!active) return null

        return(
            <div id={"settings"}>
                    <div id={"settings-box"}>
                        <div>
                            INPUT<br/>
                            <select onChange={(e)=>this.props.onDeviceChange(e.target.value)}>
                                {inputDevices.map((device, idx)=><option key={idx} value={device.deviceId}>{device.label}</option>)}
                            </select>
                        </div>
                        <div>
                            MIDI<br/>
                            <select onChange={(e)=>this.props.onMidiDeviceChange(e.target.value)}>
                                {midiDevices.length > 0 ? 
                                    midiDevices.map((device, idx)=><option key={idx} value={device.id}>{device.name}</option>)
                                :
                                    <option value={false}>No MIDI found</option>
                                }
                            </select>
                        </div>

                        <div>
                            RECORDINGS<br/>
                            {recordings.length ?
                                <>
                                <select onChange={(e)=>this.props.onDownload(e.target.value)}>
                                    <option value={false}>.wav</option>
                                    {recordings.map((recording, idx)=><option key={idx} value={recording.id}>{recording.filename}</option>)}
                                </select>
                                <select onChange={(e)=>this.props.onDownload(e.target.value)}>
                                    <option  key={-1} value={false}>.mp3</option>
                                    {recordings.map((recording, idx)=><option  key={idx} value={recording.id}>{recording.filename}</option>)}
                                </select>
                                </>
                            :
                                <select>
                                <option value={false}>Nada here</option>
                                </select>
                            }
                        </div>

                        <div id={'close'} onClick={()=>this.onClose()}>CLOSE</div>
                    </div>
            </div>
        )
    }
}
export default Settings
