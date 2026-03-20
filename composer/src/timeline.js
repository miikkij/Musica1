import WaveformPlaylist from 'waveform-playlist';
import { clipUrl } from './api.js';
import { onPlay, onStop } from './transport.js';

let playlist = null;
let ee = null;

export async function initTimeline(projectState) {
  const container = document.getElementById('playlist-container');

  // WaveformPlaylist.init() returns a Promise that resolves to the playlist instance
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

  onPlay(() => { if (ee) ee.emit('play'); });
  onStop(() => { if (ee) ee.emit('stop'); });

  return playlist;
}

export function getEventEmitter() { return ee; }

export function addTrackToTimeline(filename, startTime = 0) {
  if (!ee) {
    console.warn('Timeline not initialized yet');
    return;
  }
  // Use full URL so waveform-playlist can fetch the audio
  const src = window.location.origin + clipUrl(filename);
  ee.emit('newtrack', {
    src,
    name: filename.replace('.wav', ''),
    start: startTime,
    gain: 1,
  });
}
