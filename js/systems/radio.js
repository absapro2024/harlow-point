// Radio & PA system. Radio traffic is heard only if the player carries a radio. PA is heard everywhere indoors.
export class Radio {
  constructor(G) { this.G = G; this.log = []; }
  transmit(from, text) {
    this.log.push({ t: this.G.clock.fmt(), from, text }); if (this.log.length > 60) this.log.shift();
    if (this.G.player.hasRadio) { this.G.ui.subtitle(`📻 ${from}`, text); this.G.audio.radio(); }
  }
  pa(text) { this.log.push({ t: this.G.clock.fmt(), from: 'PA', text }); this.G.ui.subtitle('📢 PA', text, 7000); this.G.audio.chime(); }
}
