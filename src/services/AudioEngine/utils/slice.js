const slice = (buffer, start, end)=>{
    if(end > buffer[0].length)
        end = buffer[0].length-1
    
    const rightChunk = new Float32Array(end-start)
    const leftChunk = new Float32Array(end-start)

    for (let i = start, x=0; x < leftChunk.length; x++, i++)
        leftChunk[x] = buffer[0][i]

    if(buffer.length === 2){
        for (let i = start, x=0; x < rightChunk.length; x++, i++)
            rightChunk[x] = buffer[0][i]
    }

    if(buffer.length === 2)
        return [leftChunk, rightChunk]
    else
        return [leftChunk]
}

export default slice;