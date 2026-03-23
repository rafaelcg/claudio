#!/usr/bin/env bash
set -euo pipefail
# Claudio Code — instala o CLI globalmente (https://github.com/rafaelcg/claudio)
# Pacote npm: @claudio-code/cli (o nome `claudio` sem escopo já está ocupado no npm)

GH_REPO="${CLAUDIO_INSTALL_GITHUB_REPO:-rafaelcg/claudio}"
INSTALL_DIR="${CLAUDIO_INSTALL_DIR:-$HOME/.local/bin}"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required for the npm install path. Install Node.js from https://nodejs.org/ first."
  echo "Or set CLAUDIO_SKIP_NPM=1 to use only GitHub binary download."
  if [ "${CLAUDIO_SKIP_NPM:-}" != "1" ]; then
    exit 1
  fi
fi

install_from_npm() {
  npm install -g @claudio-code/cli@latest
}

if [ "${CLAUDIO_SKIP_NPM:-}" != "1" ] && command -v npm >/dev/null 2>&1; then
  if install_from_npm 2>/dev/null; then
    echo "Installed @claudio-code/cli via npm. Run: claudio --version"
    exit 0
  fi
  echo "npm: @claudio-code/cli is not on the registry yet (publish the package first), or install failed."
  echo "Trying GitHub release binary..."
fi

# --- GitHub releases (same layout as packages/opencode/script/build.ts) ---
resolve_asset() {
  local os="" arch=""
  case "$(uname -s)" in
    Darwin) os="darwin" ;;
    Linux) os="linux" ;;
    MINGW*|MSYS*|CYGWIN*) os="windows" ;;
    *)
      echo "Unsupported OS: $(uname -s)"
      return 1
      ;;
  esac
  case "$(uname -m)" in
    arm64|aarch64) arch="arm64" ;;
    x86_64|amd64) arch="x64" ;;
    *)
      echo "Unsupported CPU: $(uname -m)"
      return 1
      ;;
  esac
  if [ "$os" = "linux" ]; then
    echo "claudio-${os}-${arch}.tar.gz"
  else
    echo "claudio-${os}-${arch}.zip"
  fi
}

ASSET="$(resolve_asset)" || exit 1
URL="https://github.com/${GH_REPO}/releases/latest/download/${ASSET}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if ! curl -fsSL "$URL" -o "${TMP}/${ASSET}"; then
  echo ""
  echo "Could not download ${URL}"
  echo "No npm package and no matching GitHub release asset yet."
  echo ""
  echo "Build locally (from repo root, with Bun installed):"
  echo "  bun install"
  echo "  cd packages/opencode && bun run build -- --single"
  echo "Then put the binary on your PATH (see the folder under dist/, e.g.):"
  echo "  export PATH=\"\$(pwd)/dist/claudio-darwin-arm64/bin:\$PATH\""
  echo "Use ls dist/ to pick the claudio-* folder for your OS/arch."
  exit 1
fi

mkdir -p "${TMP}/out"
case "$ASSET" in
  *.zip)
    unzip -q "${TMP}/${ASSET}" -d "${TMP}/out"
    ;;
  *.tar.gz)
    tar -xzf "${TMP}/${ASSET}" -C "${TMP}/out"
    ;;
  *)
    echo "Unknown archive: $ASSET"
    exit 1
    ;;
esac

BIN="${TMP}/out/claudio"
if [ ! -f "$BIN" ]; then
  echo "Archive did not contain claudio binary at top level."
  exit 1
fi
chmod +x "$BIN"

mkdir -p "$INSTALL_DIR"
cp -f "$BIN" "${INSTALL_DIR}/claudio"
echo "Installed claudio to ${INSTALL_DIR}/claudio"
if ! echo "${PATH}" | tr ':' '\n' | grep -qx "${INSTALL_DIR}"; then
  echo ""
  echo "Add this directory to PATH, e.g. for bash/zsh:"
  echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
fi
echo "Run: claudio --version"
