import Global from '../../Global'
import React, { Component } from "react";
import Visualizer from './Visualizer'

class OscilloscopeVisualizer extends Visualizer {
    constructor(props) {
        super(props);
        this.type = 'timedomain'
    }
    update(data, options){
        //this.clear()
        let sliceWidth = this.width * 1.0 / data.length;
        let x = 0;

        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = this.state.color
        this.ctx.beginPath();
        
        for(let i = 0; i < data.length; i++) {
            let v = data[i] / 128.0;
            let y = v * this.height/2;
            if(i === 0)
              this.ctx.moveTo(x, y);
            else
              this.ctx.lineTo(x, y);

            x += sliceWidth;
        }
        this.ctx.lineTo(this.width, this.height/2);
        this.ctx.stroke();
    }
}
export default OscilloscopeVisualizer;
