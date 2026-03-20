import { fetchClips, generateClip, clipUrl } from './api.js';

/**
 * Fetch all clips from the API and render them as draggable <li> elements
 * in the #clip-list element.
 */
export async function refreshClipLibrary() {
  const list = document.getElementById('clip-list');
  list.innerHTML = '<li style="color:#888;font-size:11px;padding:6px">Loading...</li>';

  let clips;
  try {
    clips = await fetchClips();
  } catch (err) {
    list.innerHTML = `<li style="color:#e94560;font-size:11px;padding:6px">Error: ${err.message}</li>`;
    return;
  }

  if (!clips || clips.length === 0) {
    list.innerHTML = '<li style="color:#888;font-size:11px;padding:6px">No clips found.</li>';
    return;
  }

  list.innerHTML = '';
  clips.forEach((clip) => {
    const li = document.createElement('li');
    li.draggable = true;

    const name = document.createElement('span');
    name.className = 'clip-name';
    name.textContent = clip.filename;

    const meta = document.createElement('span');
    meta.className = 'clip-meta';
    const dur = clip.duration != null ? `${Number(clip.duration).toFixed(2)}s` : '';
    const bpm = clip.bpm != null ? ` · ${clip.bpm} BPM` : '';
    meta.textContent = dur + bpm;

    li.appendChild(name);
    li.appendChild(meta);

    // Store clip metadata on the element for drag events
    li.dataset.clip = JSON.stringify({
      filename: clip.filename,
      duration: clip.duration ?? null,
      bpm: clip.bpm ?? null,
    });

    li.addEventListener('dragstart', (e) => {
      const clipData = JSON.parse(li.dataset.clip);
      e.dataTransfer.setData('application/json', JSON.stringify(clipData));
      e.dataTransfer.effectAllowed = 'copy';
    });

    list.appendChild(li);
  });
}

/**
 * Wire up the generate panel UI to the generateClip API.
 * @param {Object} projectState — shared state object with bpm, keyNote, keyScale
 */
export function initGeneratePanel(projectState) {
  const btn = document.getElementById('btn-generate');
  const status = document.getElementById('gen-status');

  btn.addEventListener('click', async () => {
    const prompt = document.getElementById('gen-prompt').value.trim();
    if (!prompt) {
      status.textContent = 'Please enter a prompt.';
      status.className = 'error';
      return;
    }

    const bars = parseInt(document.getElementById('gen-bars').value, 10);
    const steps = parseInt(document.getElementById('gen-steps').value, 10);
    const bpm = projectState.bpm || 120;
    const key = `${projectState.keyNote || 'C'} ${projectState.keyScale || 'minor'}`;

    btn.disabled = true;
    status.textContent = 'Generating...';
    status.className = '';

    try {
      const result = await generateClip({ prompt, bars, bpm, key, steps });
      status.textContent = `Done: ${result.filename || 'clip generated'}`;
      status.className = 'success';
      // Refresh the library so the new clip appears
      await refreshClipLibrary();
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
      status.className = 'error';
    } finally {
      btn.disabled = false;
    }
  });
}
