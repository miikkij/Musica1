import { fetchClips, generateClip, clipUrl } from './api.js';
import { showDialog } from './toast.js';

/** Default sampler options */
const defaultOpts = {
  seed: -1,
  steps: 100,
  cfg_scale: 7.0,
  sampler_type: 'dpmpp-3m-sde',
  sigma_min: 0.03,
  sigma_max: 500.0,
  cfg_rescale: 0.0,
  negative_prompt: '',
  lockKey: true,
  lockBpm: true,
};

/** Current advanced options (persisted in localStorage) */
let advancedOpts = { ...defaultOpts };
try {
  const saved = localStorage.getItem('composer_gen_opts');
  if (saved) Object.assign(advancedOpts, JSON.parse(saved));
} catch { /* ignore */ }

function saveOpts() {
  localStorage.setItem('composer_gen_opts', JSON.stringify(advancedOpts));
}

/**
 * Fetch all clips from the API and render them as draggable <li> elements.
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

/** Show the advanced options modal */
function showOptionsModal() {
  const html = `
    <div style="display:flex;flex-direction:column;gap:10px;min-width:320px;font-size:12px;">
      <label>Seed (-1 = random)
        <input type="number" id="opt-seed" value="${advancedOpts.seed}" style="width:100%">
      </label>
      <label>Steps
        <input type="range" id="opt-steps" min="10" max="500" step="1" value="${advancedOpts.steps}" style="width:100%">
        <span id="opt-steps-val">${advancedOpts.steps}</span>
      </label>
      <label>CFG Scale
        <input type="range" id="opt-cfg" min="0" max="25" step="0.1" value="${advancedOpts.cfg_scale}" style="width:100%">
        <span id="opt-cfg-val">${advancedOpts.cfg_scale}</span>
      </label>
      <label>Sampler
        <select id="opt-sampler" style="width:100%">
          ${['dpmpp-2m-sde', 'dpmpp-3m-sde', 'k-heun', 'k-lms', 'k-dpmpp-2s-ancestral', 'k-dpm-2', 'k-dpm-fast']
            .map(s => `<option value="${s}" ${s === advancedOpts.sampler_type ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </label>
      <div style="display:flex;gap:8px;">
        <label style="flex:1">Sigma Min
          <input type="number" id="opt-smin" value="${advancedOpts.sigma_min}" step="0.01" min="0" max="2" style="width:100%">
        </label>
        <label style="flex:1">Sigma Max
          <input type="number" id="opt-smax" value="${advancedOpts.sigma_max}" step="0.1" min="0" max="1000" style="width:100%">
        </label>
      </div>
      <label>CFG Rescale
        <input type="range" id="opt-cfgr" min="0" max="1" step="0.01" value="${advancedOpts.cfg_rescale}" style="width:100%">
        <span id="opt-cfgr-val">${advancedOpts.cfg_rescale}</span>
      </label>
      <label>Negative Prompt
        <textarea id="opt-neg" rows="2" style="width:100%;resize:vertical">${advancedOpts.negative_prompt}</textarea>
      </label>
    </div>
  `;

  showDialog('Generation Options', html, [
    { label: 'Reset Defaults', action: () => {
      Object.assign(advancedOpts, defaultOpts);
      saveOpts();
      updateSummary();
    }},
    { label: 'Apply', primary: true, action: () => {
      advancedOpts.seed = parseInt(document.getElementById('opt-seed').value) || -1;
      advancedOpts.steps = parseInt(document.getElementById('opt-steps').value) || 100;
      advancedOpts.cfg_scale = parseFloat(document.getElementById('opt-cfg').value) || 7.0;
      advancedOpts.sampler_type = document.getElementById('opt-sampler').value;
      advancedOpts.sigma_min = parseFloat(document.getElementById('opt-smin').value) || 0.03;
      advancedOpts.sigma_max = parseFloat(document.getElementById('opt-smax').value) || 500;
      advancedOpts.cfg_rescale = parseFloat(document.getElementById('opt-cfgr').value) || 0;
      advancedOpts.negative_prompt = document.getElementById('opt-neg').value.trim();
      saveOpts();
      updateSummary();
    }},
  ]);

  // Live value display for sliders
  setTimeout(() => {
    const stepsSlider = document.getElementById('opt-steps');
    const cfgSlider = document.getElementById('opt-cfg');
    const cfgrSlider = document.getElementById('opt-cfgr');
    if (stepsSlider) stepsSlider.oninput = () => document.getElementById('opt-steps-val').textContent = stepsSlider.value;
    if (cfgSlider) cfgSlider.oninput = () => document.getElementById('opt-cfg-val').textContent = cfgSlider.value;
    if (cfgrSlider) cfgrSlider.oninput = () => document.getElementById('opt-cfgr-val').textContent = cfgrSlider.value;
  }, 50);
}

/** Show prompt help dialog */
function showPromptHelp() {
  const html = `
    <div style="font-size:12px;max-width:500px;max-height:400px;overflow-y:auto;line-height:1.5;">
      <h4 style="color:#e94560;margin:0 0 8px">How to Write Prompts</h4>
      <p>Foundation-1 uses <b>tag-based prompts</b>. Combine tags from these categories:</p>

      <h4 style="color:#4dabf7;margin:12px 0 4px">1. Instrument (pick one or two)</h4>
      <p style="color:#aaa">Synth Lead, Synth Bass, Rhodes Piano, Grand Piano, Pluck, Pad, Bell,
      FM Synth, Violin, Cello, Flute, Pan Flute, Marimba, Electric Guitar,
      Saxophone, Alto Sax, Sub Bass, Reese Bass, Harp, Trumpet, Brass,
      Kalimba, Vibraphone, Acoustic Guitar, Church Organ, Choir, Texture...</p>

      <h4 style="color:#4dabf7;margin:12px 0 4px">2. Timbre (1-3 descriptors)</h4>
      <p style="color:#aaa">Warm, Bright, Dark, Soft, Crisp, Rich, Airy, Thick, Gritty, Smooth,
      Metallic, Spacey, Vintage, Clean, Ambient, Wide, Tight, Deep, Analog,
      Punchy, Breathy, Glassy, Fat, Hollow, Dreamy, Sparkly...</p>

      <h4 style="color:#4dabf7;margin:12px 0 4px">3. FX (optional)</h4>
      <p style="color:#aaa">Low/Medium/High Reverb, Low/Medium/High Delay,
      Ping Pong Delay, Low/Medium/High Distortion, Phaser, Chorus, Flanger...</p>

      <h4 style="color:#4dabf7;margin:12px 0 4px">4. Musical Behavior (optional)</h4>
      <p style="color:#aaa">Melody, Chord Progression, Arp, Bassline, Rolling, Staccato,
      Legato, Slow/Medium/Fast Speed, Simple, Complex, Triplets, Alternating...</p>

      <h4 style="color:#e94560;margin:12px 0 8px">Example Prompts</h4>
      <p style="color:#ccc;background:#111;padding:6px;border-radius:4px;font-family:monospace;font-size:11px">
        Rhodes Piano, Warm, Rich, Vintage, Medium Reverb, Chord Progression, Slow Speed
      </p>
      <p style="color:#ccc;background:#111;padding:6px;border-radius:4px;font-family:monospace;font-size:11px;margin-top:4px">
        Sub Bass, Gritty, Dark, Thick, Bassline, 303, Acid
      </p>
      <p style="color:#ccc;background:#111;padding:6px;border-radius:4px;font-family:monospace;font-size:11px;margin-top:4px">
        Kalimba, Sparkly, Bright, Airy, Medium Reverb, Arp, Fast Speed
      </p>

      <h4 style="color:#4dabf7;margin:12px 0 4px">Tips</h4>
      <ul style="color:#aaa;padding-left:16px">
        <li>BPM, Bars, Key are set automatically from project settings</li>
        <li>Start simple (instrument + 2-3 timbre tags), add more if needed</li>
        <li>Seed = -1 means random. Set a specific seed to reproduce results</li>
        <li>More steps = better quality but slower (75-150 is good)</li>
        <li>CFG scale controls how closely it follows the prompt (5-9 works well)</li>
      </ul>
    </div>
  `;

  showDialog('Prompt Guide', html, [
    { label: 'OK', primary: true, action: () => {} },
  ]);
}

/** Update the options summary text */
function updateSummary() {
  const el = document.getElementById('gen-opts-summary');
  if (!el) return;

  const parts = [];
  if (advancedOpts.steps !== 100) parts.push(`${advancedOpts.steps} steps`);
  if (advancedOpts.cfg_scale !== 7.0) parts.push(`CFG ${advancedOpts.cfg_scale}`);
  if (advancedOpts.sampler_type !== 'dpmpp-3m-sde') parts.push(advancedOpts.sampler_type);
  if (advancedOpts.seed !== -1) parts.push(`seed ${advancedOpts.seed}`);
  if (advancedOpts.negative_prompt) parts.push('neg prompt');

  el.textContent = parts.length > 0 ? parts.join(' · ') : 'defaults';
}

/**
 * Wire up the generate panel UI to the generateClip API.
 */
export function initGeneratePanel(projectState) {
  const btn = document.getElementById('btn-generate');
  const status = document.getElementById('gen-status');

  // Options button
  const optsBtn = document.getElementById('btn-gen-options');
  if (optsBtn) optsBtn.addEventListener('click', showOptionsModal);

  // Help button
  const helpBtn = document.getElementById('btn-gen-help');
  if (helpBtn) helpBtn.addEventListener('click', showPromptHelp);

  // Random prompt button
  const randBtn = document.getElementById('btn-random-prompt');
  if (randBtn) {
    randBtn.addEventListener('click', () => {
      const prompt = generateRandomPrompt();
      document.getElementById('gen-prompt').value = prompt;
    });
  }

  // Initial summary
  updateSummary();

  btn.addEventListener('click', async () => {
    const prompt = document.getElementById('gen-prompt').value.trim();
    if (!prompt) {
      status.textContent = 'Please enter a prompt.';
      status.className = 'error';
      return;
    }

    const bars = parseInt(document.getElementById('gen-bars').value, 10);
    const bpm = projectState.bpm || 120;
    const key = `${projectState.keyNote || 'C'} ${projectState.keyScale || 'minor'}`;

    btn.disabled = true;
    status.textContent = 'Generating...';
    status.className = '';

    try {
      const result = await generateClip({
        prompt,
        bars,
        bpm,
        key,
        seed: advancedOpts.seed,
        steps: advancedOpts.steps,
        cfg_scale: advancedOpts.cfg_scale,
        sampler_type: advancedOpts.sampler_type,
        sigma_min: advancedOpts.sigma_min,
        sigma_max: advancedOpts.sigma_max,
        cfg_rescale: advancedOpts.cfg_rescale,
        negative_prompt: advancedOpts.negative_prompt,
      });
      status.textContent = `Done: ${result.filename || 'clip generated'}`;
      status.className = 'success';
      await refreshClipLibrary();
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
      status.className = 'error';
    } finally {
      btn.disabled = false;
    }
  });
}

/** Generate a random prompt combining instrument + timbre + optional FX */
function generateRandomPrompt() {
  const instruments = [
    'Synth Lead', 'Synth Bass', 'Rhodes Piano', 'Grand Piano', 'Pluck', 'Pad',
    'Bell', 'FM Synth', 'Violin', 'Cello', 'Flute', 'Pan Flute', 'Marimba',
    'Electric Guitar', 'Alto Sax', 'Sub Bass', 'Reese Bass', 'Harp', 'Trumpet',
    'Kalimba', 'Vibraphone', 'Acoustic Guitar', 'Church Organ', 'Texture',
    'Digital Piano', 'Supersaw', 'Wavetable Bass', 'Electric Bass', 'Brass',
    'Saxophone', 'Choir', 'Felt Piano', 'Harpsichord', 'Music Box', 'Glockenspiel',
  ];
  const timbres = [
    'Warm', 'Bright', 'Dark', 'Soft', 'Crisp', 'Rich', 'Airy', 'Thick',
    'Gritty', 'Smooth', 'Metallic', 'Spacey', 'Vintage', 'Clean', 'Ambient',
    'Wide', 'Tight', 'Deep', 'Analog', 'Punchy', 'Breathy', 'Glassy', 'Fat',
    'Hollow', 'Dreamy', 'Sparkly', 'Present', 'Silky', 'Round', 'Snappy',
  ];
  const fx = [
    'Low Reverb', 'Medium Reverb', 'High Reverb', 'Low Delay', 'Medium Delay',
    'High Delay', 'Low Distortion', 'Medium Distortion', 'Phaser', 'Chorus',
    '', '', '', '', // weight toward no FX
  ];
  const behaviors = [
    'Melody', 'Chord Progression', 'Arp', 'Bassline', 'Rolling', 'Staccato',
    'Slow Speed', 'Medium Speed', 'Fast Speed', 'Simple', 'Complex',
    '', '', '', // weight toward no behavior
  ];

  const pick = (arr, n) => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n).filter(Boolean);
  };

  const parts = [
    ...pick(instruments, 1),
    ...pick(timbres, 2 + Math.floor(Math.random() * 2)),
    ...pick(fx, 1),
    ...pick(behaviors, 1),
  ];

  return parts.filter(Boolean).join(', ');
}
