#!/usr/bin/env bash
# Installer for macOS (Linux: checks only, install the tools with your package manager).
#
# One line, from any folder:
#   curl -fsSL https://raw.githubusercontent.com/javiergonzalvezort/suitably-local-test/main/install.sh | bash
# Or from the project folder:
#   bash install.sh
#
# What it does: installs Git, Node.js, and Typst with Homebrew if they are missing,
# downloads the project (unless you run it from inside the project), turns on the
# privacy check for commits, creates your private me/ folder, and runs the doctor.
#
# Options, as environment variables:
#   INSTALL_DIR=/path   where to download the project (default: your home folder)
#   DRY_RUN=1           show what would be installed, change nothing

set -euo pipefail

APP_NAME="suitably-local-test"
REPO_URL="https://github.com/javiergonzalvezort/suitably-local-test.git"
DRY_RUN="${DRY_RUN:-0}"
OS="${OS_OVERRIDE:-$(uname -s)}"

step() { printf '\033[36m==> %s\033[0m\n' "$1"; }
ok() { printf '    \033[32m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$1" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }

# Node 22.18 or newer is needed to run the TypeScript scripts directly.
node_ok() {
  has node && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)'
}

install_pkg() { # $1 = Homebrew formula, $2 = label
  if [ "$DRY_RUN" = "1" ]; then echo "    (dry run) would run: brew install $1"; return; fi
  if [ "$OS" != "Darwin" ]; then fail "Please install $2 with your package manager, then run this again."; fi
  echo "    Installing $2..."
  brew install "$1" || fail "Could not install $2. Try 'brew install $1' by hand, then run this again."
}

printf '\n%s installer\n\n' "$APP_NAME"

if [ "$OS" = "Darwin" ] && ! has brew; then
  if [ "$DRY_RUN" = "1" ]; then
    echo "    (dry run) Homebrew is missing; would ask you to install it first"
  else
    fail "Homebrew is needed to install the tools. Install it from https://brew.sh (copy the command shown there into Terminal), then run this installer again."
  fi
fi

step "Git"
# On a new Mac, "git" may exist only as a stub that opens an Apple dialog, so test it.
if has git && git --version >/dev/null 2>&1; then ok "$(git --version)"; else install_pkg git Git; fi

step "Node.js"
if node_ok; then ok "Node.js $(node --version)"; else
  if has node; then echo "    Node.js $(node --version) is too old (need 22.18 or newer)."; fi
  install_pkg node Node.js
  if [ "$DRY_RUN" != "1" ]; then node_ok || fail "Node.js 22.18 or newer is still not available. Open a new Terminal window and run this again."; fi
fi

step "Typst"
if has typst; then ok "$(typst --version)"; else install_pkg typst Typst; fi

if [ "$DRY_RUN" = "1" ]; then printf '\nDry run finished. Nothing was changed.\n'; exit 0; fi

step "Project files"
SCRIPT_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/AGENTS.md" ]; then
  PROJECT_DIR="$SCRIPT_DIR"
  ok "Using this folder: $PROJECT_DIR"
else
  PROJECT_DIR="${INSTALL_DIR:-$HOME}/$APP_NAME"
  if [ -d "$PROJECT_DIR/.git" ]; then
    ok "Updating $PROJECT_DIR"
    git -C "$PROJECT_DIR" pull --ff-only || fail "Could not update the project."
  else
    ok "Downloading to $PROJECT_DIR"
    git clone "$REPO_URL" "$PROJECT_DIR" || fail "Could not download the project. Check your internet connection."
  fi
fi
cd "$PROJECT_DIR"

step "Privacy check and your private folder"
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
node scripts/init-workspace.ts

step "Checking everything"
node scripts/doctor.ts --online || true

printf '\nNext steps:\n'
printf '  1. See the sample first:   cd "%s" && npm run demo\n' "$PROJECT_DIR"
printf '  2. Open your agent here:   claude\n'
printf '  3. Ask it:                 Set up my profile\n\n'
