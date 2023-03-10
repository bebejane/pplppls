import slice from './slice'
const trim = (buffer, opt = {sampleRate:44100, trimLeft:true, trimRight:false, level:0.05})=>{
	const level = (opt.level == null) ? 0 : Math.abs(opt.level);
	
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
	}
	if(opt.trimRight){
		var data = buffer[0]
		for (var i = data.length - 1; i >= 0; i--) {
			if (Math.abs(data[i]) > level) {
				end = i + 1;
				break;
			}
		}
	} 
	
	console.log('trim', 'left', opt.trimLeft, 'right', opt.trimRight, start, end, 'buffer', buffer[0].length)//(start/44100)*1000)+'ms', ((start-end/44100)*1000)+'ms');
	return slice(buffer, start, end);
}
export default trim;