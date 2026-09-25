/**
 * Shared primitives for WebAudio effects. Kept in their own module so effect
 * classes can import from here without creating a circular import back to
 * effects/index (whose module-eval must not depend on the effect classes).
 */
import Utils from './Utils'

export { Utils }

export const baseEffect = Object.create(null, {
	connect: {
		enumerable: true,
		value: function(audioNode) {
			this._connectedNode = audioNode
			this.outputNode.connect(audioNode);
			this.connected = true;
			return this;
		}
	},
	disconnect: {
		enumerable: true,
		value: function(audioNode) {
			if(this.connected)
				this.outputNode.disconnect(audioNode || this._connectedNode);
			this.connected = false;
			return this;
		}
	},
	params: {
		enumerable: true,
		value: function(){
			const p = {}
			Object.keys(this.defaults).forEach((k)=> p[k] = this[k])
			return p;	
		}
	},
	reset: {
		enumerable: true,
		value: function(){
			Object.keys(this.defaults).forEach((k)=> this[k] = this.defaults[k].value)
			return true
		}
	}
})

export const createEffectBase = function(context, options = {}, defaults) {
	this.context = context;
	this.options = { ...options };
	this.defaults = defaults;
	const opts = options && Object.keys(options).length ? options : {};
	for (var key in defaults) {
		this[key] = opts[key];
		this[key] =
			this[key] === undefined || this[key] === null ? defaults[key].value : this[key];
	}
	return this;
}