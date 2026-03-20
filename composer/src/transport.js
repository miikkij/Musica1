import * as Tone from 'tone';

let isPlaying = false;
let onPlayCallback = null;
let onStopCallback = null;

export function initTransport(bpm) {
  Tone.getTransport().bpm.value = bpm;
  Tone.getTransport().loop = false;
}

export function setBpm(bpm) { Tone.getTransport().bpm.value = bpm; }

export function setLoop(enabled, startTime = 0, endTime = 0) {
  const transport = Tone.getTransport();
  transport.loop = enabled;
  if (enabled && endTime > startTime) {
    transport.loopStart = startTime;
    transport.loopEnd = endTime;
  }
}

export function onPlay(callback) { onPlayCallback = callback; }
export function onStop(callback) { onStopCallback = callback; }

export async function play() {
  await Tone.start();
  if (onPlayCallback) onPlayCallback();
  isPlaying = true;
}

export function stop() {
  if (onStopCallback) onStopCallback();
  isPlaying = false;
}

export function getIsPlaying() { return isPlaying; }

export function barToSeconds(bar, bpm) {
  return (bar - 1) * 4 * (60 / bpm);
}
