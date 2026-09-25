const self = this; // eslint-disable-line no-restricted-globals
const mp3Encoder = require('./mp3').default
const wavEncoder = require('./wav').default
let options = null;

onmessage = (event)=>{
    if(event.data.progress !== undefined)
        return postMessage(event.data.progress); // eslint-disable-line no-restricted-globals
    if(event.data.options)
        options = event.data.options

    if(!event.data.buffer) return

    const time = Date.now()
    let encoder = event.data.format === 'mp3' ? mp3Encoder : wavEncoder;
    console.log('WORKER Eencode wav', options)
    encoder(event.data.buffer, options || undefined).then((blob)=>{
    	postMessage(blob)// eslint-disable-line no-restricted-globals	
        console.log("encoding time", Date.now()-time)
    }).catch((err)=>{
    	console.error(err)
    })
}
export default self // eslint-disable-line no-restricted-globals
