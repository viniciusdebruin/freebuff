#!/usr/bin/env bash
set -euo pipefail

# The desktop launcher runs outside the development shell. Keep the values
# required by the bundled CLI available without storing credentials in the
# desktop entry.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
BIN_PATH="${REPO_ROOT}/cli/bin/freebuff"

# Plank can start a terminal without carrying the session bus variables that
# desktop URL and clipboard helpers need. Recover them only when the session
# sockets are present, leaving normal inherited values untouched.
if [[ -z "${XDG_RUNTIME_DIR:-}" && -d "/run/user/$(id -u)" ]]; then
  export XDG_RUNTIME_DIR="/run/user/$(id -u)"
fi
if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" && -S "${XDG_RUNTIME_DIR:-}/bus" ]]; then
  export DBUS_SESSION_BUS_ADDRESS="unix:path=${XDG_RUNTIME_DIR}/bus"
fi
if [[ -z "${DISPLAY:-}" && -S /tmp/.X11-unix/X0 ]]; then
  export DISPLAY=:0
fi
if [[ -z "${XAUTHORITY:-}" && -f "${HOME:-}/.Xauthority" ]]; then
  export XAUTHORITY="${HOME}/.Xauthority"
fi

if [[ ! -x "${BIN_PATH}" ]]; then
  printf 'Freebuff binary not found or not executable: %s\n' "${BIN_PATH}" >&2
  printf 'Build it with: bun run build:freebuff\n' >&2
  exit 127
fi

export NEXT_PUBLIC_CB_ENVIRONMENT="${NEXT_PUBLIC_CB_ENVIRONMENT:-prod}"
export NEXT_PUBLIC_CODEBUFF_APP_URL="${NEXT_PUBLIC_CODEBUFF_APP_URL:-https://codebuff.com}"
export NEXT_PUBLIC_SUPPORT_EMAIL="${NEXT_PUBLIC_SUPPORT_EMAIL:-support@codebuff.com}"
export NEXT_PUBLIC_POSTHOG_API_KEY="${NEXT_PUBLIC_POSTHOG_API_KEY:-phc_public_placeholder}"
export NEXT_PUBLIC_POSTHOG_HOST_URL="${NEXT_PUBLIC_POSTHOG_HOST_URL:-https://us.i.posthog.com}"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_test_placeholder}"
export NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL="${NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL:-https://billing.stripe.com/p/login/test}"
export NEXT_PUBLIC_FREEBUFF_APP_URL="${NEXT_PUBLIC_FREEBUFF_APP_URL:-https://freebuff.com}"
export NEXT_PUBLIC_WEB_PORT="${NEXT_PUBLIC_WEB_PORT:-3000}"

exec "${BIN_PATH}" "$@"
