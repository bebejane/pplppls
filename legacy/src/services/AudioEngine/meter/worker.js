const self = this; // eslint-disable-line no-restricted-globals
let channelCount = 2

onmessage = (event)=>{
    if(event.data.channelCount)
        return channelCount = event.data.channelCount

    var channelData = event.data.buffer;
    var totals = new Array(channelCount).fill(0.0);
    var total = 0;
    for (var sample = 0; sample < channelData[0].length; sample+=200) {
      for (i = 0; i < channelCount; i++){
         totals[i] += Math.abs(channelData[i][sample])
      }
    }
    for (var i = 0; i < totals.length; i++)
        totals[i] = +(totals[i]/channelData[i].length)*200
    postMessage({meter:totals})
}
export default self // eslint-disable-line no-restricted-globals
