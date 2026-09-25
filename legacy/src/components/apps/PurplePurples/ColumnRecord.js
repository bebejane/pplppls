import React, { Component } from "react";
import "./ColumnRecord.css";
import FrequencyVisualizer from "../../visualizers/FrequencyVisualizer";
import VolumeVisualizer from "../../visualizers/VolumeVisualizer";
import OscilloscopeVisualizer from "../../visualizers/OscilloscopeVisualizer";
import FileUploader from "../../util/FileUploader";

class ColumnRecord extends Component {
    constructor(props) {
        super(props);
        this.state = {
            id: props.id,
            sampling: props.sampling,
            isSampling: props.isSampling,
            loaded: props.loaded,
            loading: props.loading,
            error: props.error,
            meter: [0.0, 0.0],
            progress:0,
            uploading:false,
            _sampling:false

        };
        this.fileUploaderRef = React.createRef()
        this.fileUploaderFormRef = React.createRef();
    }
    componentDidMount() {}
    static getDerivedStateFromProps(nextProps, prevState) {
        return nextProps;
    }
    cancelSampleRecord(e) {
        e.stopPropagation();
        this.props.onCancelSampleRecord();
    }
    onOpenFile(e){
        console.log('open file',e)
        
        this.fileUploaderRef.current.removeEventListener('change',this.onFileChange)
        this.fileUploaderRef.current.addEventListener('change', this.onFileChange.bind(this))
        this.fileUploaderRef.current.click()
        e.stopPropagation()
    }
    onFileChange(event){
        console.log('upload file from open button', event.target.files)
        if(!event.target.files.length) return 
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.addEventListener('load', (e)=>{
            this.props.onUpload(e.srcElement.result, file.name)
            this.setState({uploading:false, error:null, progress:100})
        })
        reader.addEventListener('progress', (e)=>{
            this.setState({progress:parseInt((e.loaded/e.total)*100)})
        })
        reader.addEventListener('error', (err)=>{
            this.setState({uploading:false, error:err})
        })
        reader.addEventListener('abort', ()=>{
            this.setState({uploading:false})
        })
        reader.readAsArrayBuffer(file)
        this.setState({uploading:true})
    }
    onUploadSampleFromFile(){
        console.log('submit')
    }
    onSampleRecord(e, on){
        e.stopPropagation()
        e.preventDefault()
        if(this.state.isSampling && !this.state.sampling) return

        this.props.onSampleRecord(on)
    }
    blockDrag(e){
        e.preventDefault();
        e.stopPropagation(); 
        return false
    }
    render() {
        const { sampling, isSampling, meter, id, loaded, loading, error, uploading, progress } = this.state;
        //return null
        //if (!sampling && !loaded && !loading) return null;
        //console.log(this.state)
        return (
            <React.Fragment>
                <FileUploader
                    id={id}
                    multi={true}
                    backgroundColor={'rgb(140, 40, 187)'}
                    onUpload={(buffer, filename) => this.props.onUpload(buffer, filename)}
                    onMultiUpload={(files) =>this.props.onMultiUpload(files)}
                />
                <div className={"sound-canvas-point-rec"}>
                    
                    {sampling  ?
                        <div className={"sound-canvas-point-rec-meter-wrap"}>
                            <div className={"sound-canvas-point-rec-meter"}>
                                <OscilloscopeVisualizer
                                    id={"input"}
                                    color={"#e1c2e8"}
                                    options={{fftSize:512}} 
                                    ready={true}
                                />
                            </div>
                            <div className='sound-canvas-point-open'  onMouseDown={(e)=>this.cancelSampleRecord(e)}>cancel</div>
                            <div className='sound-canvas-point-open-toggle' onMouseDown={(e)=>this.onSampleRecord(e, false)}>stop</div>
                        </div>
                    : !loaded && !loading &&
                        <div className={"sound-canvas-point-rec-buttons"}  >
                            <form id={"upload-file-form"+id} ref={this.fileUploaderFormRef}   style={{display: "none"}} onSubmit={(e)=>this.onUploadSampleFromFile(e)}> 
                                <input type="file" id={"upload-file"+id} accept={'audio/*,video/*'} ref={this.fileUploaderRef}  style={{display: "none"}}/>
                            </form>
                            <div 
                                className='sound-canvas-point-open' 
                                draggable={false} 
                                onDrop={this.blockDrag}
                                onDragStart={this.blockDrag} 
                                onDragEnd={this.blockDrag} 
                                onDragOver={this.blockDrag} 
                                onClick={(e)=>e.stopPropagation()}
                                onMouseDown={(e)=>this.onOpenFile(e)}>
                                open
                            </div>
                            <div 
                                className='sound-canvas-point-open' 
                                draggable={false} 
                                onDrop={this.blockDrag}
                                onDragStart={this.blockDrag} 
                                onDragEnd={this.blockDrag} 
                                onDragOver={this.blockDrag} 
                                onClick={(e)=>e.stopPropagation()}
                                onMouseDown={(e)=>this.onSampleRecord(e,true)}
                            >
                            rec
                            </div>
                            {error && 
                                <div className='sound-canvas-point-error'>
                                    {'Error loading file!'}
                                    
                                    {/*<div className='sound-canvas-point-error-desc'>{error}</div>*/} 
                                </div>
                            }
                        </div>
                    }
                    {uploading && <div className={"sound-canvas-point-rec-uploading"}>{progress}%</div>}
                </div>
            </React.Fragment>
        );
    }
}
export default ColumnRecord;
