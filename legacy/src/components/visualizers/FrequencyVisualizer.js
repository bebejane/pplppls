import { Component } from "react";
import Visualizer from './Visualizer'

class FrequencyVisualizer extends Visualizer {
    constructor(props) {
        super(props);
        this.type = 'frequency'
    }
    update(data){
        
        const margin = 2;
        const barWidth = (this.width/data.length)+margin
        for (let i = 0, x=0; i < data.length; i++, x+=margin) {
            this.ctx.fillStyle = this.state.color;
            this.ctx.fillRect(parseInt((i*barWidth)+x),this.height-parseInt(data[i]*2.55),barWidth,parseInt(data[i]*2.55));
        }
    }
}
export default FrequencyVisualizer;
