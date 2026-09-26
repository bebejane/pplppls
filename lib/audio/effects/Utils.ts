const Utils = {
	isString: function (arg: unknown): boolean {
		return toString.call(arg) === '[object String]';
	},

	isObject: function (arg: unknown): boolean {
		return toString.call(arg) === '[object Object]';
	},

	isFunction: function (arg: unknown): boolean {
		return toString.call(arg) === '[object Function]';
	},

	isNumber: function (arg: unknown): boolean {
		return toString.call(arg) === '[object Number]' && (arg as number) === +arg;
	},

	isArray: function (arg: unknown): boolean {
		return toString.call(arg) === '[object Array]';
	},

	isInRange: function (arg: unknown, min: unknown, max: unknown): boolean {
		if (!this.isNumber(arg) || !this.isNumber(min) || !this.isNumber(max)) return false;

		return (arg as number) >= (min as number) && (arg as number) <= (max as number);
	},

	isBool: function (arg: unknown): boolean {
		return typeof arg === 'boolean';
	},

	isOscillator: function (audioNode: { toString(): string } | null | undefined): boolean {
		return !!audioNode && audioNode.toString() === '[object OscillatorNode]';
	},

	isAudioBufferSourceNode: function (
		audioNode: { toString(): string } | null | undefined,
	): boolean {
		return !!audioNode && audioNode.toString() === '[object AudioBufferSourceNode]';
	},
	// Takes a number from 0 to 1 and normalizes it to fit within range floor to ceiling
	normalize: function (num: number, floor: number, ceil: number): number {
		if (!this.isNumber(num) || !this.isNumber(floor) || !this.isNumber(ceil)) return;
		return ((ceil - floor) * num) / 1 + floor;
	},

	getDryLevel: function (mix: number): number {
		if (!this.isNumber(mix) || mix > 1 || mix < 0) return 0;
		if (mix <= 0.5) return 1;
		return 1 - (mix - 0.5) * 2;
	},

	getWetLevel: function (mix: number): number {
		if (!this.isNumber(mix) || mix > 1 || mix < 0) return 0;
		if (mix >= 0.5) return 1;
		return 1 - (0.5 - mix) * 2;
	},
}
export default Utils
