FROM mcr.microsoft.com/devcontainers/base:debian-12

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Node is installed into /usr/local so it is on PATH for every user, including
# root. The Claude Code feature installs its CLI with npm as root during the
# feature phase, and falls back to installing Node 18 from NodeSource if it
# cannot find node -- a system-wide install keeps our pin.

ARG NODE_VERSION=24.19.0
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
        | tar -xJ -C /usr/local --strip-components=1 --no-same-owner \
            --exclude=CHANGELOG.md --exclude=LICENSE --exclude=README.md && \
    node --version && \
    npm --version

# npm is the /usr/local install from above, so `npm install --global` puts pnpm
# in /usr/local/bin -- on PATH for every user, same as node itself. Keep this in
# sync with the "packageManager" field in the root package.json.
ARG PNPM_VERSION=11.20.0
RUN npm install --global "pnpm@${PNPM_VERSION}" && \
    pnpm --version

USER vscode
