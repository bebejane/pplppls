// @ts-nocheck
let channelCount = 2;

self.onmessage = (event: MessageEvent) => {
	if (event.data.channelCount) return (channelCount = event.data.channelCount);

	const channelData = event.data.buffer;
	const totals = new Array(channelCount).fill(0.0);
	let total = 0;
	for (let sample = 0; sample < channelData[0].length; sample += 200) {
		for (let i = 0; i < channelCount; i++) {
			totals[i] += Math.abs(channelData[i][sample]);
		}
	}
	for (let i = 0; i < totals.length; i++) totals[i] = +((totals[i] / channelData[i].length) * 200);
	self.postMessage({ meter: totals });
};

export {};