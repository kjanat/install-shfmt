#!/usr/bin/env bash
# Integration test: simulates a GitHub Actions runner executing this action.
#
# Parses action.yml for the entrypoint and input defaults, sets up the same
# env vars the runner would, runs the action, then verifies outputs.
set -euo pipefail

readonly RESET='\033[0m'
readonly GREEN='\033[32m'
readonly RED='\033[31m'
readonly BOLD='\033[1m'

pass() { printf '%b%s%b %s\n' "${GREEN}" "PASS" "${RESET}" "$1"; }
fail() {
	printf '%b%s%b %s\n' "${RED}" "FAIL" "${RESET}" "$1"
	exit 1
}

assert() {
	local desc="$1"
	shift
	if "$@"; then
		pass "${desc}"
	else
		fail "${desc}"
	fi
}

# ── Parse action.yml ──────────────────────────────────────────────────
readonly ACTION_YML="action.yml"
assert "action.yml exists" test -f "${ACTION_YML}"

# Verify node major version matches action.yml runtime (e.g. "node24" -> 24)
RUNTIME="$(yq '.runs.using' "${ACTION_YML}")"
REQUIRED_MAJOR="${RUNTIME#node}"
ACTUAL_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
assert "node ${ACTUAL_MAJOR} matches runtime ${RUNTIME}" test "${ACTUAL_MAJOR}" = "${REQUIRED_MAJOR}"

ENTRYPOINT="$(yq '.runs.main' "${ACTION_YML}")"
assert "entrypoint defined: ${ENTRYPOINT}" test -f "${ENTRYPOINT}"

# Build env vars from input defaults: inputs.<name>.default -> INPUT_<NAME>
# The runner uppercases, replaces spaces with _, and prefixes INPUT_.
input_defaults="$(
	yq -r '.inputs | to_entries | .[] | select(.value.default != null) |
		"export INPUT_" + (.key | upcase | sub(" ", "_")) + "=" + (.value.default | @sh)' \
		"${ACTION_YML}"
)" || true
eval "${input_defaults}"

# Allow test overrides (e.g. TEST_INPUT_VERSION=3.11.0)
for var in $(env | grep -oP '^TEST_INPUT_\K[^=]+'); do
	eval "INPUT_${var}=\"\${TEST_INPUT_${var}}\""
	export "INPUT_${var}"
done

# ── Setup temp dirs that mimic the runner ─────────────────────────────
WORKDIR="$(mktemp -d)"
trap 'rm -rf "${WORKDIR}"' EXIT

RUNNER_TOOL_CACHE="${WORKDIR}/tool-cache"
GITHUB_OUTPUT="${WORKDIR}/github_output"
GITHUB_PATH="${WORKDIR}/github_path"

mkdir -p "${RUNNER_TOOL_CACHE}"
touch "${GITHUB_OUTPUT}" "${GITHUB_PATH}"

export RUNNER_TOOL_CACHE GITHUB_OUTPUT GITHUB_PATH

# ── Parse GITHUB_OUTPUT ───────────────────────────────────────────────
# Format: name<<delimiter\nvalue\ndelimiter\n (repeated per output)
parse_output() {
	local name="$1" file="$2"
	sed -n "/^${name}<</{n;p;}" "${file}"
}

# ── Helper: run the action entrypoint ─────────────────────────────────
run_action() {
	node "${ENTRYPOINT}"
}

# ── Run 1: cold cache (download) ─────────────────────────────────────
# shellcheck disable=SC2154 # INPUT_VERSION set by eval from action.yml
printf '\n%b▶ Run 1: cold cache (version=%s)%b\n' "${BOLD}" "${INPUT_VERSION}" "${RESET}"

run_action

VERSION="$(parse_output version "${GITHUB_OUTPUT}")"
LOCATION="$(parse_output location "${GITHUB_OUTPUT}")"
CACHE_HIT="$(parse_output cache-hit "${GITHUB_OUTPUT}")"

# ── Assertions: Run 1 ────────────────────────────────────────────────
assert "version output set: ${VERSION}" test -n "${VERSION}"
assert "location output set: ${LOCATION}" test -n "${LOCATION}"
assert "cache-hit=false (cold)" test "${CACHE_HIT}" = "false"
assert "binary is executable" test -x "${LOCATION}"
assert "shfmt --version works" "${LOCATION}" --version
assert "GITHUB_PATH updated" grep -q "shfmt" "${GITHUB_PATH}"

# Simulate what the runner does between steps: prepend GITHUB_PATH entries to PATH
ADDED_PATH="$(cat "${GITHUB_PATH}")"
assert "shfmt on PATH" env PATH="${ADDED_PATH}:${PATH}" shfmt --version

# Verify tool-cache layout: $RUNNER_TOOL_CACHE/shfmt/<semver>/<arch>/shfmt
CACHED_BINARY="$(find "${RUNNER_TOOL_CACHE}" -name 'shfmt' -type f 2>/dev/null | head -1)"
assert "tool-cache populated: ${CACHED_BINARY}" test -n "${CACHED_BINARY}"

# ── Run 2: warm cache ────────────────────────────────────────────────
printf '\n%b▶ Run 2: warm cache%b\n' "${BOLD}" "${RESET}"

: >"${GITHUB_OUTPUT}"
: >"${GITHUB_PATH}"

run_action

CACHE_HIT_2="$(parse_output cache-hit "${GITHUB_OUTPUT}")"
assert "cache-hit=true (warm)" test "${CACHE_HIT_2}" = "true"

ADDED_PATH_2="$(cat "${GITHUB_PATH}")"
assert "shfmt on PATH (warm)" env PATH="${ADDED_PATH_2}:${PATH}" shfmt --version

# ── Summary ───────────────────────────────────────────────────────────
printf '\n%bAll assertions passed.%b\n' "${GREEN}${BOLD}" "${RESET}"
