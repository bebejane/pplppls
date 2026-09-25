import slice from './slice'
import findZeroCrossing from './zeroCrossing'
const trim = (buffer, opt = {sampleRate:44100, trimLeft:true, trimRight:false, level:0.05})=>{
	const level = (opt.level == null) ? 0 : Math.abs(opt.level);
	const sampleRate = opt.sampleRate || 44100;
	// how far to hunt for a zero crossing: ~8ms. Big enough to catch a crossing
	// even for low-pitched content (a 62Hz tone's nearest crossing is ~8ms away),
	// small enough that snapping never audibly shifts the attack or eats the tail.
	const maxLook = Math.max(64, Math.round(sampleRate * 0.008));
	
	var start = 0;
	var end = buffer[0].length

	if(opt.trimLeft){
		var data = buffer[0]
		for (var i = 0; i < data.length; i++) {
			if (Math.abs(data[i]) > level) {
				start = i;
				break;
			}
		}
		// snap the cut point to the nearest zero crossing so the sample starts
		// on a stationary point instead of a mid-cycle value (click)
		if (start > 0) {
			var zc = findZeroCrossing(data, start - 1, -1, maxLook);
			if (zc >= 0) start = zc;
			else start = start - 1; // everything before start is <= level: cutting one sample early is click-free
		} else {
			// recording began mid-cycle with no pre-roll silence: snap forward
			// to the next crossing (removes at most ~maxLook of near-zero onset),
			// but only take it if the crossing member is actually quieter than
			// the current first sample (keeps the attack fully intact)
			var zc = findZeroCrossing(data, 0, 1, maxLook);
			if (zc >= 0 && Math.abs(data[zc]) < Math.abs(data[0])) start = zc;
		}
	}
	if(opt.trimRight){
		var data = buffer[0]
		for (var i = data.length - 1; i >= 0; i--) {
			if (Math.abs(data[i]) > level) {
				end = i + 1;
				break;
			}
		}
		// snap the cut point forward to the next zero crossing in the
		// below-level tail so the sample also ends on a stationary point
		// (avoids a click at loop wrap); keep the crossing only if its member
		// is quieter than the current last sample
		var zc = findZeroCrossing(data, end, 1, maxLook);
		if (zc >= 0 && end > 0 && Math.abs(data[zc]) < Math.abs(data[end - 1])) end = zc + 1;
	} 

	// the two snaps may step toward each other; keep a minimum length so
	// slice() never gets a negative/zero range
	if (end <= start) end = Math.min(buffer[0].length, start + 1);
	
	console.log('trim', 'left', opt.trimLeft, 'right', opt.trimRight, start, end, 'buffer', buffer[0].length)//(start/44100)*1000)+'ms', ((start-end/44100)*1000)+'ms');
	return slice(buffer, start, end);
}
export default trim;