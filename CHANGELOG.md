# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-03-02

### Added

- Install shfmt binary from GitHub releases with automatic platform detection (linux/macOS/Windows, amd64/arm64/386/arm).
- Resolve `latest` version via GitHub redirect, or pin a specific version.
- Tool-cache integration compatible with `@actions/tool-cache` layout for instant warm-cache hits.
- Download retry with exponential back-off (3 attempts).
- Minimal Actions runtime helpers replacing `@actions/core` to eliminate ~400 KB of transitive dependencies.
- Action outputs: `version`, `location`, `cache-hit`.
- Integration test script simulating the GitHub Actions runner environment.
- CI workflow with typecheck, build, and integration test.
- Composite release action triggered by `Release:` git trailer.
- `CONTRIBUTING.md` with development and release instructions.

[Unreleased]: https://github.com/kjanat/install-shfmt/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/kjanat/install-shfmt/releases/tag/v1.0.0
