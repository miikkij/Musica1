#!/usr/bin/env python3
"""
Musica1 Setup Script
Checks all dependencies and sets up the environment for first-time users.
Run this before using Musica1 for the first time.

Usage:
  python setup_musica1.py
"""

import subprocess
import sys
import os
import platform
import json

# ANSI colors (works on Windows 10+ and Unix)
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

def ok(msg):
    print(f"  {GREEN}[OK]{RESET}  {msg}")

def fail(msg):
    print(f"  {RED}[!!]{RESET}  {msg}")

def warn(msg):
    print(f"  {YELLOW}[??]{RESET}  {msg}")

def info(msg):
    print(f"  {DIM}      {msg}{RESET}")

def tip(msg):
    print(f"         {CYAN}{msg}{RESET}")

def header(msg):
    print(f"\n  {BOLD}{msg}{RESET}")
    print(f"  {'─' * 50}")

def run(cmd, capture=True, cwd=None):
    """Run a command and return (success, output)."""
    try:
        result = subprocess.run(
            cmd, capture_output=capture, text=True, timeout=300,
            shell=isinstance(cmd, str), cwd=cwd
        )
        return result.returncode == 0, result.stdout.strip() if capture else ""
    except FileNotFoundError:
        return False, ""
    except subprocess.TimeoutExpired:
        return False, "timeout"
    except Exception as e:
        return False, str(e)

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

# ─────────────────────────────────────────────────────────────────────────────

def check_python():
    header("1/8  Python")
    v = sys.version_info
    ver_str = f"{v.major}.{v.minor}.{v.micro}"

    if v.major < 3 or (v.major == 3 and v.minor < 10):
        fail(f"Python {ver_str} — need 3.10 or higher")
        info("Python 3.10.x is recommended for best compatibility.")
        info("")
        tip("Download: https://www.python.org/downloads/")
        if platform.system() == "Windows":
            tip("Or:       winget install Python.Python.3.10")
        return False

    ok(f"Python {ver_str}")
    return True


def check_uv():
    header("2/8  uv (fast Python package manager)")
    found, version = run(["uv", "--version"])

    if not found:
        fail("uv is not installed")
        info("uv is used to manage the Python virtual environment and packages.")
        info("It's much faster than pip and handles everything automatically.")
        info("")

        system = platform.system()
        if system == "Windows":
            tip("Install option 1:  powershell -c \"irm https://astral.sh/uv/install.ps1 | iex\"")
            tip("Install option 2:  pip install uv")
            tip("Install option 3:  winget install astral-sh.uv")
        elif system == "Darwin":
            tip("Install option 1:  brew install uv")
            tip("Install option 2:  curl -LsSf https://astral.sh/uv/install.sh | sh")
        else:
            tip("Install:  curl -LsSf https://astral.sh/uv/install.sh | sh")
        return False

    ok(f"{version}")
    return True


def check_node():
    header("3/8  Node.js & npm (for Composer frontend)")
    found, version = run(["node", "--version"])

    if not found:
        fail("Node.js is not installed")
        info("Node.js is needed to build the Composer's browser interface.")
        info("LTS (Long Term Support) version is recommended.")
        info("")

        system = platform.system()
        if system == "Windows":
            tip("Download:  https://nodejs.org/ (click LTS)")
            tip("Or:        winget install OpenJS.NodeJS.LTS")
        elif system == "Darwin":
            tip("Install:   brew install node")
        else:
            tip("Ubuntu:    sudo apt install nodejs npm")
            tip("Or:        https://nodejs.org/")
        return False

    ok(f"Node.js {version}")

    found, npm_ver = run(["npm", "--version"])
    if found:
        ok(f"npm {npm_ver}")
    else:
        fail("npm not found (normally comes with Node.js)")
        return False

    return True


def check_git():
    header("4/8  Git")
    found, version = run(["git", "--version"])

    if not found:
        fail("Git is not installed")
        info("Git is needed for version control and pulling updates.")
        info("")
        tip("Download: https://git-scm.com/downloads")
        return False

    ok(version)
    return True


