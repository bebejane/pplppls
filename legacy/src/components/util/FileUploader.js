import React, { Component } from "react";
import "./FileUploader.css";

class FileUploader extends Component {
  constructor(props) {
    super(props);
    this.uploadFile = this.uploadFile.bind(this);
    this.state = {
      id:props.id,
      style:props.style || {},
      multi:props.multi,
      backgroundColor:props.backgroundColor || 'transparent',
      label:props.label,
      content: null,
      showLoader: false,
      fileSize: 0,
      sizeExceeded: false,
      showDrop:false,
      progress:0,
      drag:false,
      over:false
    };
    this.ref = React.createRef()
  }

  async uploadFile(file) {

    return new Promise((resolve, reject)=>{
     this.setState({showLoader: true, progress:0});
      if (file) {
        var total = 0
        var reader = new FileReader();
        reader.onload = (e) => {
          if(this.props.onUploadProgress)
            this.props.onUploadProgress({progress:100, loaded:total, total})
          resolve({contents:e.target.result, filename:file.name})
        }
        reader.onprogress = (e)=>{
          total = e.total
          const prog = {progress:parseInt(((e.loaded/e.total)*100).toFixed(0)), loaded:e.loaded, total:e.total}
          this.setState({progress:prog.progress})
          if(this.props.onUploadProgress)
            this.props.onUploadProgress(prog)


        }
        reader.onerror = (err)=>{
          reject(err)
          if(this.props.onUploadError)
            this.props.onUploadError(err)
        }
        reader.readAsArrayBuffer(file);
      }
    })
  }
  async uploadFiles(files) {

    console.log('upload multi', files.length)
    await this.setState({showLoader: true, progress:0});
    const f = []
    try{

      for (var i = 0; i < files.length; i++)
        f.push(await this.uploadFile(files[i]))
      this.setState({ showLoader:false});
    }catch(err){
      return Promise.reject(err)
    }
    return Promise.resolve(f)

  }

  renderFileLimitExceeded(){
    let text = this.props.customLimitText ? this.props.customLimitText : "File size exceeds "+(this.props.fileSizeLimit/1000)+"MB limit";
    if (this.state.sizeExceeded){
      return (
        <div style={this.props.customLimitTextCSS}>{text}</div>
      );
    }
    else{
      return null;
    }
  }
  onDrop(ev){
    ev.preventDefault()

    let file = null
    let files = []
    if (ev.dataTransfer.items) {
      for (var i = 0; i < ev.dataTransfer.items.length; i++) {
        if (ev.dataTransfer.items[i].kind === 'file') {
          file = ev.dataTransfer.items[i].getAsFile();
        }
      }
    }
    if(ev.dataTransfer.files){
      for (i = 0; i < ev.dataTransfer.files.length; i++) {
        const item = ev.dataTransfer.files.item(i)
        files.push(item);
      }
        file = files[0]
    }

    

    if(files.length>1 && this.state.multi){
      this.uploadFiles(files).then((uploaded)=>{
        this.props.onMultiUpload(uploaded)
      }).catch((err)=>{
          this.setState({ error:err});
          this.handleError(err)
      }).then(()=>{
        this.setState({ showLoader:false, progress:0});
      })
    }
    else{
      this.uploadFile(file).then((uploaded)=>{
        this.props.onUpload(uploaded.contents, uploaded.filename)
      }).catch((err)=>{
          this.setState({ error:err});
          this.handleError(err)
      }).then(()=>{
        this.setState({ showLoader:false, progress:0});
      })
    }
    this.setState({showDrop:false})
  }
  dragOverHandler(ev) {
    this.setState({over:true})
    ev.preventDefault();
  }
  dragEnterHandler(ev) {
    console.log('enter')
    this.setState({showDrop:true})
    ev.preventDefault()
  }
  dragStartHandler(ev) {
    console.log('start')
    ev.preventDefault()

  }
  dragEndHandler(ev) {
    console.log('ennd')
    this.setState({showDrop:false})
    ev.preventDefault()

  }
  onMouseLeave(ev){
    this.setState({over:false, showDrop:false})
    
  }
  handleError(err){
    if(this.props.onError)
      this.props.onError(err)
  }
  
  delegateEvent(e){
    this.ref.current.style.display = 'none'
    e.target.parentNode.dispatchEvent(new MouseEvent(e.type, e));
    this.ref.current.style.display = 'flex'
    
    if(e.type !== 'mouseleave')
      e.stopPropagation()

  }
  render() {
    const {
      progress, 
      showDrop, 
      id, 
      style, 
      backgroundColor, 
      label
    } = this.state;
    return (
      <div 
          ref={this.ref}
          className="file-uploader" 
          style={{...style}}
          onDragEnter={(e)=>this.dragEnterHandler(e)}
          onDragOver={(e)=>this.dragOverHandler(e)}
          onDragLeave={(e)=>this.dragEndHandler(e)}
          onDragStart={(e)=>this.dragStartHandler(e)}
          //onClick={(e)=>{e.stopPropagation();}}
          onMouseDown={(e)=>this.delegateEvent(e)}
          onMouseMove={(e)=>this.delegateEvent(e)}
          onMouseLeave={(e)=>this.delegateEvent(e)}
          onMouseEnter={(e)=>this.delegateEvent(e)}
          onMouseOver={(e)=>this.delegateEvent(e)}
          onMouseUp={(e)=>this.delegateEvent(e)}
          onDrop={(e)=>this.onDrop(e)}
          >

          <div className="file-uploader-item"
            id={id}
            style={{opacity:showDrop || (progress && progress !== 100) ? 1 : 0, zIndex:showDrop || (progress && progress !== 100) ? 20000 : 0, backgroundColor:backgroundColor }}
          >
          {(progress && progress !== 100) ? progress +  '%' : label !== undefined ? label : 'DROP'}
          </div>

      </div>
    );
  }
}
export default FileUploader;
