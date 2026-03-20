#!/bin/bash
# Musica1 Setup Script — macOS / Linux
echo ""
echo "  Checking for Python..."
echo ""

if ! command -v python3 &> /dev/null; then
    echo "  Python 3 not found!"
    echo ""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  Install with: brew install python@3.10"
        echo "  Or download:  https://www.python.org/downloads/"
    else
        echo "  Ubuntu/Debian: sudo apt install python3 python3-pip"
        echo "  Fedora:        sudo dnf install python3"
        echo "  Or download:   https://www.python.org/downloads/"
    fi
    echo ""
    exit 1
fi

python3 setup_musica1.py
