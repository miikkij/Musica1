import { saveProject, loadProject, listProjects, exportMix } from './api.js';
import { toast, dialogPrompt, dialogSelect } from './toast.js';

/**
 * Prompt user for a project name, then POST to /api/project/{name}.
 */
export async function saveProjectUI(projectState) {
  const name = await dialogPrompt('Save project as:', 'my-project');
  if (!name || !name.trim()) return;

  try {
    await saveProject(name.trim(), projectState);
    toast(`Project "${name.trim()}" saved.`, 'success');
  } catch (err) {
    toast(`Failed to save project: ${err.message}`, 'error');
  }
}

/**
 * List projects, let user choose one, load it.
 */
export async function loadProjectUI(projectState) {
  let projects;
  try {
    projects = await listProjects();
  } catch (err) {
    toast(`Failed to list projects: ${err.message}`, 'error');
    return;
  }

  if (!projects || projects.length === 0) {
    toast('No saved projects found.', 'warning');
    return;
  }

  const selected = await dialogSelect('Load project:', projects);
  if (!selected) return;

  let loaded;
  try {
    loaded = await loadProject(selected);
  } catch (err) {
    toast(`Failed to load "${selected}": ${err.message}`, 'error');
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

  toast(`Project "${selected}" loaded.`, 'success');
}

/**
 * POST project state to /api/export, then trigger a download of the returned WAV.
 */
export async function exportMixUI(projectState) {
  if (!projectState.tracks || projectState.tracks.length === 0) {
    toast('No tracks to export. Add clips to the timeline first.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-export');
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Exporting...';

  try {
    const blob = await exportMix(projectState);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mix-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Mix exported!', 'success');
  } catch (err) {
    toast(`Export failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}
