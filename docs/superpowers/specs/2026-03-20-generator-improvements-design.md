# Generator Improvements — Design Spec

**Date:** 2026-03-20
**Status:** Draft

## Overview

Three improvements to the Composer's generate panel: prompt autocomplete with keyboard navigation, a visible settings info block with simple/advanced modes, and persisting generator settings with project save/load.

## 1. Prompt Autocomplete

### Tag Dictionary

Extract the existing tag arrays from inside `generateRandomPrompt()` in `sidebar.js` to module-level constants so both the random prompt function and autocomplete logic can share them:

```js
const TAG_DICTIONARY = {
  instrument: ['Synth Lead', 'Synth Bass', 'Rhodes Piano', ...],
  timbre: ['Warm', 'Bright', 'Dark', ...],
  fx: ['Low Reverb', 'Medium Delay', ...],
  behavior: ['Melody', 'Chord Progression', 'Arp', ...],
};
```

| Category   | Examples                                          |
|------------|---------------------------------------------------|
| Instrument | Rhodes Piano, Synth Lead, Sub Bass, Kalimba, ...  |
| Timbre     | Warm, Bright, Dark, Soft, Crisp, Rich, Airy, ...  |
| FX         | Low Reverb, Medium Delay, High Distortion, ...    |
| Behavior   | Melody, Chord Progression, Arp, Bassline, ...     |

### Trigger Logic

- Parse the text after the last comma (or from start if no comma) as the current partial input
- Trim whitespace from the partial
- If partial is empty or fewer than 1 character, hide dropdown
- Filter tags case-insensitively: match anywhere in the tag name (not just prefix)
- Show up to 8 matching suggestions, sorted by: exact prefix match first, then contains match

### Dropdown UI

- Floating `<div>` positioned directly below the `#gen-prompt` textarea
- Each suggestion is a row showing: tag name (left) + category label in muted color (right)
- Category labels colored by type (instrument=pink, timbre=blue, FX=green, behavior=orange) matching the prompt guide colors
- Active/highlighted suggestion gets a subtle background highlight
- Dropdown has `max-height` with overflow scroll if more than 8 matches
- Z-index above other sidebar elements

### Keyboard Interaction

- `ArrowDown` / `ArrowUp`: navigate suggestions (wraps around)
- The first suggestion is auto-highlighted when the dropdown appears
- `Enter` or `Tab`: accept highlighted suggestion — replaces partial text after last comma with the full tag + `, `
- `Esc`: dismiss dropdown
- Any other key: continue filtering normally
- When dropdown is not visible, `Enter` does nothing special (textarea default)

### Mouse Interaction

- Use `mousedown` (not `click`) on suggestion rows to accept, preventing the textarea `blur` event from dismissing the dropdown before the selection registers
- Mouse hover highlights the suggestion

### Edge Cases

- If the textarea is empty and user starts typing, autocomplete activates immediately
- After accepting a suggestion, cursor is positioned after the `, ` ready for next tag
- Tags already present in the prompt are excluded from suggestions (no duplicates)
- Dropdown dismisses on blur (clicking outside textarea or dropdown) — use a short `setTimeout` (~150ms) on blur to allow mousedown on suggestions to fire first
- Programmatic value changes (e.g. random prompt button setting `.value`) do NOT trigger autocomplete since no `input` event is dispatched — this is intentional

## 2. Settings Info Block

### Replaces

The current `<span id="gen-opts-summary">` is removed. The entire `<div>` containing the Options button + summary span stays, but the `<span>` is replaced. A new `<div id="gen-info-block">` is added as a separate element between that Options row div and the Generate button.

### Layout

Located between the Options button row and the Generate button in the sidebar generate panel.

### Default Values Reference

These are the defaults from `defaultOpts` in `sidebar.js`. The "differs from defaults" logic uses these values:

| Setting        | Default          |
|----------------|------------------|
| seed           | -1 (random)      |
| steps          | 100              |
| cfg_scale      | 7.0              |
| sampler_type   | dpmpp-3m-sde     |
| sigma_min      | 0.03             |
| sigma_max      | 500.0            |
| cfg_rescale    | 0.0              |
| negative_prompt| (empty string)   |

### Simple Mode (default)

