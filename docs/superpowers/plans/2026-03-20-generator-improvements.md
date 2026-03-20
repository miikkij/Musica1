# Generator Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Composer's generate panel with prompt autocomplete, a settings info block with simple/advanced modes, and persistence of generator settings in project save/load.

**Architecture:** All changes are frontend-only (no backend modifications). The tag dictionary is extracted to module-level constants in `sidebar.js`. The autocomplete dropdown is a DOM element managed by `sidebar.js`. The info block replaces the old summary span. `getGenOpts()`/`setGenOpts()` are exported for cross-module access by `main.js` and `project.js`.

**Tech Stack:** Vanilla JS (ES modules), CSS, HTML. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-20-generator-improvements-design.md`

---

### Task 1: Extract Tag Dictionary to Module-Level Constants

**Files:**
- Modify: `composer/src/sidebar.js:326-364` (the `generateRandomPrompt` function and its local arrays)

- [ ] **Step 1: Create `TAG_DICTIONARY` at module level**

At the top of `sidebar.js` (after the imports, before `defaultOpts`), add the tag dictionary. Move the arrays out of `generateRandomPrompt()`:

```js
/** Tag dictionary for autocomplete and random prompt generation */
const TAG_DICTIONARY = {
  instrument: [
    'Synth Lead', 'Synth Bass', 'Rhodes Piano', 'Grand Piano', 'Pluck', 'Pad',
    'Bell', 'FM Synth', 'Violin', 'Cello', 'Flute', 'Pan Flute', 'Marimba',
    'Electric Guitar', 'Alto Sax', 'Sub Bass', 'Reese Bass', 'Harp', 'Trumpet',
    'Kalimba', 'Vibraphone', 'Acoustic Guitar', 'Church Organ', 'Texture',
    'Digital Piano', 'Supersaw', 'Wavetable Bass', 'Electric Bass', 'Brass',
    'Saxophone', 'Choir', 'Felt Piano', 'Harpsichord', 'Music Box', 'Glockenspiel',
  ],
  timbre: [
    'Warm', 'Bright', 'Dark', 'Soft', 'Crisp', 'Rich', 'Airy', 'Thick',
    'Gritty', 'Smooth', 'Metallic', 'Spacey', 'Vintage', 'Clean', 'Ambient',
    'Wide', 'Tight', 'Deep', 'Analog', 'Punchy', 'Breathy', 'Glassy', 'Fat',
    'Hollow', 'Dreamy', 'Sparkly', 'Present', 'Silky', 'Round', 'Snappy',
  ],
  fx: [
    'Low Reverb', 'Medium Reverb', 'High Reverb', 'Low Delay', 'Medium Delay',
    'High Delay', 'Low Distortion', 'Medium Distortion', 'Phaser', 'Chorus',
  ],
  behavior: [
    'Melody', 'Chord Progression', 'Arp', 'Bassline', 'Rolling', 'Staccato',
    'Slow Speed', 'Medium Speed', 'Fast Speed', 'Simple', 'Complex', 'Triplets', 'Alternating',
  ],
};

/** Flat list of all tags with category labels for autocomplete */
const ALL_TAGS = Object.entries(TAG_DICTIONARY).flatMap(
  ([category, tags]) => tags.map(tag => ({ tag, category }))
);
```

- [ ] **Step 2: Refactor `generateRandomPrompt()` to use `TAG_DICTIONARY`**

Replace the function body to reference `TAG_DICTIONARY` instead of local arrays. Remove the empty-string weighting entries (those were for random generation only — keep them inline):

```js
function generateRandomPrompt() {
  const fx = [...TAG_DICTIONARY.fx, '', '', '', ''];
  const behaviors = [...TAG_DICTIONARY.behavior, '', '', ''];

  const pick = (arr, n) => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n).filter(Boolean);
  };

  const parts = [
    ...pick(TAG_DICTIONARY.instrument, 1),
    ...pick(TAG_DICTIONARY.timbre, 2 + Math.floor(Math.random() * 2)),
    ...pick(fx, 1),
    ...pick(behaviors, 1),
  ];

  return parts.filter(Boolean).join(', ');
}
```

- [ ] **Step 3: Verify random prompt still works**

Run: `cd composer && npx vite --host` (dev server)
Click the dice button in the generate panel — random prompts should still generate correctly.

- [ ] **Step 4: Commit**

```bash
git add composer/src/sidebar.js
git commit -m "refactor: extract tag dictionary to module-level constants in sidebar.js"
```

---

### Task 2: Prompt Autocomplete Dropdown — CSS

**Files:**
- Modify: `composer/src/style.css` (append after line 909, end of file)

- [ ] **Step 1: Add autocomplete dropdown styles**

Append to `style.css`:

```css
/* ── Prompt Autocomplete ───────────────────────────────────────────────── */
#prompt-autocomplete {
  display: none;
  position: absolute;
  left: 12px;
  right: 12px;
  background: var(--bg-dark);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 4px 4px;
  max-height: 240px;
  overflow-y: auto;
  z-index: 50;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

