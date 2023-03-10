if(!global.Global){
	global.Global = {
		fileToMimeType: (filename) => {
			if(!filename) return filename
			const file = filename.toLowerCase()
			if(file.endsWith('.mp3')) return 'audio/mpeg'
			if(file.endsWith('.mp4') || file.endsWith('.m4a')) return 'audio/mp4'
			if(file.endsWith('.wav')) return 'audio/wav'
			if(file.endsWith('.ogg')) return 'audio/ogg'
			if(file.endsWith('.aif')) return 'audio/aiff'
			if(file.endsWith('.webm')) return 'audio/webm'
			return null
		}
	}
}
export default global.Global