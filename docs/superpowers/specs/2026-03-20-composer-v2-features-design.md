# Composer v2 Features — Enhanced Timeline & Clip Management

## Overview

Enhance the existing multi-track composer with DAW-standard timeline interactions: clip looping, multi-clip tracks, zoom/scroll with minimap, loop regions, and a right-click context menu. The goal is to enable building multi-minute compositions from short AI-generated clips.

## Approach

Extend waveform-playlist's built-in capabilities rather than replacing them. The library already supports cursor/shift/select states, zoom levels, trim, and multi-track playback. We add a thin layer on top for clip looping, minimap rendering, context menus, and loop region management.

## Feature 1: Timeline Mode Toolbar

A toolbar between the transport bar and the timeline switches between mouse interaction modes.

### Modes

| Mode | Icon | Mouse Behavior | Keyboard |
|---|---|---|---|
| Cursor | `▶` | Click timeline or ruler to seek playhead | Default mode |
| Move | `↔` | Drag clips left/right (snaps to bar grid) | Delete key removes focused clip |
| Select | `[ ]` | Drag to select a time region for looping | Shift+click extends selection |

### Zoom Controls

Zoom +/- buttons on the right side of the toolbar. Also supports Ctrl+scroll (or Cmd+scroll on Mac) on the timeline area.

### Implementation

waveform-playlist states map directly:
- Cursor → `state-cursor`
- Move → `state-shift`
- Select → `state-select`

Switch via `ee.emit('statechange', 'cursor')` etc. The toolbar highlights the active mode.

### UI

```
[▶ Cursor] [↔ Move] [☐ Select]          Zoom: [-] [+]  Ctrl+Scroll
```

