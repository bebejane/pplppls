import Global from "../../Global";
import React, { Component } from "react";
import Visualizer from "./Visualizer";

class VolumeVisualizer extends Visualizer {
	constructor(props) {
		super(props);
		this.type = "volume";
	}
	update(volume, options) {
		const meterPercLeft = volume.toFixed(5) / 100;
		const meterPercRight = volume.toFixed(5) / 100;
		const meterHeightRight = parseInt(meterPercRight * this.height);
		const meterHeightLeft = parseInt(meterPercLeft * this.height);
		const x1 = 0;
		const y1 = this.height - meterHeightLeft;
		const x2 = this.width / 2;
		const y2 = this.height - meterHeightRight;

		if (this.state.numChannels === 1) {
			this.ctx.fillStyle = this.state.colorLeft || this.state.color;
			this.ctx.fillRect(x1, y1, this.width, meterHeightLeft);
		} else {
			this.ctx.fillStyle = this.state.colorLeft || this.state.color;
			this.ctx.fillRect(x1, y1, this.width / 2, meterHeightLeft);
			this.ctx.fillStyle = this.state.colorRight || this.state.color;
			this.ctx.fillRect(x2, y2, this.width / 2, meterHeightRight);
		}
	}
}
export default VolumeVisualizer;
