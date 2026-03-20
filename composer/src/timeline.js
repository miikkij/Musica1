import WaveformPlaylist from 'waveform-playlist';
import { clipUrl } from './api.js';
import { onPlay, onStop } from './transport.js';

let playlist = null;
let ee = null;
let onSelectCallback = null;

export async function initTimeline(projectState) {
  const container = document.getElementById('playlist-container');

  playlist = await WaveformPlaylist.init({
    container,
    timescale: true,
    mono: false,
    exclSolo: true,
    samplesPerPixel: 1000,
    waveHeight: 80,
    isAutomaticScroll: true,
    seekStyle: 'line',
    colors: {
      waveOutlineColor: '#e94560',
      timeColor: '#e0e0e0',
      fadeColor: 'rgba(233,69,96,0.5)',
    },
    controls: { show: true, width: 180 },
    zoomLevels: [250, 500, 1000, 2000, 4000],
  });

  ee = playlist.getEventEmitter();

  ee.on('select', (start, end) => {
    if (onSelectCallback) onSelectCallback(start, end);
  });

  onPlay(() => { if (ee) ee.emit('play'); });
  onStop(() => { if (ee) ee.emit('stop'); });

  return playlist;
}

export function getEventEmitter() { return ee; }

export function setTimelineState(state) {
  if (ee) ee.emit('statechange', state);
}

export function zoomIn() {
  if (ee) ee.emit('zoomin');
}

export function zoomOut() {
  if (ee) ee.emit('zoomout');
}

export function getPlaylist() {
  return playlist;
}

export function onSelect(callback) {
  onSelectCallback = callback;
}

export function addTrackToTimeline(filename, startTime = 0) {
  if (!playlist) {
    console.warn('Timeline not initialized yet');
    return;
  }
  const src = window.location.origin + clipUrl(filename);
  // Use playlist.load() with the track config array
  playlist.load([{
    src,
    name: filename.replace('.wav', ''),
    start: startTime,
    gain: 1,
  }]);
}
