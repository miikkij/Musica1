
# 🎵 Musica1

**AI-powered music composition suite** — generate audio clips with text prompts and arrange them into full songs using a built-in multi-track DAW.

Based on [RC Stable Audio Tools](https://github.com/RoyalCities/RC-stable-audio-tools) (fork of Stability AI's Stable Audio Tools) with a custom **multi-track composer** for arranging AI-generated clips into compositions.

## What's New in Musica1

- **Multi-Track Composer** — browser-based DAW with Canvas timeline, drag-and-drop, loop-extend, zoom, minimap
- **Advanced Generation Options** — full sampler control (CFG, sigma, steps, seed, negative prompt) from within the composer
- **Prompt Guide** — built-in help dialog with all instrument/timbre/FX tags and examples
- **Random Prompt Generator** — one-click tag-based prompt generation
- **Keyboard Shortcuts** — Space=play/stop, 1/2/3=mode switch, +/-=zoom, H=help
- **Auto-Save** — project state persists in localStorage automatically
- **BPM Snap** — clips snap to beat grid when moving

## Upstream Features

This repo inherits all features from RC Stable Audio Tools:

- **Dynamic Model Loading**: Enables dynamic model swaps of the base model and any future community finetune releases.

<p align="center">
  <img src="https://i.imgur.com/kB8CQ3J.gif" alt="Model Loader Gif" width="50%">
</p>


- **Random Prompt Button**: A one-click Random Prompt button tied directly onto the loaded models metadata.

<p align="center">
  <img src="https://i.imgur.com/fNEE8cR.gif" alt="Random Prompt Button Gif" width="95%">
</p>


- **BPM & Bar Selector**: BPM & Bar settings tied to the model's timing conditioning, which will auto-fill any prompt with the needed BPM/Bar info. You can also lock or unlock the BPM if you wish to randomize this as well with the Random Prompt button.

<p align="center">
  <img src="https://i.imgur.com/hcedPl5.png" alt="BPM and Bar Example Gif" width="50%">
</p>

- **Key Signature Locking**: Key signature is now tied to UI and can be locked or unlocked with the random prompt button.

<p align="center">
  <img src="https://i.imgur.com/7IXXDSZ.jpeg" alt="Key Signature Image" width="50%">
</p>

- **Automatic Sample to MIDI Converter**: The fork will automatically convert all generated samples to .MID format, enabling users to have an infinite source of MIDI.

<p align="center">
  <img src="https://i.imgur.com/R9ipGiq.gif" alt="Midi Converter Example Gif" width="50%">
</p>

- **Automatic Sample Trimming**: The fork will automatically trim all generated samples to the exact length desired for easier importing into DAWs.

<p align="center">
  <img src="https://i.imgur.com/ApH5SOM.gif" alt="Midi Converter Example Gif" width="75%">
</p>

## 🚀 Installation

### 📥 Clone the Repository

First, clone the repository to your local machine:

```bash
git clone https://github.com/miikkij/Musica1.git
cd Musica1
```

### 🔧 Setup the Environment 

#### ✅ Python Version (Important)

Use **Python 3.10**. Newer versions (e.g. 3.11+) can fail dependency resolution due to pinned packages (notably older SciPy wheels).

#### 🌐 Create a Virtual Environment

It's recommended to use a virtual environment to manage dependencies:

- **Windows:**

  ```bash
  python -m venv venv
  venv\Scripts\activate
  ```

- **macOS and Linux:**

  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

#### 📦 Install the Required Packages

Install Stable Audio Tools and the necessary packages from `setup.py`:

```bash
pip install stable-audio-tools
pip install .
```

### 🪟 Additional Step for Windows Users

To ensure Gradio uses GPU/CUDA and not default to CPU, uninstall and reinstall `torch`, `torchvision`, and `torchaudio` with the correct CUDA version:

```bash
pip uninstall -y torch torchvision torchaudio
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### 🧪 Optional (Windows / Linux): INT4 / Low-VRAM Mode (TorchAO)

This fork supports **optional** INT4 weight-only inference via TorchAO.  
It can reduce VRAM usage further, but it can be **very slow on Windows** because Triton fast-kernels are usually unavailable (falls back to slower paths). 

To enable the INT4 toggle in the UI:

**Windows (recommended, pinned):**
```bash
pip install torchao==0.12.0
```

**Linux:**
```bash
pip install torchao
```

⚠️ On Linux, using the unpinned version may require some tweaking depending on your CUDA, PyTorch, and driver versions. 

If TorchAO isn’t installed or compatible with your environment, the INT4 toggle will remain hidden/disabled.

## ⚙️ Configuration

A sample `config.json` is included in the root directory. Customize it to specify directories for custom models and outputs (.wav and .mid files will be stored here):

```json
{
    "model_directory": "models",
    "output_directory": "generations"
}
```

## 🖥️ Usage

### 🎚️ Running the Gradio Interface

Start the Gradio interface using a batch file or directly from the command line:

#### Batch file example

```batch
@echo off
cd /d path-to-your-venv/Scripts
call activate
cd /d path-to-your-stable-audio-tools
python run_gradio.py --model-config models/path-to-config/example_config.json --ckpt-path models/path-to-config/example.ckpt
pause
```

#### Basic command line example

You can launch the web UI by simply calling:

```bash
python run_gradio.py
```

This will start the gradio UI. If you're running for the first time, it will launch a model downloader interface, where you can initialize the app by downloading your first model. After downloading, you will need to restart the app to get the full UI.

When you run the app AFTER downloading a model, the full UI will launch.


#### Custom command line example

You can also launch the app with custom flags:

```bash
python run_gradio.py --model-config models/path-to-config/example_config.json --ckpt-path models/path-to-config/example.ckpt
```

### 🎶 Generating Audio and MIDI

Input prompts in the Gradio interface to generate audio and MIDI files, which will be saved as specified in `config.json`.

The interface has been expanded with Bar/BPM settings (which modifies both the user prompt + sample length conditioning), MIDI display + conversion and also features Dynamic Model Loading. 

Models must be stored inside their own sub folder along with their accompanying config files. i.e. A single finetune could have multiple checkpoints. All related checkpoints could go inside of the same "model1" subfolder but its important their associated config file is included within the same folder as the checkpoint itself.

To switch models simply pick the model you want to load using the drop down and pick "Load Model". 

### 🤗 Downloading models from HuggingFace

![hffs.gif](hffs.gif)

When you launch with `python run_gradio.py`, it will:

1. First check if the `models` folder has any model downloaded.
2. If there is a model, it will launch the full UI with that model loaded.
3. If the models folder is empty, it will launch a HFFS (HuggingFace downloader) UI, where you can either select from the preset models, or enter any HuggingFace repo id to download. (After downloading a model, you will need to restart the app to launch the full UI).
4. To customize the preset models that appear in the downloader dropdown, edit the `config.json` file to add more entries to the `hffs[0].options` array.

## Multi-Track Composer

A built-in browser-based DAW for arranging AI-generated audio clips into full compositions.

### Quick Start

Double-click `start.bat` to launch both the Gradio generator and the Composer. Or run them separately:

```bash
# Terminal 1: Audio generator
uv run python run_gradio.py

# Terminal 2: Composer
uv run python -m composer.server.app
```

Then open http://localhost:8000 in your browser.

### Setup (first time only)

The composer frontend needs to be built once:

```bash
cd composer
npm install
npm run build
```

Dependencies (FastAPI, uvicorn) should already be installed. If not:

```bash
uv pip install fastapi uvicorn
```

### How it works

1. **Generate clips** in the Gradio UI (port 7860) or directly in the Composer's sidebar
2. **Drag clips** from the clip library onto the timeline tracks
3. **Arrange** — move clips with mouse, loop-extend by dragging right edge
4. **Multiple clips per track** — drop onto existing tracks to build arrangements
5. **Play/Stop** with transport controls or Space bar — all tracks play in sync
6. **Right-click** clips for context menu (duplicate, loop x2/x4, delete)
7. **Zoom** with +/- keys or Ctrl+scroll, navigate with the minimap
8. **Export** the mix as a single WAV file
9. **Save/Load** projects — also auto-saves to localStorage

### Features

- **Canvas Timeline Engine** — custom-built DAW timeline with multi-clip tracks, waveform rendering, bar/beat grid
- **Clip Looping** — drag right edge to loop-extend, or right-click for loop x2/x4/fill
- **Minimap** — overview strip showing all clips, draggable viewport for navigation
- **Three Modes** — Cursor (seek), Move (drag clips), Select (regions) — switch with 1/2/3 keys
- **BPM Snap** — clips snap to beat boundaries when moving (toggle with toolbar)
- **Song Length** — auto-extends or set a target duration in mm:ss
- **Advanced Generation** — full sampler options modal (seed, steps, CFG, sampler, sigma, negative prompt)
- **Prompt Guide** — built-in help with all instrument/timbre/FX/behavior tags
- **Random Prompt** — generates tag-based prompts from the Foundation-1 vocabulary
- **Clip Library** — all generated WAVs with duration display, drag-and-drop
- **BPM Detection** — librosa-based detection for clips
- **Time Stretching** — stretch clips to match project BPM
- **Project Persistence** — save/load as JSON + auto-save to localStorage
- **Mix Export** — mix all tracks with volume, mute/solo, peak normalization
- **Send to Composer** — button in Gradio UI sends clips to the composer
- **Keyboard Shortcuts** — Space, 1/2/3, +/-, H (help), Delete, and more
- **Dark Theme** — consistent with the Gradio UI

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Stop |
| 1 | Cursor mode |
| 2 | Move mode |
| 3 | Select mode |
| + / = | Zoom in |
| - | Zoom out |
| Delete | Remove selected clip |
| H | Help dialog |

### Architecture

```
Browser
├── Gradio UI (port 7860) ── "Send to Composer" ──┐
└── Composer App (port 8000)                       │
    ├── Canvas Timeline Engine (custom JS)         │
    └── FastAPI Backend ◄──────────────────────────┘
        ├── /api/generate   (proxies to Gradio)
        ├── /api/clips      (list/serve WAVs)
        ├── /api/bpm        (BPM detection)
        ├── /api/project    (save/load)
        ├── /api/export     (mix to WAV)
        ├── /api/stretch    (time-stretch)
        └── /api/loop       (repeat clips)
```

### Syncing with Upstream

This repo tracks [RoyalCities/RC-stable-audio-tools](https://github.com/RoyalCities/RC-stable-audio-tools) as `upstream`:

```bash
git pull upstream main   # fetch latest changes from RC Stable Audio Tools
```

---

## 🛠️ Advanced Usage

For detailed instructions on training and inference commands, flags, and additional options, refer to the main GitHub documentation:
[Stable Audio Tools Detailed Usage](https://github.com/Stability-AI/stable-audio-tools)

---

~~I did my best to make sure the code is OS agnostic but I've only been able to test this with Windows / NVIDIA. Hopefully it works for other operating systems.~~ The project now fully supports macOS and Apple Silicon (M1 and above). Special thanks to [@cocktailpeanut](https://github.com/cocktailpeanut) for their help!

If theres any other features or tooling that you may want let me know on here or by contacting me on [Twitter](https://x.com/RoyalCities). I'm just a hobbyist but if it can be done I'll see what I can do.

Have fun!
