import * as Tone from 'tone';

let isPlaying = false;
let onPlayCallback = null;
let onStopCallback = null;
let loopRegion = { start: 0, end: 0 };

export function initTransport(bpm) {
  Tone.getTransport().bpm.value = bpm;
  Tone.getTransport().loop = false;
}

export function setBpm(bpm) { Tone.getTransport().bpm.value = bpm; }

export function setLoop(enabled) {
  const transport = Tone.getTransport();
  transport.loop = enabled;
  if (enabled && loopRegion.end > loopRegion.start) {
    transport.loopStart = loopRegion.start;
    transport.loopEnd = loopRegion.end;
  }
}

export function setLoopRegion(start, end) {
  loopRegion = { start, end };
  const transport = Tone.getTransport();
  if (transport.loop && end > start) {
    transport.loopStart = start;
    transport.loopEnd = end;
  }
}

export function getLoopRegion() {
  return loopRegion;
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
