import React, { Component } from "react";
import "./NotSupported.css";

class NotSupported extends Component {
	constructor(props) {
		super(props);
		this.state = {};
	}
	componentDidMount() {}
	static getDerivedStateFromProps(nextProps, prevState) {
		return nextProps;
	}
	render() {
		return (
			<div id={"notsupported"}>
				<div id={"notsupported-container"}>use PC</div>
			</div>
		);
	}
}
export default NotSupported;