Rendered as a slim bar (28px height) with toggle buttons. Active mode has accent background (#e94560).

### Files

- Create: `composer/src/toolbar.js` — mode toolbar component, event wiring
- Modify: `composer/index.html` — add toolbar container between transport and main
- Modify: `composer/src/style.css` — toolbar styles
- Modify: `composer/src/main.js` — initialize toolbar, wire mode changes

## Feature 2: Clip Looping

Repeat a clip N times on the timeline so a short loop fills a longer duration.

### User Interactions

1. **Drag right edge** (Move mode) — extending a clip past its original duration automatically loops the audio. Snaps to bar boundaries.
2. **Right-click → Loop x2 / x4 / Loop to Fill** — explicit repeat count. "Loop to Fill" repeats until the song length target or next clip on the same track.

### Visual Representation

- Looped regions show dashed vertical dividers at each repeat boundary
- Repeat sections have slightly reduced opacity (0.85, 0.7, 0.6...) to indicate they are repetitions
- The original clip region is full opacity

### Backend

New endpoint `POST /api/loop`:
```json
{
  "filename": "drums_120bpm.wav",
  "repeat_count": 4
}
```

Returns `{ "output_filename": "drums_120bpm_loop4.wav" }`.

Implementation in `composer/server/services/audio.py`:
- Load WAV with pydub
- Concatenate the AudioSegment `repeat_count` times
- Save as new WAV in generations directory

### Frontend

- In Move mode, detect when a clip's right edge is dragged past its original duration
- Calculate how many repeats are needed based on the new width and bar grid
- Call `/api/loop` to create the looped WAV
- Replace the clip source with the looped WAV
- Render repeat markers as CSS overlays on the waveform

### Files

- Modify: `composer/server/services/audio.py` — add `loop_clip()` function
- Create: `composer/server/routes/loop.py` — POST `/api/loop`
- Modify: `composer/server/app.py` — register loop router
- Create: `composer/tests/test_loop.py`
- Create: `composer/src/context-menu.js` — right-click menu component
- Modify: `composer/src/timeline.js` — clip edge drag detection, loop visuals

## Feature 3: Multi-Clip Tracks

Allow multiple clips on the same track at different time positions.

### Drop Behavior

- **Drop onto an existing track's waveform area** — places the clip at the drop position (snapped to nearest bar). The clip is added to that track.
- **Drop onto empty space below all tracks** — creates a new track with the clip.
- **Drop onto sidebar clip library** — no action (already in library).

### Implementation

waveform-playlist already supports multiple clips per track via its `load()` method with `start` offsets. The current code creates a new track per drop. Change to:

1. On drop, detect which track (if any) the cursor is over
2. Calculate the bar position from the X coordinate
3. If over an existing track, add the clip to that track at the calculated start time
4. If below all tracks, create a new track

### Clip Overlap Prevention

If a dropped clip would overlap an existing clip on the same track, snap it to the nearest non-overlapping position (after the existing clip). Show a brief visual indicator if the position was adjusted.

### Project JSON Update

The existing project JSON format already supports multiple clips per track:
```json
{
  "tracks": [{
    "name": "Drums",
    "clips": [
      { "file": "intro_beat.wav", "startBar": 1, "duration": 4.0 },
      { "file": "main_beat_loop4.wav", "startBar": 5, "duration": 16.0 }
    ]
  }]
}
```

No schema change needed.

### Files

- Modify: `composer/src/main.js` — drop zone logic to detect target track
- Modify: `composer/src/timeline.js` — track detection from mouse position, add clip to existing track

## Feature 4: Minimap

A thin horizontal overview strip above the timeline showing the full composition at a glance.

### Rendering

- Canvas element, 100% width, 32px height
- Each track rendered as a thin colored horizontal bar
- Clips drawn as filled rectangles at their proportional positions
- Viewport rectangle (red border, semi-transparent fill) shows the currently visible portion of the timeline

### Interaction

- **Drag viewport rectangle** — scrolls the timeline
- **Click anywhere on minimap** — jumps the viewport to that position
- **Auto-updates** when clips are added, moved, or removed

### Implementation

Custom canvas rendering (not part of waveform-playlist). Reads track/clip data from the playlist state and renders proportionally.

On scroll or zoom events from the timeline, update the viewport rectangle position and size.

### Files

- Create: `composer/src/minimap.js` — canvas rendering, viewport drag, click-to-jump
- Modify: `composer/index.html` — add minimap container above playlist
- Modify: `composer/src/style.css` — minimap styles
- Modify: `composer/src/main.js` — initialize minimap, wire to timeline scroll/zoom events

## Feature 5: Loop Region & Seeking

Define a time region on the ruler for looped playback, and click the ruler to seek.

### Defining the Loop Region

- In **Select mode**, drag on the timeline to select a time range
- waveform-playlist fires `select` events with start/end times
- The selection is visualized as a green highlighted region on the time ruler
- Green vertical markers at loop start and end

### Activating the Loop

- The existing **Loop checkbox** in the transport bar activates looping
- When Loop is checked and a region is selected, playback loops between the region markers
- When Loop is checked with no region, playback loops the entire composition

### Seeking

- In **Cursor mode**, clicking on the time ruler or anywhere on the timeline seeks the playhead to that position
- waveform-playlist supports this via `state-cursor` — clicking sets the cursor position

### Implementation

- waveform-playlist already handles selection state (`state-select`) and cursor state (`state-cursor`)
- Listen to `select` events to capture the loop region start/end times
- Store loop region in the transport module
- On play, if loop is enabled and region is set, configure Tone.js Transport loop points
- Render loop region markers as CSS overlays on the time ruler

### Files

- Modify: `composer/src/transport.js` — store loop region, configure Tone.js loop points
- Modify: `composer/src/timeline.js` — listen to select events, render loop markers
- Modify: `composer/src/style.css` — loop region marker styles (green)

## Feature 6: Song Length Target

Optional song duration input in the transport bar.

### UI

Add to transport center section:
```
Length: [  3:30  ]
```

Input accepts `mm:ss` format. Displays "auto" when empty (timeline auto-extends).

### Behavior

- Timeline ruler always extends to at least the target length
- A subtle vertical dashed line on the timeline marks the target end point (different color from playhead — grey or dim accent)
- Clips can extend past the marker — the timeline auto-extends further if needed
- The minimap shows the full range including any overflow
- When exporting, only audio up to the last clip's end is included (not padded to target length)

### Implementation

- Store `targetLength` in project state (in seconds)
- When set, ensure the timeline's total duration is at least `targetLength`
- Render the end marker as a CSS overlay
- Export logic unchanged (already calculates duration from clip positions)

### Files

- Modify: `composer/index.html` — add length input to transport
- Modify: `composer/src/main.js` — wire length input to project state
- Modify: `composer/src/timeline.js` — ensure minimum timeline duration, render end marker
- Modify: `composer/src/style.css` — end marker style

## Feature 7: Right-Click Context Menu

A custom context menu for clips in Move mode.

### Menu Items

| Item | Action |
|---|---|
| Duplicate Clip | Copy clip and place immediately after the original |
| Loop x2 | Call `/api/loop` with repeat_count=2, replace clip |
| Loop x4 | Call `/api/loop` with repeat_count=4, replace clip |
| Loop to Fill... | Calculate repeats to fill to song end or next clip, then loop |
| ── separator ── | |
| Delete Clip | Remove clip from track |

### Implementation

- Custom HTML overlay positioned at right-click coordinates
- Only shown in Move mode (no context menu in Cursor or Select modes)
- Closes on click outside, Escape key, or menu item selection
- Positioned to stay within viewport bounds

### Files

- Create: `composer/src/context-menu.js` — menu rendering, positioning, event handling
- Modify: `composer/src/timeline.js` — right-click event listener in Move mode
- Modify: `composer/src/style.css` — context menu styles

## Dependencies

### Python (existing — no new packages)

All audio processing uses pydub and librosa which are already installed.

### JavaScript (existing — no new packages)

All features build on waveform-playlist and Tone.js already installed. The minimap uses native Canvas API.

## File Summary

### New files
- `composer/src/toolbar.js` — mode toolbar component
- `composer/src/minimap.js` — minimap canvas rendering
- `composer/src/context-menu.js` — right-click menu
- `composer/server/routes/loop.py` — loop endpoint
- `composer/tests/test_loop.py` — loop endpoint tests

### Modified files
- `composer/index.html` — toolbar container, minimap container, length input
- `composer/src/main.js` — initialize new components, updated drop logic
- `composer/src/timeline.js` — mode switching, loop visuals, multi-clip drop, select events
- `composer/src/transport.js` — loop region storage, Tone.js loop points
- `composer/src/style.css` — toolbar, minimap, context menu, loop marker styles
- `composer/server/services/audio.py` — loop_clip function
- `composer/server/app.py` — register loop router

## Constraints

- 4/4 time only (same as v1)
- Clip looping creates a new WAV file (not real-time repeat) — simpler, works with waveform-playlist's file-based model
- Minimap is read-only visualization (no editing from minimap)
- Context menu only available in Move mode