Shows only settings that differ from defaults, in a single compact line or wrapped text:

```
Steps: 150 · CFG: 9 · Seed: 42
```

If all settings are at defaults, shows: `Default settings`

### Advanced Mode

Shows all generation-specific settings in a compact 2-column grid:

```
Steps: 100        CFG: 7
Sampler: dpmpp-3m-sde
Seed: random      Rescale: 0
Sigma: 0.03–500
Neg: noise, distortion
```

- Non-default values displayed in white text
- Default values displayed in muted grey
- Negative prompt truncated with ellipsis if longer than ~40 chars

### Toggle

- Small clickable text at the top-right corner of the info block: `▸ Simple` / `▾ Advanced`
- Toggle preference saved as `summaryMode` field inside the existing `composer_gen_opts` localStorage object (values: `"simple"` or `"advanced"`)

### Styling

- Dark card background (`rgba(255,255,255,0.03)` or similar)
- Subtle border (`1px solid rgba(255,255,255,0.08)`)
- Font size: 11px
- Padding: 6px 8px
- Border radius: 4px

## 3. Persist Generator Settings

### What Gets Persisted

The `generationOpts` object includes these fields:
- seed, steps, cfg_scale, sampler_type, sigma_min, sigma_max, cfg_rescale, negative_prompt, summaryMode

The `lockKey` and `lockBpm` fields in `defaultOpts` are NOT part of `generationOpts` — they are Gradio-UI-specific toggle states and not relevant to the Composer's generation flow.

### Autosave (localStorage)

The existing `composer_gen_opts` localStorage key already persists the generation options including `summaryMode`.

Additionally, include `generationOpts` in the main autosave payload (`composer_autosave`) so that the autosave and project save formats are consistent.

### Project Save/Load

When saving a project, build the payload as:

```js
saveProject(name, { ...projectState, generationOpts: getGenOpts() })
```

Project JSON format:

```json
{
  "bpm": 120,
  "keyNote": "C",
  "keyScale": "minor",
  "masterVolume": 1,
  "engine": { "..." : "..." },
  "generationOpts": {
    "seed": -1,
    "steps": 100,
    "cfg_scale": 7.0,
    "sampler_type": "dpmpp-3m-sde",
    "sigma_min": 0.03,
    "sigma_max": 500.0,
    "cfg_rescale": 0.0,
    "negative_prompt": "",
    "summaryMode": "simple"
  }
}
```

When loading a project, if `generationOpts` is present, restore it. If absent (old projects), keep current settings. This ensures backwards compatibility.

### Cross-Module API

Export from `sidebar.js`:
- `getGenOpts()` — returns shallow copy of current `advancedOpts` object
- `setGenOpts(opts)` — merges into `advancedOpts`, saves to localStorage, updates info block display

Import paths:
- `main.js` imports `getGenOpts`, `setGenOpts` from `sidebar.js` — uses in autosave and restore
- `project.js` imports `getGenOpts`, `setGenOpts` directly from `sidebar.js` — uses in save/load

This is a direct import, not passed as a parameter. `project.js` already imports from `api.js` and `toast.js`, adding `sidebar.js` follows the same pattern.

## Files Modified

| File | Changes |
|------|---------|
| `composer/src/sidebar.js` | Extract tag arrays to module-level `TAG_DICTIONARY`, autocomplete dropdown logic, info block rendering, simple/advanced toggle, export `getGenOpts`/`setGenOpts` |
| `composer/src/main.js` | Include `generationOpts` in autosave payload, restore genOpts from autosave |
| `composer/src/project.js` | Import `getGenOpts`/`setGenOpts` from `sidebar.js`, include in project save, restore on project load |
| `composer/index.html` | Add `<div id="gen-info-block">` between options row and generate button |
| `composer/src/style.css` | Autocomplete dropdown styles, info block card styles, category color classes |

## Out of Scope

- Autocomplete for negative prompt textarea (only the main prompt gets autocomplete)
- Custom user-defined tags (only built-in Foundation-1 tags)
- Syncing settings back to the Gradio UI (one-way: DAW → Gradio API)
- The `lockKey`/`lockBpm` fields in `defaultOpts` (Gradio-specific, not used by Composer generation)
