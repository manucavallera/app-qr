/** Three short beeps. Needs an AudioContext created from a user gesture. */
export function playReadyTone(context: AudioContext | null): void {
  if (!context) return;
  const start = context.currentTime;
  for (let index = 0; index < 3; index += 1) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.2;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + index * 0.35);
    oscillator.stop(start + index * 0.35 + 0.22);
  }
}