def check_gpu():
    header("5/8  GPU & CUDA")
    system = platform.system()

    if system == "Darwin":
        machine = platform.machine()
        if machine == "arm64":
            ok(f"Apple Silicon ({machine}) — will use MPS acceleration")
        else:
            warn(f"Intel Mac ({machine}) — GPU acceleration is limited")
            info("Generation will be slower but will still work.")
        return True

    # Windows / Linux — check NVIDIA
    found, output = run(["nvidia-smi",
        "--query-gpu=name,driver_version,memory.total",
        "--format=csv,noheader,nounits"])

    if not found:
        warn("No NVIDIA GPU detected (or drivers not installed)")
        info("Musica1 can run on CPU but audio generation will be very slow.")
        info("")
        if system == "Windows":
            tip("NVIDIA drivers: https://www.nvidia.com/drivers")
        else:
            tip("NVIDIA drivers: https://docs.nvidia.com/cuda/")
        return True  # not fatal — CPU still works

    for line in output.strip().split("\n"):
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 3:
            name, driver, mem = parts[0], parts[1], parts[2]
            ok(f"{name} — {mem} MB VRAM — Driver {driver}")
        else:
            ok(f"GPU: {line.strip()}")

    return True


def setup_python_env():
    header("6/8  Python packages")
    venv_dir = os.path.join(PROJECT_DIR, ".venv")

    # Create venv if missing
    if not os.path.exists(venv_dir):
        info("Creating virtual environment (.venv/)...")
        success, _ = run(["uv", "venv", ".venv"], cwd=PROJECT_DIR, capture=False)
        if not success:
            fail("Failed to create virtual environment")
            tip("Try manually: cd Musica1 && uv venv .venv")
            return False

    ok("Virtual environment (.venv/)")

    # Install project dependencies
    info("Installing Python packages (first time may take 2-5 minutes)...")
    success, _ = run(["uv", "pip", "install", "-e", "."], cwd=PROJECT_DIR, capture=False)
    if not success:
        fail("Failed to install Python packages")
        tip("Try manually: cd Musica1 && uv pip install -e .")
        return False
    ok("Project packages installed")

    # FastAPI + uvicorn for composer
    success, _ = run(["uv", "run", "python", "-c", "import fastapi; import uvicorn"], cwd=PROJECT_DIR)
    if not success:
        info("Installing FastAPI + uvicorn (Composer backend)...")
        run(["uv", "pip", "install", "fastapi", "uvicorn"], cwd=PROJECT_DIR, capture=False)
    ok("FastAPI + uvicorn")

    # Check PyTorch + CUDA/MPS
    success, output = run(["uv", "run", "python", "-c", "\n".join([
        "import torch",
        "print(f'PyTorch {torch.__version__}')",
        "if torch.cuda.is_available():",
        "    print(f'CUDA {torch.version.cuda} — GPU: {torch.cuda.get_device_name(0)}')",
        "elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():",
        "    print('MPS (Apple Silicon) — GPU acceleration active')",
        "else:",
        "    print('CPU only — no GPU acceleration')",
    ])], cwd=PROJECT_DIR)

    if success:
        for line in output.strip().split("\n"):
            if "CPU only" in line:
                warn(line)
                if platform.system() == "Windows":
                    info("To enable CUDA, reinstall PyTorch:")
                    tip("uv pip uninstall -y torch torchvision torchaudio")
                    tip("uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121")
            else:
                ok(line)
    else:
        fail("Could not verify PyTorch installation")

    return True


def setup_composer_frontend():
    header("7/8  Composer frontend (browser UI)")
    composer_dir = os.path.join(PROJECT_DIR, "composer")

    if not os.path.exists(composer_dir):
        fail("composer/ directory not found")
        info("The repository may be incomplete. Try: git checkout main")
        return False

    node_modules = os.path.join(composer_dir, "node_modules")
    dist_dir = os.path.join(composer_dir, "dist")

    # npm install
    if not os.path.exists(node_modules):
        info("Installing npm packages...")
        success, _ = run(["npm", "install"], cwd=composer_dir, capture=False)
        if not success:
            fail("npm install failed")
            tip(f"Try manually: cd {composer_dir} && npm install")
            return False

    ok("npm packages installed")

    # Build frontend
    if not os.path.exists(dist_dir):
        info("Building the Composer frontend...")
        success, _ = run(["npm", "run", "build"], cwd=composer_dir, capture=False)
        if not success:
            fail("Frontend build failed")
            tip(f"Try manually: cd {composer_dir} && npm run build")
            return False

    ok("Frontend built (composer/dist/)")
    return True


