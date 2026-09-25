import Visualizer from './Visualizer'
const words = [
    ' ',
    'Arse',
    'Bloody',
    'Bugger',
    'Cow',
    'Crap',
    'Damn',
    'Ginger',
    'Git',
    'God',
    'Goddam',
    'Jesus Christ',
    'Minger',
    'Sod-off',
    'Arsehole',
    'Balls',
    'Bint',
    'Bitch',
    'Bollocks',
    'Bullshit',
    'Feck',
    'Munter',
    'Pissed',
    'Shit',
    'Son of a bitch',
    'Tits',
    'Bastard',
    'Beaver',
    'Beef curtains',
    'Bellend',
    'Bloodclaat',
    'Clunge',
    'Cock',
    'Dick',
    'Dickhead',
    'Fanny',
    'Flaps',
    'Gash',
    'Knob',
    'Minge',
    'Prick',
    'Punani',
    'Pussy',
    'Snatch',
    'Twat',
    'Cunt',
    'Fuck',
    'Motherfucker'
]
class BloodyVisualizer extends Visualizer {
    constructor(props) {
        super(props);
        this.type = 'volume'
        this.levels = []
        this.alpha = 0.0;
    }
    update(volume){
        volume = volume*2
        this.levels.push(volume)
        if(this.levels.length < this.state.speed) return
        const avg = this.levels.reduce((a, b) => (a + b)) / this.levels.length;
        this.levels = []
        const idx = parseInt((words.length/100)*avg)
        const word = idx+1 > words.length ? words[words.length-1] : words[idx]
        this.clear()
        this.alpha = avg/100;
        this.ctx.globalAlpha = this.alpha;
        this.ctx.font = (this.width/8)*(volume/100) + 'px Arial';
        this.ctx.fillStyle = this.state.color
        this.ctx.textAlign = 'center'; 
        this.ctx.textBaseline = 'middle'; 
        this.ctx.fillText(word.toUpperCase(), this.width/2, this.height/2);
        
    }
}
export default BloodyVisualizer;
