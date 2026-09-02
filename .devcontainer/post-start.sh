#!/bin/bash
set -euo pipefail

sudo chown -R vscode:vscode \
    /home/vscode/.claude

# Claude looks for ~/.claude.json, which would be lost on every container
# rebuild. Keeping the real file in .claude/ puts it on the cached volume, and
# the symlink keeps Claude none the wiser.
if [ ! -f /home/vscode/.claude/.claude.json ]; then
    echo "{}" > /home/vscode/.claude/.claude.json
fi

ln -sf /home/vscode/.claude/.claude.json /home/vscode/.claude.json

pnpm install
