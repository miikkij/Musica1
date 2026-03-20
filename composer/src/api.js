/**
 * API wrapper for the Composer backend (FastAPI on port 8000).
 * All endpoints are proxied via Vite's /api prefix.
 */

const BASE = '/api';

async function handleResponse(res) {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.detail || body.message || JSON.stringify(body);
    } catch {
      // ignore parse errors
    }
    throw new Error(msg);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res;
}

/** GET /api/clips — list all WAV clips with metadata */
export async function fetchClips() {
  const res = await fetch(`${BASE}/clips`);
  return handleResponse(res);
}

/** GET /api/clips/{filename} — returns full URL for a clip */
export function clipUrl(filename) {
  return `${BASE}/clips/${encodeURIComponent(filename)}`;
}

/** POST /api/bpm — detect BPM for a given filename */
export async function detectBpm(filename) {
  const res = await fetch(`${BASE}/bpm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  });
  return handleResponse(res);
}

/**
 * POST /api/generate — proxy to Gradio to generate a new clip
 * @param {Object} params
 * @param {string} params.prompt
 * @param {number} params.bars
 * @param {number} params.bpm
 * @param {string} params.key
 * @param {number|null} params.seed
 * @param {number} params.steps
 */
export async function generateClip({ prompt, bars, bpm, key, seed = null, steps = 100 }) {
  const res = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, bars, bpm, key, seed, steps }),
  });
  return handleResponse(res);
}

/**
 * PUT /api/project/{name} — save a project
 * @param {string} name
 * @param {Object} project
 */
export async function saveProject(name, project) {
  const res = await fetch(`${BASE}/project/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  return handleResponse(res);
}

/**
 * GET /api/project/{name} — load a saved project
 * @param {string} name
 */
export async function loadProject(name) {
  const res = await fetch(`${BASE}/project/${encodeURIComponent(name)}`);
  return handleResponse(res);
}

/** GET /api/project — list all saved projects */
export async function listProjects() {
  const res = await fetch(`${BASE}/project`);
  return handleResponse(res);
}

/**
 * POST /api/export — mix down all tracks to a WAV blob
 * @param {Object} project — full project state
 */
export async function exportMix(project) {
  const res = await fetch(`${BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.detail || body.message || JSON.stringify(body);
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.blob();
}

/**
 * POST /api/stretch — time-stretch a clip to a new BPM
 * @param {string} filename
 * @param {number} originalBpm
 * @param {number} targetBpm
 */
export async function stretchClip(filename, originalBpm, targetBpm) {
  const res = await fetch(`${BASE}/stretch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, original_bpm: originalBpm, target_bpm: targetBpm }),
  });
  return handleResponse(res);
}
