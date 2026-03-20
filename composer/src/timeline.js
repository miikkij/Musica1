import WaveformPlaylist from 'waveform-playlist';
import { clipUrl } from './api.js';
import { onPlay, onStop } from './transport.js';

let playlist = null;
let ee = null;
let onSelectCallback = null;
let snapToBpm = true;
let projectBpm = 120;

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

export function zoomIn() {
  if (ee) ee.emit('zoomin');
}

export function zoomOut() {
  if (ee) ee.emit('zoomout');
}

export function setSnapBpm(enabled) {
  snapToBpm = enabled;
}

export function setProjectBpm(bpm) {
  projectBpm = bpm;
}

/**
 * Calculate the snap position based on BPM grid.
 * Returns the nearest bar start time in seconds.
 */
function snapToBar(timeInSeconds) {
  if (!snapToBpm || !projectBpm) return timeInSeconds;
  const barDuration = (4 * 60) / projectBpm; // 4 beats per bar in 4/4 time
  return Math.round(timeInSeconds / barDuration) * barDuration;
}

/**
 * Add a new track with a clip to the timeline.
 */
export function addTrackToTimeline(filename, startTime = 0) {
  if (!playlist) {
    console.warn('Timeline not initialized yet');
    return;
  }
  const snappedStart = snapToBar(startTime);
  const src = window.location.origin + clipUrl(filename);
  playlist.load([{
    src,
    name: filename.replace('.wav', ''),
    start: snappedStart,
    gain: 1,
  }]);
}

/**
 * Get the active (last-clicked) track from waveform-playlist.
 */
export function getActiveTrack() {
  if (!playlist) return null;
  // waveform-playlist stores the active track
  if (typeof playlist.getActiveTrack === 'function') {
    return playlist.getActiveTrack();
  }
  // Fallback: return the last track
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
    ee.emit('removeTrack', track);
  }
}

/**
 * Duplicate the active track — reloads its source at a position right after it.
 */
export function duplicateActiveTrack() {
  const track = getActiveTrack();
  if (!track || !playlist) return;

  const startTime = track.getStartTime();
  const duration = track.getDuration();
  const newStart = snapToBar(startTime + duration);

  // Get the source URL from the track's buffer
  // We need to reload from the same source
  const name = track.getName ? track.getName() : 'duplicate';

  // Create a new track with the same audio buffer
  const audioBuffer = track.buffer;
  if (audioBuffer) {
    playlist.load([{
      src: audioBuffer,
      name: name + '_copy',
      start: newStart,
      gain: track.getGainLevel ? track.getGainLevel() : 1,
    }]);
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
    start: track.getStartTime(),
    duration: track.getDuration(),
    muted: track.isMuted ? track.isMuted() : false,
    soloed: track.isSoloed ? track.isSoloed() : false,
  }));
}
