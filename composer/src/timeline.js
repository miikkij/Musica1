import WaveformPlaylist from 'waveform-playlist';
import { clipUrl } from './api.js';
import { onPlay, onStop } from './transport.js';

let playlist = null;
let ee = null;
let onSelectCallback = null;
let snapToBpm = true;
let projectBpm = 120;

// Map track objects to their original filenames (waveform-playlist strips .wav)
const trackFilenames = new WeakMap();

export async function initTimeline(projectState) {
  const container = document.getElementById('playlist-container');
  projectBpm = projectState.bpm || 120;

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
export function getPlaylist() { return playlist; }
export function onSelect(callback) { onSelectCallback = callback; }

export function setTimelineState(state) {
  if (ee) ee.emit('statechange', state);
}

export function zoomIn() { if (ee) ee.emit('zoomin'); }
export function zoomOut() { if (ee) ee.emit('zoomout'); }

export function setSnapBpm(enabled) { snapToBpm = enabled; }
export function setProjectBpm(bpm) { projectBpm = bpm; }

function snapToBar(timeInSeconds) {
  if (!snapToBpm || !projectBpm) return timeInSeconds;
  const barDuration = (4 * 60) / projectBpm;
  return Math.round(timeInSeconds / barDuration) * barDuration;
}

/**
 * Add a clip to the timeline as a new track.
 * Stores the original filename for loop/stretch operations.
 */
export function addTrackToTimeline(filename, startTime = 0) {
  if (!playlist) {
    console.warn('Timeline not initialized yet');
    return;
  }
  const snappedStart = snapToBar(startTime);
  const src = window.location.origin + clipUrl(filename);

  const trackCountBefore = playlist.tracks ? playlist.tracks.length : 0;

  playlist.load([{
    src,
    name: filename.replace('.wav', ''),
    start: snappedStart,
    gain: 1,
  }]).then(() => {
    // After load, tag the new track(s) with the original filename
    if (playlist.tracks && playlist.tracks.length > trackCountBefore) {
      const newTrack = playlist.tracks[playlist.tracks.length - 1];
      trackFilenames.set(newTrack, filename);
    }
  });
}

/**
 * Get the original WAV filename for a track object.
 */
export function getTrackFilename(track) {
  if (!track) return null;
  // Try the WeakMap first
  const stored = trackFilenames.get(track);
  if (stored) return stored;
  // Fallback: reconstruct from name
  const name = track.getName ? track.getName() : '';
  return name.endsWith('.wav') ? name : name + '.wav';
}

/**
 * Get the active (last-clicked) track from waveform-playlist.
 */
export function getActiveTrack() {
  if (!playlist) return null;
  if (typeof playlist.getActiveTrack === 'function') {
    return playlist.getActiveTrack();
  }
  if (playlist.tracks && playlist.tracks.length > 0) {
    return playlist.tracks[playlist.tracks.length - 1];
  }
  return null;
}

/**
 * Remove the active track from the playlist.
 */
export function removeActiveTrack() {
  const track = getActiveTrack();
  if (track && ee) {
    trackFilenames.delete(track);
    ee.emit('removeTrack', track);
  }
}

/**
 * Duplicate the active track's clip — places copy right after the original on a NEW track.
 * (waveform-playlist doesn't support multiple clips on one track natively)
 */
export function duplicateActiveTrack() {
  const track = getActiveTrack();
  if (!track || !playlist) return;

  const startTime = track.getStartTime();
  const duration = track.getDuration();
  const newStart = snapToBar(startTime + duration);
  const filename = getTrackFilename(track);

  if (filename) {
    addTrackToTimeline(filename, newStart);
  } else {
    // Fallback: use audio buffer directly
    const audioBuffer = track.buffer;
    if (audioBuffer) {
      playlist.load([{
        src: audioBuffer,
        name: (track.getName ? track.getName() : 'copy') + '_dup',
        start: newStart,
        gain: track.getGainLevel ? track.getGainLevel() : 1,
      }]);
    }
  }
}

/**
 * Get info about all tracks for the minimap and export.
 */
export function getTracksInfo() {
  if (!playlist || !playlist.tracks) return [];
  return playlist.tracks.map((track, i) => ({
    index: i,
    name: track.getName ? track.getName() : `Track ${i + 1}`,
    filename: getTrackFilename(track),
    start: track.getStartTime(),
    duration: track.getDuration(),
    muted: track.isMuted ? track.isMuted() : false,
    soloed: track.isSoloed ? track.isSoloed() : false,
  }));
}
