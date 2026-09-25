import Global from '../../../Global';
import React, { Component } from 'react';
import './Column.css';
import { AiOutlineLoading } from 'react-icons/ai';
import ColumnRecord from './ColumnRecord';
import ColumnTools from './ColumnTools';
import Waveform from '../../util/Waveform';
import moment from 'moment';
import {
	MdPlayArrow,
	MdStop,
	MdRepeat,
	MdVolumeUp,
	MdFiberManualRecord,
	MdSettingsBackupRestore,
} from 'react-icons/md';
import { IoMdLock } from 'react-icons/io';
import { AiOutlineLink, AiFillPhone } from 'react-icons/ai';
import { RiArrowGoBackLine } from 'react-icons/ri';
import { GiMagicLamp } from 'react-icons/gi';
import { TiWaves } from 'react-icons/ti';

class Column extends Component {
	constructor(props) {
		super(props);

		this.state = {
			id: props.id,
			controls: props.controls,
			sampling: props.sampling,
			isSampling: props.isSampling,
			fullscreen: props.fullscreen,
			//locked: props.locked,
			locked: false,
			pitch: 1.0,
			pitchPercentage: 0,
			height: 0,
			width: 0,
			showPitch: false,
			showGain: false,
			gainPass: false,
			pitchPass: false,
			count: 0,
			loopEndTrigger: false,
			meter: [0.0, 0.0],
			fullscreen: false,
			click: false,
			hovering: false,
			recordingProgress: {},
			randDeg: 0,
			samplingProgress: {},
			point: null,
		};
		this.ref = React.createRef();
		this.canvasRef = React.createRef();
		this.pointRef = React.createRef();
	}
	componentDidMount() {
		const point = this.ref.current;
		this.setState({
			height: point.clientHeight,
			width: point.clientWidth,
		});
		Global.engine.on('loopend' + this.state.id, () => {
			//console.log('loopend');
			this.setState({ loopEndTrigger: true });
			setTimeout(() => this.setState({ loopEndTrigger: false }), 50);
		});
		//console.log('state'+this.state.id)
		Global.engine.on('state' + this.state.id, (state, updated) => {
			updated.locked !== undefined && console.log(updated, state.locked);
			this.setState({ ...this.state, ...state });

			if (updated.playing) this.triggerClick();
			if (updated.locked) this.lock();
			//console.log(updated)
		});
	}
	lock() {
		console.log('lock client side');
		clearInterval(this.it);
		clearInterval(this.to);
		this.pointRef.current = null;
		this.it = setInterval(() => {
			this.setState({ randDeg: Math.floor(Math.random() * 360) + 0 });
		}, 10);

		this.to = setTimeout(() => {
			clearInterval(this.it);
			this.setState({ randDeg: 0 });
		}, 300);
	}
	static getDerivedStateFromProps(nextProps, prevState) {
		return nextProps;
	}

	onMouseDown(e) {}
	onMouseUp(e) {
		return;
	}
	onClick(e, context) {
		if (this.state.fullscreen) return;
		if (new Date().getTime() - this._lastClick < 200 && e.metaKey) {
			console.log('doubleclick');
			return this.onDoubleClick(e);
		}

		const id = this.state.id;
		const l = this.ref.current.offsetLeft;
		const t = this.ref.current.offsetTop;
		const height = this.ref.current.clientHeight;
		const width = this.ref.current.clientWidth;
		const percX = Math.abs((e.pageX - l) / width);
		const percY = Math.abs((e.pageY - t) / height);
		this.pointRef.current = { x: percX, y: percY };
		this.setState({ point: this.pointRef.current });

		this.setState({ click: true });
		setTimeout(() => this.setState({ click: false }), 100);

		if (!e.altKey && !e.metaKey && !e.ctrlKey) {
			this.props.onPlay({ rate: Math.ceil(percX * 12) / 10 });
		} else if (e.altKey) {
			//this.setState({ point: null });
			this.pointRef.current = null;
			return this.props.onStop(id);
		} else if (e.ctrlKey) {
			return this.props.onLocked(!this.state.locked);
		} else if (e.metaKey) {
			//return this.onSampleRecord(!this.state.sampling);

			//this.setState({fullscreen:!this.state.fullscreen}, ()=>{
			this.props.onFullscreen(!this.state.fullscreen);
			//})
		}
		const rate = Math.ceil(percX * 12) / 10;
		//this.props.onPlay({rate});
		this._lastClick = new Date().getTime();
		//e.stopPropagation()
	}
	onMouseEnter(e) {
		this.setState({ hovering: true });
	}
	onMouseLeave(e) {
		this.setState({ hovering: false });
	}
	onDoubleClick(e) {}
	onRightClick(e) {
		e.preventDefault();
	}
	onModify(e) {
		if (this.state.fullscreen) return;

		if (e.ctrlKey && !this.state.locked) {
			const percY =
				100 - ((e.pageY - this.ref.current.offsetTop) / this.ref.current.clientHeight) * 100;
			const percX = Math.abs(
				(e.pageX - this.ref.current.offsetLeft) / this.ref.current.clientWidth,
			);
			let loopStart = percX * this.state.duration;
			let loopEnd = (percY / 100) * this.state.duration;
			loopEnd = loopEnd < loopStart ? loopStart : loopEnd;
			return this.props.onLoop(this.state.loop, { start: loopStart, end: loopEnd });
		} else if (!this.state.locked) {
			const percY =
				100 - ((e.pageY - this.ref.current.offsetTop) / this.ref.current.clientHeight) * 100;
			const percX = Math.abs(
				(e.pageX - this.ref.current.offsetLeft) / this.ref.current.clientWidth,
			);
			Global.engine.rate(this.state.id, parseFloat((percX * 2.0).toFixed(1)));
		}
	}
	onLoopSelection(selection) {
		const loop = !(selection.start === 0 && selection.end === 0);
		Global.engine.loop(this.state.id, loop, selection);
		//if(Global.engine.playing(this.state.id))
		if (loop) Global.engine.play(this.state.id, { enableElapsed: true });
		else Global.engine.stop(this.state.id);
	}
	onSwipe(e) {
		const myLocation = e.changedTouches[0];
		const realTarget = document.elementFromPoint(myLocation.clientX, myLocation.clientY);

		if (realTarget) this.onMove(e.targetTouches[0], realTarget.id.replace('p-', ''));
		e.preventDefault();
	}
	onActive(active) {
		if (!active) this.setState({ showGain: false, showPitch: false });
		this.props.onActive(active);
	}
	onUpload(buffer, filename) {
		this.props.onUpload(buffer, filename);
	}
	onMultiUpload(files) {
		this.props.onMultiUpload(files);
	}
	async onSampleRecord(on) {
		console.log('onSampleRecord', on);

		this.props.onSampleRecord(on);
	}
	async count() {
		let recCounter = this.state.recCounter;
		if (recCounter === -1) recCounter = 5;
		if (recCounter === 1) {
			clearInterval(this.countInterval);
			this.props.onSampleRecord(true);
		} else if (recCounter > 1) Global.engine.metronome();
		this.setState({ recCounter: --recCounter });
	}
	onCancelSampleRecord() {
		console.log('cancel sample record');
		clearInterval(this.countInterval);

		this.props.onSampleRecord(false);
	}

