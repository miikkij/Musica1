# Generator Improvements — Design Spec

**Date:** 2026-03-20
**Status:** Draft

## Overview

Three improvements to the Composer's generate panel: prompt autocomplete with keyboard navigation, a visible settings info block with simple/advanced modes, and persisting generator settings with project save/load.

## 1. Prompt Autocomplete

### Tag Dictionary

Reuse the existing tag arrays from `generateRandomPrompt()` in `sidebar.js`, organized by category:

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
- `Enter` or `Tab`: accept highlighted suggestion — replaces partial text after last comma with the full tag + `, `
- `Esc`: dismiss dropdown
- Any other key: continue filtering normally
- When dropdown is not visible, `Enter` does nothing special (textarea default)

### Mouse Interaction

- Click on a suggestion to accept it (same as Enter)
- Mouse hover highlights the suggestion

### Edge Cases

- If the textarea is empty and user starts typing, autocomplete activates immediately
- After accepting a suggestion, cursor is positioned after the `, ` ready for next tag
- Tags already present in the prompt are excluded from suggestions (no duplicates)
- Dropdown dismisses on blur (clicking outside textarea or dropdown)

## 2. Settings Info Block

### Replaces

The current `<span id="gen-opts-summary">` (tiny text next to Options button) is replaced with a styled info block `<div id="gen-info-block">`.

### Layout

Located between the Options button row and the Generate button in the sidebar generate panel.

### Simple Mode (default)

Shows only settings that differ from defaults, in a single compact line or wrapped text:

```
Steps: 150 · CFG: 9 · Seed: 42
```

If all settings are at defaults, shows: `Default settings`

### Advanced Mode

Shows all generation-specific settings in a compact 2-column grid:

```
Steps: 150        CFG: 7
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
- Toggle preference saved to localStorage key `composer_summary_mode` (values: `simple` or `advanced`)

### Styling

- Dark card background (`rgba(255,255,255,0.03)` or similar)
- Subtle border (`1px solid rgba(255,255,255,0.08)`)
- Font size: 11px
- Padding: 6px 8px
- Border radius: 4px

## 3. Persist Generator Settings

### Autosave (localStorage)

The existing `composer_gen_opts` localStorage key already persists:
- seed, steps, cfg_scale, sampler_type, sigma_min, sigma_max, cfg_rescale, negative_prompt

Add `summaryMode` to the same stored object.

No other autosave changes needed — the gen opts are already saved independently of the main autosave.

### Project Save/Load

When saving a project (via `saveProjectUI` or autosave), include a `generationOpts` key in the project payload:

```json
{
  "bpm": 120,
  "keyNote": "C",
  "keyScale": "minor",
  "masterVolume": 1,
  "engine": { ... },
  "generationOpts": {
    "seed": -1,
    "steps": 150,
    "cfg_scale": 7.0,
    "sampler_type": "dpmpp-3m-sde",
    "sigma_min": 0.03,
    "sigma_max": 500.0,
    "cfg_rescale": 0.0,
    "negative_prompt": ""
  }
}
```

When loading a project, if `generationOpts` is present, restore it. If absent (old projects), keep current settings. This ensures backwards compatibility.

### Cross-Module API

Export from `sidebar.js`:
- `getGenOpts()` — returns current `advancedOpts` object (shallow copy)
- `setGenOpts(opts)` — merges into `advancedOpts`, saves to localStorage, updates info block display

Called from:
- `main.js` `autoSave()` — calls `getGenOpts()` to include in saved state
- `main.js` restore logic — calls `setGenOpts()` when restoring from autosave
- `project.js` `saveProjectUI()` — calls `getGenOpts()` to include in project
- `project.js` `loadProjectUI()` — calls `setGenOpts()` when loading a project

## Files Modified

| File | Changes |
|------|---------|
| `composer/src/sidebar.js` | Tag dictionary, autocomplete dropdown logic, info block rendering, simple/advanced toggle, export getGenOpts/setGenOpts |
| `composer/src/main.js` | Include genOpts in autosave payload, restore genOpts from autosave, pass setGenOpts to project.js |
| `composer/src/project.js` | Include genOpts in project save, restore on project load |
| `composer/index.html` | Replace summary span with info block container div |
| `composer/src/style.css` | Autocomplete dropdown styles, info block card styles, category color classes |

## Out of Scope

- Autocomplete for negative prompt textarea (only the main prompt gets autocomplete)
- Custom user-defined tags (only built-in Foundation-1 tags)
- Syncing settings back to the Gradio UI (one-way: DAW → Gradio API)
