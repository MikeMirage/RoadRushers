/** Small local engine synthesizer. No samples, network or API keys. */
export class EngineAudio {
  enabled = false;
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled && !this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) { this.enabled = false; return false; }
      this.context = new AudioContext();
      this.oscillator = this.context.createOscillator(); this.oscillator.type = 'sawtooth';
      this.filter = this.context.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 340;
      this.gain = this.context.createGain(); this.gain.gain.value = 0;
      this.oscillator.connect(this.filter); this.filter.connect(this.gain); this.gain.connect(this.context.destination);
      this.oscillator.start();
    }
    if (this.enabled) this.context.resume().catch(() => {});
    else this.gain?.gain.setTargetAtTime(0, this.context.currentTime, 0.08);
    return this.enabled;
  }
  update(speed, running) {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.oscillator.frequency.setTargetAtTime(34 + speed * 3.6, now, 0.1);
    this.filter.frequency.setTargetAtTime(200 + speed * 18, now, 0.1);
    this.gain.gain.setTargetAtTime(this.enabled && running ? 0.025 : 0, now, 0.1);
  }
}
