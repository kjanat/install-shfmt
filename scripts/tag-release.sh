#!/usr/bin/env bash
# Create annotated version tags (v1.0.0, v1.0, v1) for a release.
#
# Usage: scripts/tag-release.sh <version> -m <message> -b <body> [options]
# Example: scripts/tag-release.sh 1.0.0 -m "Initial release" -b "GitHub Action to install shfmt"
#
# Creates three tags pointing at HEAD (or the commit given by --ref):
#   v1.0.0  — exact semver (annotated, GPG-signed by default)
#   v1.0    — minor alias (lightweight, points at same commit)
#   v1      — major alias (lightweight, points at same commit)
#
# Required:
#   -m <message>     Tag message (first line / subject)
#   -b <body>        Tag body (appended after blank line)
#
# Options:
#   --no-sign        Create annotated tag without GPG signature
#   --ref <commit>   Tag a specific commit instead of HEAD
#   --push           Push tags to origin after creation
#   --force          Overwrite existing alias tags (v1, v1.0)
#   --dry-run        Print what would be done without doing it
set -euo pipefail

die() {
	printf 'error: %s\n' "$1" >&2
	exit 1
}

# ── Defaults ──────────────────────────────────────────────────────────
ref="HEAD"
push=false
force=false
dry_run=false
sign=true
version=""
message=""
body=""

# ── Parse args ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
	case "$1" in
	-m)
		message="$2"
		shift 2
		;;
	-b)
		body="$2"
		shift 2
		;;
	--no-sign)
		sign=false
		shift
		;;
	--ref)
		ref="$2"
		shift 2
		;;
	--push)
		push=true
		shift
		;;
	--force)
		force=true
		shift
		;;
	--dry-run)
		dry_run=true
		shift
		;;
	-h | --help)
		sed -n '2,/^[^#]/{ s/^# \?//; p; }' "$0" | head -n -1
		exit 0
		;;
	-*) die "unknown flag: $1" ;;
	*)
		version="$1"
		shift
		;;
	esac
done

[[ -n "${version}" ]] || die "usage: $0 <version> -m <message> -b <body> [--no-sign] [--ref <commit>] [--push] [--force] [--dry-run]"
[[ -n "${message}" ]] || die "tag message required (-m <message>)"
[[ -n "${body}" ]] || die "tag body required (-b <body>)"

# ── Validate formatting ──────────────────────────────────────────────
# Body lines must each be ≤72 chars.
line_num=0
while IFS= read -r line; do
	line_num=$((line_num + 1))
	if ((${#line} > 72)); then
		die "body line ${line_num} is ${#line} chars (max 72): ${line}"
	fi
done <<<"${body}"

# ── Parse semver ──────────────────────────────────────────────────────
if [[ "${version}" =~ ^v?([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
	major="${BASH_REMATCH[1]}"
	minor="${BASH_REMATCH[2]}"
	patch="${BASH_REMATCH[3]}"
else
	die "invalid semver: ${version} (expected X.Y.Z)"
fi

tag_exact="v${major}.${minor}.${patch}"
tag_minor="v${major}.${minor}"
tag_major="v${major}"

# ── Validate title length ─────────────────────────────────────────────
# Title = "vX.Y.Z — <message>", must be ≤50 chars.
title="${tag_exact} — ${message}"
if ((${#title} > 50)); then
	die "tag title is ${#title} chars (max 50): ${title}"
fi

# ── Build tag message ─────────────────────────────────────────────────
tag_message="${title}

${body}"

# ── Resolve ref ───────────────────────────────────────────────────────
commit="$(git rev-parse --verify "${ref}^{commit}" 2>/dev/null)" ||
	die "could not resolve ref: ${ref}"
short="$(git rev-parse --short "${commit}")"

echo "Tagging ${short} as ${tag_exact}, ${tag_minor}, ${tag_major}"

# ── Helper ────────────────────────────────────────────────────────────
run() {
	if ${dry_run}; then
		echo "[dry-run] $*"
	else
		"$@"
	fi
}

force_flag=()
${force} && force_flag=(-f)

# ── Create tags ───────────────────────────────────────────────────────
# Exact semver: annotated (signed by default, --no-sign for unsigned)
if git rev-parse "refs/tags/${tag_exact}" &>/dev/null && ! ${force}; then
	die "tag ${tag_exact} already exists (use --force to overwrite)"
fi

tag_flag=(-s)
${sign} || tag_flag=(-a)

run git tag "${tag_flag[@]}" "${force_flag[@]+"${force_flag[@]}"}" -m "${tag_message}" "${tag_exact}" "${commit}"
if ${sign}; then
	echo "  created ${tag_exact} (annotated, signed)"
else
	echo "  created ${tag_exact} (annotated, unsigned)"
fi

# Minor alias: lightweight
run git tag "${force_flag[@]+"${force_flag[@]}"}" "${tag_minor}" "${commit}"
echo "  created ${tag_minor} (lightweight)"

# Major alias: lightweight
run git tag "${force_flag[@]+"${force_flag[@]}"}" "${tag_major}" "${commit}"
echo "  created ${tag_major} (lightweight)"

# ── Push ──────────────────────────────────────────────────────────────
if ${push}; then
	echo "Pushing tags to origin..."
	run git push origin "${force_flag[@]+"${force_flag[@]}"}" \
		"refs/tags/${tag_exact}" "refs/tags/${tag_minor}" "refs/tags/${tag_major}"
fi

echo "Done."
