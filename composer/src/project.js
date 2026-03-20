import { saveProject, loadProject, listProjects, exportMix } from './api.js';

/**
 * Prompt user for a project name, then POST to /api/project/{name}.
 * @param {Object} projectState
 */
export async function saveProjectUI(projectState) {
  const name = window.prompt('Save project as:', 'my-project');
  if (!name || !name.trim()) return;

  try {
    await saveProject(name.trim(), projectState);
    alert(`Project "${name.trim()}" saved.`);
  } catch (err) {
    alert(`Failed to save project: ${err.message}`);
  }
}

/**
 * List projects, prompt user to choose one, GET it, and sync the UI.
 * @param {Object} projectState — mutated in place with loaded values
 */
export async function loadProjectUI(projectState) {
  let projects;
  try {
    projects = await listProjects();
  } catch (err) {
    alert(`Failed to list projects: ${err.message}`);
    return;
  }

  if (!projects || projects.length === 0) {
    alert('No saved projects found.');
    return;
  }

  const options = projects.map((p, i) => `${i + 1}. ${p}`).join('\n');
  const input = window.prompt(`Select a project (enter number):\n${options}`);
  if (!input) return;

  const idx = parseInt(input, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= projects.length) {
    alert('Invalid selection.');
    return;
  }

  const name = projects[idx];
  let loaded;
  try {
    loaded = await loadProject(name);
  } catch (err) {
    alert(`Failed to load project "${name}": ${err.message}`);
    return;
  }

  // Sync project state
  if (loaded.bpm != null) projectState.bpm = loaded.bpm;
  if (loaded.keyNote != null) projectState.keyNote = loaded.keyNote;
  if (loaded.keyScale != null) projectState.keyScale = loaded.keyScale;
  if (loaded.masterVolume != null) projectState.masterVolume = loaded.masterVolume;
  if (Array.isArray(loaded.tracks)) projectState.tracks = loaded.tracks;

  // Sync DOM inputs
  const bpmInput = document.getElementById('input-bpm');
  if (bpmInput && projectState.bpm) bpmInput.value = projectState.bpm;

  const keyNote = document.getElementById('select-key-note');
  if (keyNote && projectState.keyNote) keyNote.value = projectState.keyNote;

  const keyScale = document.getElementById('select-key-scale');
  if (keyScale && projectState.keyScale) keyScale.value = projectState.keyScale;

  const masterVol = document.getElementById('input-master-vol');
  if (masterVol && projectState.masterVolume != null) masterVol.value = projectState.masterVolume;

  alert(`Project "${name}" loaded. ${projectState.tracks.length} track(s).`);
}

/**
 * POST project state to /api/export, then trigger a download of the returned WAV.
 * @param {Object} projectState
 */
export async function exportMixUI(projectState) {
  if (!projectState.tracks || projectState.tracks.length === 0) {
    alert('No tracks to export. Add clips to the timeline first.');
    return;
  }

  const btn = document.getElementById('btn-export');
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Exporting...';

  try {
    const blob = await exportMix(projectState);

    // Trigger browser download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mix-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Export failed: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}
