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
 * @param {Object} params — all generation parameters
 */
export async function generateClip(params) {
  const body = {
    prompt: params.prompt,
    bars: params.bars ?? 4,
    bpm: params.bpm ?? 120,
    key: params.key ?? 'C minor',
    seed: params.seed ?? -1,
    steps: params.steps ?? 100,
    cfg_scale: params.cfg_scale ?? 7.0,
    sampler_type: params.sampler_type ?? 'dpmpp-3m-sde',
    sigma_min: params.sigma_min ?? 0.03,
    sigma_max: params.sigma_max ?? 500.0,
    cfg_rescale: params.cfg_rescale ?? 0.0,
    negative_prompt: params.negative_prompt ?? '',
  };
  const res = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
 * POST /api/loop — repeat a clip N times
 * @param {string} filename
 * @param {number} repeatCount
 */
export async function loopClip(filename, repeatCount) {
  const res = await fetch(`${BASE}/loop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, repeat_count: repeatCount }),
  });
  return handleResponse(res);
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