def check_models():
    header("8/8  AI Models")
    models_dir = os.path.join(PROJECT_DIR, "models")

    if not os.path.exists(models_dir):
        os.makedirs(models_dir, exist_ok=True)

    model_found = False
    if os.path.exists(models_dir):
        for entry in os.listdir(models_dir):
            entry_path = os.path.join(models_dir, entry)
            if os.path.isdir(entry_path):
                has_weights = any(
                    f.endswith(('.safetensors', '.ckpt', '.pt'))
                    for f in os.listdir(entry_path)
                )
                if has_weights:
                    ok(f"Model: {entry}")
                    model_found = True

    if not model_found:
        warn("No models downloaded yet — that's OK!")
        info("The first time you run Musica1, it shows a model downloader.")
        info("Recommended model: RoyalCities/Foundation-1")
        info("")
        tip("Or download manually from HuggingFace into the models/ folder")

    return True


def print_summary(results):
    print(f"\n  {BOLD}{'═' * 50}{RESET}")
    print(f"  {BOLD}  RESULTS{RESET}")
    print(f"  {'═' * 50}\n")

    all_ok = all(results.values())
    critical_ok = results.get("Python", False) and results.get("uv", False) and results.get("Node.js", False)

    for name, passed in results.items():
        status = f"{GREEN}OK{RESET}" if passed else f"{RED}NEEDS FIX{RESET}"
        print(f"    {status:>20s}   {name}")

    print()

    if all_ok:
        print(f"  {GREEN}{BOLD}Everything is ready!{RESET}\n")
        print(f"  {BOLD}How to start Musica1:{RESET}\n")

        if platform.system() == "Windows":
            print(f"    Option 1:  Double-click {CYAN}start.bat{RESET}\n")
            print(f"    Option 2:  Run in two terminals:")
        else:
            print(f"    Run in two terminals:")

        print(f"      Terminal 1:  {CYAN}uv run python run_gradio.py{RESET}")
        print(f"      Terminal 2:  {CYAN}uv run python -m composer.server.app{RESET}")
        print()
        print(f"    Then open in your browser:")
        print(f"      {CYAN}http://localhost:7860{RESET}  ← Audio Generator (Gradio)")
        print(f"      {CYAN}http://localhost:8000{RESET}  ← Multi-Track Composer")
        print()

    elif critical_ok:
        print(f"  {YELLOW}{BOLD}Almost there!{RESET}")
        print(f"  Some optional items need attention (see above).")
        print(f"  You can still try running Musica1.\n")

    else:
        print(f"  {RED}{BOLD}Some prerequisites are missing.{RESET}")
        print(f"  Install the items marked NEEDS FIX above,")
        print(f"  then run this script again:\n")
        print(f"    {CYAN}python setup_musica1.py{RESET}\n")


def main():
    if platform.system() == "Windows":
        os.system("")  # enable ANSI escape codes

    print()
    print(f"  {BOLD}{CYAN}╔════════════════════════════════════════════════╗{RESET}")
    print(f"  {BOLD}{CYAN}║                                                ║{RESET}")
    print(f"  {BOLD}{CYAN}║   🎵  Musica1 Setup                           ║{RESET}")
    print(f"  {BOLD}{CYAN}║   AI Music Composition Suite                   ║{RESET}")
    print(f"  {BOLD}{CYAN}║                                                ║{RESET}")
    print(f"  {BOLD}{CYAN}╚════════════════════════════════════════════════╝{RESET}")
    print()
    print(f"  {DIM}System: {platform.system()} {platform.machine()} | Python {sys.version.split()[0]}{RESET}")
    print(f"  {DIM}Project: {PROJECT_DIR}{RESET}")

    results = {}

    # Phase 1: Prerequisites
    results["Python"] = check_python()
    results["uv"] = check_uv()
    results["Node.js & npm"] = check_node()
    results["Git"] = check_git()
    results["GPU"] = check_gpu()

    prereqs_ok = results["Python"] and results["uv"] and results["Node.js & npm"]

    if prereqs_ok:
        # Phase 2: Setup
        results["Python packages"] = setup_python_env()
        results["Composer frontend"] = setup_composer_frontend()
        results["AI Models"] = check_models()
    else:
        print()
        warn("Skipping setup — install the prerequisites above first")

    print_summary(results)


if __name__ == "__main__":
    main()
