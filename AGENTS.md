# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-03 **Commit:** 6fbc218 **Branch:** master

## OVERVIEW

GitHub Action installing the [shfmt](https://github.com/mvdan/sh) shell formatter with tool-cache support. TypeScript source, Bun bundler, zero `@actions/*` runtime dependencies.

## STRUCTURE

```tree
.
├── action.yml              # Action definition (node24 runtime)
├── src/                    # TypeScript source (6 modules)
│   ├── main.ts             # Entrypoint: reads inputs, calls installShfmt()
│   ├── install.ts          # Download + cache + PATH registration
│   ├── version.ts          # Resolves "latest" via GitHub redirect
│   ├── platform.ts         # Maps node os/arch to shfmt naming
│   ├── cache.ts            # Tool-cache (reimplements @actions/tool-cache)
│   └── actions.ts          # Actions runtime helpers (reimplements @actions/core)
├── dist/main.mjs           # Bun-bundled single-file output (gitignored, committed by CI)
├── test/integration.sh     # Bash integration test simulating runner env
└── .github/
    ├── workflows/ci.yml    # CI: typecheck, build, test, conditional release
    └── actions/release/    # Composite action for automated releasing (separate workspace)
        ├── action.yml
        └── src/            # release.mjs, parse.mjs, artifact.mjs
```

## WHERE TO LOOK

| Task                  | Location                            | Notes                                                                    |
| --------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| Action behavior       | `src/main.ts`, `src/install.ts`     | `void run()` pattern at module level                                     |
| Version resolution    | `src/version.ts`                    | Follows GitHub redirects via raw `node:https`                            |
| Platform mapping      | `src/platform.ts`                   | Union literal types `ShfmtOS`, `ShfmtArch`                               |
| Tool-cache logic      | `src/cache.ts`                      | Manual implementation — no `@actions/tool-cache` dep                     |
| Actions runtime (I/O) | `src/actions.ts`                    | `getInput`, `setOutput`, `setFailed`, `addPath` — no `@actions/core` dep |
| CI pipeline           | `.github/workflows/ci.yml`          | Single workflow, 2 jobs: `ci` + conditional `release`                    |
| Release automation    | `.github/actions/release/src/*.mjs` | Commit-message-driven; parses `Release:` trailer                         |
| Tests                 | `test/integration.sh`               | Simulates runner env; cold + warm cache scenarios                        |
| Formatting config     | `.dprint.jsonc`                     | Extends remote shared config                                             |

## CONVENTIONS

- **Zero runtime deps**: `@actions/core` and `@actions/tool-cache` are reimplemented from scratch. HTTP uses raw `node:https` with manual redirect following (up to 10 hops). Do not add `@actions/*` packages.
- **Bun** as package manager + bundler (not npm/ncc). `bun build` produces single-file ESM bundle.
- **tsgo** (`@typescript/native-preview`) for typechecking — not `tsc`.
- **dprint** for formatting — not Prettier, not ESLint. Includes shfmt exec plugin (dogfooding).
- **Tabs** for indentation (width 2), **LF** line endings, **120** line width, **single quotes** (TS).
- **Strict TS**: `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (enforces `import type`).
- **`.ts` extensions** in imports (`from './actions.ts'`).
- **ESM throughout**: `"type": "module"`, `module: "Preserve"`, `moduleResolution: "bundler"`.
- **Node 24** (`engines: ">=24, <25"`, `using: node24` in action.yml).
- **Default branch**: `master` (not main).
- **Shell scripts**: `set -euo pipefail`, tabs, `shfmt -i 0 -ln bash -bn -ci`.
- **Bun workspaces**: root + `.github/actions/release`. `catalog:` protocol for shared dep versions.

## ANTI-PATTERNS (THIS PROJECT)

- **Do not add `@actions/*` runtime deps** — the project deliberately reimplements them to avoid ~400KB transitive deps.
- **Do not use `tsc`** — use `tsgo` (`bun typecheck`).
- **Do not use Prettier/ESLint** — use `dprint` (`bun fmt`).
- **Do not use npm/yarn/pnpm** — use Bun.
- **Do not manually create tags** — CI creates tags from `Release:` git trailer.
- `src/actions.ts` has deprecated `::set-output` / `::add-path` workflow command fallbacks (lines 35, 51).

## RELEASE PROCESS

Commit-message-driven, fully automated by CI:

1. Include `Release: X.Y.Z` as a git trailer in the commit body on `master`
2. CI builds + tests, uploads `dist/` artifact
3. Release job: downloads artifact, commits `dist/main.mjs`, creates tags (`vX.Y.Z` annotated, `vX.Y` + `vX` lightweight), pushes
4. Commit message format: subject ≤50 chars (`vX.Y.Z -- <subject>`), body lines ≤72 chars

## TESTING

- **Integration only** — no unit test framework. `bash test/integration.sh`.
- Test parses `action.yml` with `yq`, simulates runner env (env vars, temp dirs, output file format).
- Two scenarios: cold cache (download) and warm cache (tool-cache hit).
- Override test inputs via `TEST_INPUT_*` env vars.
- Requires `yq` on PATH.

## COMMANDS

```bash
bun install              # Install deps
bun typecheck            # tsgo --noEmit
bun run build            # Bundle src/main.ts -> dist/main.mjs
bun fmt                  # dprint fmt
bash test/integration.sh # Integration test (requires built dist/)
```
