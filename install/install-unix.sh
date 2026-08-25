#!/usr/bin/env bash
set -euo pipefail

# Build and install the Freebuff main branch for Linux or macOS.
# The defaults point to the owner's fork so a fresh machine does not silently
# build the upstream CodebuffAI repository instead.

repo_url="${FREEBUFF_REPO_URL:-https://github.com/viniciusdebruin/freebuff.git}"
branch="${FREEBUFF_BRANCH:-main}"
source_dir="${FREEBUFF_SOURCE_DIR:-$HOME/.local/share/freebuff-vinicius-source}"
bin_dir="${FREEBUFF_BIN_DIR:-$HOME/.local/bin}"

# These values are public build configuration, not credentials. They are
# embedded in the binary by cli/scripts/build-binary.ts.
export NEXT_PUBLIC_CB_ENVIRONMENT="${NEXT_PUBLIC_CB_ENVIRONMENT:-prod}"
export NEXT_PUBLIC_CODEBUFF_APP_URL="${NEXT_PUBLIC_CODEBUFF_APP_URL:-https://www.codebuff.com}"
export NEXT_PUBLIC_FREEBUFF_APP_URL="${NEXT_PUBLIC_FREEBUFF_APP_URL:-https://freebuff.com}"
export NEXT_PUBLIC_SUPPORT_EMAIL="${NEXT_PUBLIC_SUPPORT_EMAIL:-support@codebuff.com}"
export NEXT_PUBLIC_POSTHOG_API_KEY="${NEXT_PUBLIC_POSTHOG_API_KEY:-phc_public_placeholder}"
export NEXT_PUBLIC_POSTHOG_HOST_URL="${NEXT_PUBLIC_POSTHOG_HOST_URL:-https://us.i.posthog.com}"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_test_placeholder}"
export NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL="${NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL:-https://billing.stripe.com/p/login/test}"
export NEXT_PUBLIC_WEB_PORT="${NEXT_PUBLIC_WEB_PORT:-3000}"

fail() {
  printf 'Freebuff installation failed: %s\n' "$1" >&2
  exit 1
}

normalize_git_url() {
  printf '%s' "$1" | sed -E 's#/$##; s#\.git$##'
}

case "$(uname -s)" in
  Linux|Darwin) ;;
  *) fail 'this installer supports Linux and macOS only' ;;
esac

command -v git >/dev/null 2>&1 || fail 'Git is required; install it and run this script again'

if ! command -v bun >/dev/null 2>&1; then
  if ! command -v curl >/dev/null 2>&1; then
    fail 'Bun is missing and curl is unavailable to install it'
  fi

  printf 'Bun was not found. Installing Bun for the current user...\n'
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

command -v bun >/dev/null 2>&1 || fail 'Bun could not be found after installation'

mkdir -p "$(dirname "$source_dir")"

if [ ! -e "$source_dir" ]; then
  printf 'Cloning %s (%s)...\n' "$repo_url" "$branch"
  git clone --depth 1 --branch "$branch" "$repo_url" "$source_dir"
elif [ ! -d "$source_dir/.git" ]; then
  fail "$source_dir exists but is not a Git repository; choose another FREEBUFF_SOURCE_DIR"
else
  current_origin="$(git -C "$source_dir" remote get-url origin 2>/dev/null || true)"
  if [ -z "$current_origin" ]; then
    fail "the source checkout has no origin remote; choose another FREEBUFF_SOURCE_DIR"
  fi
  if [ "$(normalize_git_url "$current_origin")" != "$(normalize_git_url "$repo_url")" ]; then
    fail "the source checkout points to $current_origin, expected $repo_url; choose another FREEBUFF_SOURCE_DIR"
  fi

  printf 'Updating source checkout in %s...\n' "$source_dir"
  git -C "$source_dir" fetch --depth 1 origin "$branch"

  if git -C "$source_dir" show-ref --verify --quiet "refs/heads/$branch"; then
    git -C "$source_dir" checkout "$branch"
  else
    git -C "$source_dir" checkout -b "$branch" "origin/$branch"
  fi

  git -C "$source_dir" pull --ff-only origin "$branch"
fi

printf 'Installing dependencies...\n'
bun --cwd "$source_dir" install --frozen-lockfile

printf 'Building Freebuff for %s/%s...\n' "$(uname -s)" "$(uname -m)"
bun --cwd "$source_dir" run build:freebuff

binary="$source_dir/cli/bin/freebuff"
wasm="$source_dir/cli/bin/tree-sitter.wasm"
[ -f "$binary" ] || fail "build did not produce $binary"
[ -f "$wasm" ] || fail "build did not produce $wasm"

mkdir -p "$bin_dir"
cp "$binary" "$bin_dir/freebuff"
cp "$wasm" "$bin_dir/tree-sitter.wasm"
chmod 755 "$bin_dir/freebuff"

printf '\nFreebuff installed at %s\n' "$bin_dir/freebuff"
if case ":$PATH:" in *":$bin_dir:"*) false ;; *) true ;; esac; then
  printf 'Add this directory to PATH for future terminals:\n'
  printf '  export PATH="%s:$PATH"\n' "$bin_dir"
fi

"$bin_dir/freebuff" --version || true