	formatDuration(secs) {
		//return ms

		const tempTime = moment.duration(secs * 1000);
		return (
			(tempTime.hours() ? tempTime.hours() + ':' : '') +
			tempTime.minutes() +
			':' +
			tempTime.seconds() +
			':' +
			tempTime.milliseconds().toFixed(0)
		);
	}
	onEffectBypass(type, active) {
		this.props.onEffectBypass(type, active);
	}
	onEffectParams(type, params) {
		this.props.onEffectParams(type, params);
	}
	handleKeyDown(e) {
		console.log(e);
	}
	onSolo(on) {
		this.props.onSolo(on);
	}
	onFullscreen(on) {
		this.setState({ fullscreen: on });
		this.props.onFullscreen(on);
	}
	triggerClick() {
		this.setState({ click: true });
		setTimeout(() => this.setState({ click: false }), 200);
	}
	render() {
		const {
			rate,
			id,
			loading,
			loaded,
			ready,
			recording,
			filename,
			volume,
			playing,
			loop,
			loopStart,
			loopEnd,
			duration,
			click,
			muted,
			sampling,
			isSampling,
			midiMapMode,
			midiNote,
			locked,
			loopEndTrigger,
			reversed,
			effectsEnabled,
			samplingProgress,
			solo,
			error,
			fullscreen,
			randDeg,
			hovering,
		} = this.state;

		const controls = this.state.controls;
		const rgba =
			'rgb(' + (playing ? '88' : '68') + ', 0, ' + (playing ? 150 : volume * 80 + 30) + ')';
		const rgba2 = 'rgb(' + (playing ? '104' : '68') + ', 0, ' + volume * 100 + ')';
		const rgba3 = 'rgb(104,158,205)';
		const deg = randDeg || volume * 100 * 3.6;

		const gainStyle = { height: volume * 100 + '%' };
		const pitchStyle = { width: (rate * 100).toFixed(0) + '%' };
		const loopStartStyle = { width: (loopStart / duration) * 100 + '%' };
		const loopEndStyle = { height: (loopEnd / duration) * 100 + '%' };

		const style = {
			backgroundColor: click ? rgba3 : rgba,
			backgroundImage: locked
				? 'linear-gradient(' +
					deg +
					'deg, ' +
					rgba +
					' 25%, ' +
					rgba2 +
					' 25%, ' +
					rgba +
					' 50%, ' +
					rgba2 +
					' 50%, ' +
					rgba +
					' 75%,' +
					rgba2 +
					' 75%, ' +
					rgba +
					' 100%)'
				: undefined,
			backgroundSize: 'cover',
			boxSizing: 'border-box',
			opacity: click ? 0.4 : 0.7,
		};

		if (fullscreen) {
			style.position = 'absolute';
			style.opacity = 1.0;
			style.zIndex = 10;
			style.padding = '30px';
			style.backgroundColor = 'rgb(0,0,0)';
		}

		return (
			<div
				id={id}
				ref={this.ref}
				className={'sound-canvas-point-wrap'}
				style={style}
				onMouseMove={(e) => this.onModify(e)}
				onMouseEnter={(e) => this.onMouseEnter(e)}
				onMouseLeave={(e) => this.onMouseLeave(e)}
				onMouseDown={(e) => !e.ctrlKey && this.onClick(e)}
				onContextMenu={(e) => {
					e.preventDefault();
					e.ctrlKey = true;
					this.onClick(e, true);
				}}
			>
				{this.pointRef?.current && (
					<div
						key={JSON.stringify(this.pointRef.current)}
						className={
							'sound-canvas-click-point' +
							(playing && !loopEndTrigger ? ' sound-canvas-click-point-playing' : '')
						}
						style={{
							left: this.pointRef.current.x * 100 + '%',
							top: this.pointRef.current.y * 100 + '%',
						}}
						onMouseDown={(e) => {
							console.log('mousedown point', !locked);
							e.stopPropagation();
							this.props.onLocked(!locked);
						}}
					></div>
				)}
				<div id={'p-' + id} className={'sound-canvas-point'}>
					{/* controls && !sampling &&
                        <React.Fragment>
                            <div className={"sound-canvas-point-gain"} style={gainStyle}></div>
                            <div className={"sound-canvas-point-pitch"} style={pitchStyle}></div>
                            <div className={"sound-canvas-point-loopstart"} style={loopStartStyle}></div>
                            <div className={"sound-canvas-point-loopend"} style={loopEndStyle}></div>
                        </React.Fragment>
                    */}

					{controls && filename && !error && loaded && !sampling && (
						<div className={'sound-canvas-point-info'}>
							{/*        <div>{filename}</div>
                    
                            <div>Rate: {rate.toFixed(1)}</div>
                            <div>Volume: {(volume * 100).toFixed(0)}</div>
                            
                            <div>Pan: {pan}</div>
                            <div>Loop: {(loopStart).toFixed(3)} > {(loopEnd).toFixed(3)}</div>
                            <div>Dur: {this.formatDuration(duration)}</div>
                            <div>Heat: {heat.toFixed(0)}</div>
                            */}
						</div>
					)}

					{/* controls && 
                        <div className={"sound-canvas-point-elapsed"}>
                            <Elapsed id={id} duration={duration} rate={rate} fontSize={14}/>
                        </div>
                    */}

					{/*controls &&
                        <SoundCanvasPointEffects
                            id={id}
                            key={'e'+id}
                            effects={effects}
                            onEffectBypass={(type, active)=>this.onEffectBypass(type, active)}
                            onEffectParams={(type, params)=>this.onEffectParams(type, params)}
                        />
                    */}

					<ColumnRecord
						id={id}
						sampling={sampling}
						isSampling={isSampling}
						loaded={loaded}
						loading={loading}
						error={error}
						onUpload={(buffer, filename) => this.props.onUpload(buffer, filename)}
						onMultiUpload={(files) => this.props.onMultiUpload(files)}
						onSampleRecord={(on) => this.onSampleRecord(on)}
						onCancelSampleRecord={() => this.props.onCancelSampleRecord()}
					/>
					{fullscreen && !sampling && (
						<Waveform
							id={id}
							spp={20}
							color={'#d77ab8'}
							duration={duration}
							loopStart={loop ? loopStart : undefined}
							loopEnd={loop ? loopEnd : undefined}
							duration={duration}
							enableElapsed={true}
							selectColor={'rgba(255,255,255,0.2)'}
							onSelection={(selection) => this.onLoopSelection(selection)}
						/>
					)}
				</div>

				{controls && ready && (
					<ColumnTools
						id={id}
						playing={playing}
						sampling={sampling}
						isSampling={isSampling}
						loop={loop}
						muted={muted}
						locked={locked}
						recording={recording}
						midiMapMode={midiMapMode}
						effectsEnabled={effectsEnabled}
						midiNote={midiNote}
						reversed={reversed}
						fullscreen={fullscreen}
						solo={solo}
						hovering={hovering}
						onPlay={() => this.props.onPlay({ enableElapsed: fullscreen })}
						onPause={() => this.props.onPause()}
						onSampleRecord={(on) => this.onSampleRecord(on)}
						onStop={(on) => this.props.onStop(on)}
						onLoop={(on) => this.props.onLoop(on)}
						onSolo={(on) => this.onSolo(on)}
						onMute={(on) => this.props.onMute(on)}
						onDownload={(on) => this.props.onDownload(id)}
						onLocked={(on) => this.props.onLocked(on)}
						onMidiMapMode={(on, unmap) => this.props.onMidiMapMode(on, unmap)}
						onReverse={(on) => this.props.onReverse(on)}
						onEffectsEnabled={(on) => this.props.onEffectsEnabled(on)}
						onFullscreen={(on) => this.onFullscreen(on)}
					/>
				)}

				<div className={'sound-canvas-point-loading'}>{!ready && <AiOutlineLoading />}</div>
			</div>
		);
	}
}
export default Column;