#prompt-autocomplete.visible {
  display: block;
}

.ac-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 12px;
}

.ac-item:hover,
.ac-item.active {
  background: var(--accent3);
}

.ac-tag {
  color: var(--text);
}

.ac-category {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ac-cat-instrument { color: var(--accent); }
.ac-cat-timbre { color: #4dabf7; }
.ac-cat-fx { color: #4caf82; }
.ac-cat-behavior { color: #f59e0b; }
```

- [ ] **Step 2: Commit**

```bash
git add composer/src/style.css
git commit -m "style: add autocomplete dropdown CSS"
```

---

### Task 3: Prompt Autocomplete Dropdown — HTML Container

**Files:**
- Modify: `composer/index.html:49` (after the `#gen-prompt` textarea)

- [ ] **Step 1: Add autocomplete container**

The `#generate-panel` div needs `position: relative` so the autocomplete dropdown can position itself absolutely within it. Add the autocomplete div right after the textarea.

Change `index.html` line 49 from:
```html
          <textarea id="gen-prompt" placeholder="Enter prompt... (e.g. Rhodes Piano, Warm, Rich, Chord Progression)" rows="3"></textarea>
```
to:
```html
          <textarea id="gen-prompt" placeholder="Enter prompt... (e.g. Rhodes Piano, Warm, Rich, Chord Progression)" rows="3"></textarea>
          <div id="prompt-autocomplete"></div>
```

Also add to `style.css` — make `#generate-panel` position relative (add to existing rule at line 223):

```css
#generate-panel {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  position: relative;
}
```

- [ ] **Step 2: Commit**

```bash
git add composer/index.html composer/src/style.css
git commit -m "feat: add autocomplete dropdown container to generate panel"
```

---

### Task 4: Prompt Autocomplete Dropdown — Logic

**Files:**
- Modify: `composer/src/sidebar.js` (add new functions after `TAG_DICTIONARY`/`ALL_TAGS`, wire up in `initGeneratePanel`)

- [ ] **Step 1: Add autocomplete filtering and rendering functions**

Add after `ALL_TAGS` definition in `sidebar.js`:

```js
/** Autocomplete state */
let acHighlight = 0;
let acVisible = false;
let acFiltered = [];
let acBlurTimeout = null;

/** Get the partial text being typed after the last comma */
function getPartialTag(textarea) {
  const val = textarea.value.substring(0, textarea.selectionStart);
  const lastComma = val.lastIndexOf(',');
  return (lastComma === -1 ? val : val.substring(lastComma + 1)).trim();
}

/** Get tags already used in the prompt */
function getUsedTags(textarea) {
  return textarea.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
}

/** Filter and render autocomplete suggestions */
function updateAutocomplete(textarea) {
  const dropdown = document.getElementById('prompt-autocomplete');
  const partial = getPartialTag(textarea);

  if (partial.length < 1) {
    hideAutocomplete();
    return;
  }

  const used = getUsedTags(textarea);
  const lower = partial.toLowerCase();

  // Filter: exclude already-used tags, match anywhere in name
  const matches = ALL_TAGS.filter(({ tag }) => {
    if (used.includes(tag.toLowerCase())) return false;
    return tag.toLowerCase().includes(lower);
  });

  // Sort: prefix matches first, then contains
  matches.sort((a, b) => {
    const aPrefix = a.tag.toLowerCase().startsWith(lower) ? 0 : 1;
    const bPrefix = b.tag.toLowerCase().startsWith(lower) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return a.tag.localeCompare(b.tag);
  });

  acFiltered = matches.slice(0, 8);

  if (acFiltered.length === 0) {
    hideAutocomplete();
    return;
  }

  acHighlight = 0;
  renderAutocomplete(dropdown);
  dropdown.classList.add('visible');
  acVisible = true;
}

/** Render the filtered suggestions into the dropdown */
function renderAutocomplete(dropdown) {
  dropdown.innerHTML = acFiltered.map((item, i) => `
    <div class="ac-item${i === acHighlight ? ' active' : ''}" data-index="${i}">
      <span class="ac-tag">${item.tag}</span>
      <span class="ac-category ac-cat-${item.category}">${item.category}</span>
    </div>
  `).join('');
}

/** Hide the autocomplete dropdown */
function hideAutocomplete() {
  const dropdown = document.getElementById('prompt-autocomplete');
  if (dropdown) dropdown.classList.remove('visible');
  acVisible = false;
  acFiltered = [];
}

/** Accept the currently highlighted suggestion */
function acceptSuggestion(textarea) {
  if (!acVisible || acFiltered.length === 0) return false;

  const selected = acFiltered[acHighlight];
  if (!selected) return false;

  const val = textarea.value;
  const cursorPos = textarea.selectionStart;
  const beforeCursor = val.substring(0, cursorPos);
  const afterCursor = val.substring(cursorPos);

  const lastComma = beforeCursor.lastIndexOf(',');
  const before = lastComma === -1 ? '' : beforeCursor.substring(0, lastComma + 1) + ' ';
  const newVal = before + selected.tag + ', ' + afterCursor.trimStart();

  textarea.value = newVal;
  const newPos = before.length + selected.tag.length + 2;
  textarea.setSelectionRange(newPos, newPos);

  hideAutocomplete();
  return true;
}
```

- [ ] **Step 2: Wire up event listeners in `initGeneratePanel`**

Inside `initGeneratePanel()`, after the existing random prompt button wiring (around line 278), add:

```js
  // Autocomplete
  const promptTextarea = document.getElementById('gen-prompt');
  const acDropdown = document.getElementById('prompt-autocomplete');

  promptTextarea.addEventListener('input', () => {
    updateAutocomplete(promptTextarea);
  });

  promptTextarea.addEventListener('keydown', (e) => {
    if (!acVisible) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      acHighlight = (acHighlight + 1) % acFiltered.length;
      renderAutocomplete(acDropdown);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      acHighlight = (acHighlight - 1 + acFiltered.length) % acFiltered.length;
      renderAutocomplete(acDropdown);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (acceptSuggestion(promptTextarea)) {
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      hideAutocomplete();
    }
  });

  promptTextarea.addEventListener('blur', () => {
    // Delay to allow mousedown on suggestions to fire first
    acBlurTimeout = setTimeout(() => hideAutocomplete(), 150);
  });

  promptTextarea.addEventListener('focus', () => {
    if (acBlurTimeout) clearTimeout(acBlurTimeout);
  });

  acDropdown.addEventListener('mousedown', (e) => {
    e.preventDefault(); // Prevent textarea blur
    const item = e.target.closest('.ac-item');
    if (item) {
      acHighlight = parseInt(item.dataset.index, 10);
      acceptSuggestion(promptTextarea);
      promptTextarea.focus();
    }
  });

  acDropdown.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.ac-item');
    if (item) {
      acHighlight = parseInt(item.dataset.index, 10);
      renderAutocomplete(acDropdown);
    }
  });
```

- [ ] **Step 3: Manual test**

In dev server:
1. Type "Rho" in the prompt textarea — should see "Rhodes Piano" suggested with "instrument" label
2. Press ArrowDown/ArrowUp to navigate
3. Press Enter to accept — should insert "Rhodes Piano, " and hide dropdown
4. Type "War" — should see "Warm" suggested
5. Press Esc — dropdown should dismiss
6. Type "Warm" again after it's already in the prompt — should NOT show "Warm" in suggestions (dedup)

- [ ] **Step 4: Commit**

```bash
git add composer/src/sidebar.js
git commit -m "feat: add prompt autocomplete with keyboard navigation and tag suggestions"
```

---

### Task 5: Settings Info Block — HTML and CSS

**Files:**
- Modify: `composer/index.html:53-56` (the options button row)
- Modify: `composer/src/style.css` (append info block styles)

- [ ] **Step 1: Update HTML — replace summary span, add info block div**

In `index.html`, change lines 53-56 from:
```html
          <div style="display:flex;gap:4px;margin-bottom:6px;">
            <button id="btn-gen-options" class="btn-sm" style="flex:1">Options</button>
            <span id="gen-opts-summary" style="flex:2;color:#888;font-size:10px;align-self:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">defaults</span>
          </div>
```
to:
```html
          <div style="display:flex;gap:4px;margin-bottom:6px;">
            <button id="btn-gen-options" class="btn-sm" style="flex:1">Options</button>
          </div>
          <div id="gen-info-block"></div>
```

- [ ] **Step 2: Add info block CSS**

Append to `style.css`:

```css
/* ── Generation Info Block ─────────────────────────────────────────────── */
#gen-info-block {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 6px 8px;
  margin-bottom: 6px;
  font-size: 11px;
  line-height: 1.5;
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.info-toggle {
  color: #666;
  font-size: 10px;
  cursor: pointer;
  user-select: none;
  border: none;
  background: none;
  padding: 0;
}

.info-toggle:hover {
  color: #999;
}

.info-simple {
  color: #888;
}

.info-simple .info-val {
  color: var(--text);
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 12px;
  color: #666;
}

.info-grid .info-val {
  color: #666;
}

.info-grid .info-changed {
  color: var(--text);
}

.info-neg {
  grid-column: 1 / -1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 3: Commit**

```bash
git add composer/index.html composer/src/style.css
git commit -m "feat: add settings info block HTML container and CSS styles"
```

---

### Task 6: Settings Info Block — Rendering Logic

**Files:**
- Modify: `composer/src/sidebar.js` (rewrite `updateSummary()`, add toggle logic, add `summaryMode` to opts)

- [ ] **Step 1: Add `summaryMode` to `defaultOpts` and update rendering**

In `sidebar.js`, add `summaryMode: 'simple'` to `defaultOpts`:

```js
const defaultOpts = {
  seed: -1,
  steps: 100,
  cfg_scale: 7.0,
  sampler_type: 'dpmpp-3m-sde',
  sigma_min: 0.03,
  sigma_max: 500.0,
  cfg_rescale: 0.0,
  negative_prompt: '',
  summaryMode: 'simple',
  lockKey: true,
  lockBpm: true,
};
```

- [ ] **Step 2: Rewrite `updateSummary()` to render info block**

Replace the existing `updateSummary()` function (around line 240) with:

```js
/** Render the settings info block */
function updateSummary() {
  const el = document.getElementById('gen-info-block');
  if (!el) return;

  const mode = advancedOpts.summaryMode || 'simple';
  const toggleLabel = mode === 'simple' ? '▸ Advanced' : '▾ Simple';

  const d = defaultOpts;
  const o = advancedOpts;

  if (mode === 'simple') {
    const parts = [];
    if (o.steps !== d.steps) parts.push(`Steps: <span class="info-val">${o.steps}</span>`);
    if (o.cfg_scale !== d.cfg_scale) parts.push(`CFG: <span class="info-val">${o.cfg_scale}</span>`);
    if (o.sampler_type !== d.sampler_type) parts.push(`<span class="info-val">${o.sampler_type}</span>`);
    if (o.seed !== d.seed) parts.push(`Seed: <span class="info-val">${o.seed}</span>`);
    if (o.cfg_rescale !== d.cfg_rescale) parts.push(`Rescale: <span class="info-val">${o.cfg_rescale}</span>`);
    if (o.sigma_min !== d.sigma_min || o.sigma_max !== d.sigma_max) parts.push(`Sigma: <span class="info-val">${o.sigma_min}–${o.sigma_max}</span>`);
    if (o.negative_prompt) {
      const neg = o.negative_prompt.length > 30 ? o.negative_prompt.substring(0, 30) + '...' : o.negative_prompt;
      parts.push(`Neg: <span class="info-val">${neg}</span>`);
    }

    el.innerHTML = `
      <div class="info-header">
        <span class="info-simple">${parts.length > 0 ? parts.join(' · ') : 'Default settings'}</span>
        <span class="info-toggle" id="info-toggle-btn">${toggleLabel}</span>
      </div>`;
  } else {
    const cls = (key, val) => {
      if (key === 'seed') return val !== d.seed ? 'info-changed' : '';
      if (key === 'steps') return val !== d.steps ? 'info-changed' : '';
      if (key === 'cfg_scale') return val !== d.cfg_scale ? 'info-changed' : '';
      if (key === 'sampler_type') return val !== d.sampler_type ? 'info-changed' : '';
      if (key === 'cfg_rescale') return val !== d.cfg_rescale ? 'info-changed' : '';
      if (key === 'sigma') return (o.sigma_min !== d.sigma_min || o.sigma_max !== d.sigma_max) ? 'info-changed' : '';
      if (key === 'negative_prompt') return val ? 'info-changed' : '';
      return '';
    };

    const seedStr = o.seed === -1 ? 'random' : String(o.seed);
    const negStr = o.negative_prompt
      ? (o.negative_prompt.length > 40 ? o.negative_prompt.substring(0, 40) + '...' : o.negative_prompt)
      : '(none)';

    el.innerHTML = `
      <div class="info-header">
        <span style="color:#666;font-size:10px">Settings</span>
        <span class="info-toggle" id="info-toggle-btn">${toggleLabel}</span>
      </div>
      <div class="info-grid">
        <span>Steps: <span class="info-val ${cls('steps', o.steps)}">${o.steps}</span></span>
        <span>CFG: <span class="info-val ${cls('cfg_scale', o.cfg_scale)}">${o.cfg_scale}</span></span>
        <span>Sampler: <span class="info-val ${cls('sampler_type', o.sampler_type)}">${o.sampler_type}</span></span>
        <span>Seed: <span class="info-val ${cls('seed', o.seed)}">${seedStr}</span></span>
        <span>Sigma: <span class="info-val ${cls('sigma', null)}">${o.sigma_min}–${o.sigma_max}</span></span>
        <span>Rescale: <span class="info-val ${cls('cfg_rescale', o.cfg_rescale)}">${o.cfg_rescale}</span></span>
        <span class="info-neg">Neg: <span class="info-val ${cls('negative_prompt', o.negative_prompt)}">${negStr}</span></span>
      </div>`;
  }

  // Wire toggle click
  const toggleBtn = document.getElementById('info-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      advancedOpts.summaryMode = mode === 'simple' ? 'advanced' : 'simple';
      saveOpts();
      updateSummary();
    });
  }
}
```

- [ ] **Step 3: Manual test**

In dev server:
1. Info block should show "Default settings" with "▸ Advanced" toggle
2. Click "▸ Advanced" — should expand to show all settings in grid, all muted grey
3. Open Options dialog, change steps to 150, click Apply — info block should show "Steps: 150" in white (simple mode) or highlighted in advanced mode
4. Refresh page — mode preference and settings should persist

- [ ] **Step 4: Commit**

```bash
git add composer/src/sidebar.js
git commit -m "feat: add settings info block with simple/advanced toggle"
```

---

### Task 7: Export `getGenOpts` / `setGenOpts` from Sidebar

**Files:**
- Modify: `composer/src/sidebar.js` (add two exported functions at bottom, before `generateRandomPrompt`)

- [ ] **Step 1: Add exported functions**

Add near the bottom of `sidebar.js`, after `updateSummary()`:

```js
/** Get current generation options (shallow copy, excludes lockKey/lockBpm) */
export function getGenOpts() {
  const { lockKey, lockBpm, ...opts } = advancedOpts;
  return { ...opts };
}

/** Set generation options from external source (project load, autosave restore) */
export function setGenOpts(opts) {
  if (!opts || typeof opts !== 'object') return;
  const { lockKey, lockBpm, ...safeOpts } = opts;
  Object.assign(advancedOpts, safeOpts);
  saveOpts();
  updateSummary();
}
```

- [ ] **Step 2: Commit**

```bash
git add composer/src/sidebar.js
git commit -m "feat: export getGenOpts/setGenOpts from sidebar for cross-module access"
```

---

### Task 8: Persist Generator Settings in Autosave

**Files:**
- Modify: `composer/src/main.js:2` (add import)
- Modify: `composer/src/main.js:58-69` (autoSave function)
- Modify: `composer/src/main.js:48-56` (restore from saved state)

- [ ] **Step 1: Add imports**

In `main.js` line 2, change:
```js
import { refreshClipLibrary, initGeneratePanel } from './sidebar.js';
```
to:
```js
import { refreshClipLibrary, initGeneratePanel, getGenOpts, setGenOpts } from './sidebar.js';
```

- [ ] **Step 2: Include genOpts in autoSave**

In the `autoSave()` function (around line 58), change:
```js
function autoSave() {
  try {
    const engineState = getState();
    const state = {
      ...projectState,
      engine: engineState,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Autosave failed:', e);
  }
}
```
to:
```js
function autoSave() {
  try {
    const engineState = getState();
    const state = {
      ...projectState,
      engine: engineState,
      generationOpts: getGenOpts(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Autosave failed:', e);
  }
}
```

- [ ] **Step 3: Restore genOpts from autosave**

After the existing `projectState` initialization (after line 56) and after `initGeneratePanel` is called (around line 146), add restoration. The best place is right after `initGeneratePanel(projectState)` on line 146:

```js
initGeneratePanel(projectState);

// Restore generation opts from autosave
if (saved?.generationOpts) {
  setGenOpts(saved.generationOpts);
}
```

- [ ] **Step 4: Manual test**

1. Change some generation options (e.g. steps to 150)
2. Wait 3 seconds for autosave
3. Refresh page — settings should be restored
4. Info block should show the restored settings

- [ ] **Step 5: Commit**

```bash
git add composer/src/main.js
git commit -m "feat: persist generator settings in localStorage autosave"
```

---

### Task 9: Persist Generator Settings in Project Save/Load

**Files:**
- Modify: `composer/src/project.js:1` (add imports from sidebar)
- Modify: `composer/src/project.js:7-17` (`saveProjectUI`)
- Modify: `composer/src/project.js:22-68` (`loadProjectUI`)

- [ ] **Step 1: Add imports**

In `project.js` line 1-2, change:
```js
import { saveProject, loadProject, listProjects, exportMix } from './api.js';
import { toast, dialogPrompt, dialogSelect } from './toast.js';
```
to:
```js
import { saveProject, loadProject, listProjects, exportMix } from './api.js';
import { toast, dialogPrompt, dialogSelect } from './toast.js';
import { getGenOpts, setGenOpts } from './sidebar.js';
```

- [ ] **Step 2: Include genOpts in project save**

In `saveProjectUI()`, change the `saveProject` call (around line 12) from:
```js
    await saveProject(name.trim(), projectState);
```
to:
```js
    await saveProject(name.trim(), { ...projectState, generationOpts: getGenOpts() });
```

- [ ] **Step 3: Restore genOpts on project load**

In `loadProjectUI()`, after the existing state sync block (after line 66, before the success toast), add:
```js
  // Restore generation options if present
  if (loaded.generationOpts) {
    setGenOpts(loaded.generationOpts);
  }
```

- [ ] **Step 4: Manual test**

1. Set steps to 200, CFG to 9 in the Options dialog
2. Save project as "test-gen-opts"
3. Reset options to defaults (open Options, click Reset Defaults)
4. Load project "test-gen-opts" — steps should be 200, CFG should be 9
5. Info block should reflect the loaded settings

- [ ] **Step 5: Commit**

```bash
git add composer/src/project.js
git commit -m "feat: include generator settings in project save/load"
```

---

### Task 10: Build and Final Verification

**Files:**
- None (build step only)

- [ ] **Step 1: Build production frontend**

```bash
cd composer && npm run build
```

Verify no build errors.

- [ ] **Step 2: Test with production build**

Stop any running dev servers. Start backend:
```bash
uv run python -m composer.server.app
```

Open `http://localhost:8000` and verify:
1. Autocomplete works when typing in the prompt textarea
2. Info block shows with Simple/Advanced toggle
3. Changing options updates the info block
4. Settings survive page refresh (localStorage)
5. Settings save/load with projects
6. Random prompt button still works
7. Generate button still works (sends correct parameters)

- [ ] **Step 3: Commit build**

```bash
git add composer/dist/
git commit -m "build: rebuild frontend with generator improvements"
```
