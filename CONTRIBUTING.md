# Contributing

## Prerequisites

- [Bun] 1.3+ (package manager and bundler)
- [Node.js] 24 (runtime — matches `action.yml` `node24`)
- [dprint] (formatter)

## Setup

```sh
bun install --frozen-lockfile
```

## Development

```sh
bun run build       # bundle src/main.ts → dist/main.mjs
bun typecheck       # tsgo --noEmit (checks .ts and .mjs via checkJs)
bun fmt             # format with dprint (typescript, yaml, json, shell)
bash test/integration.sh  # end-to-end test simulating a GitHub runner
```

### Project structure

```tree
src/                          # action source (TypeScript)
  main.ts                     # entrypoint
  install.ts                  # download + cache + finalize
  version.ts                  # resolve "latest" → semver
  platform.ts                 # detect OS + arch
  cache.ts                    # tool-cache wrappers
  actions.ts                  # GitHub Actions API wrappers
dist/                         # build output (committed by CI on release)
test/                         # integration tests
.github/actions/release/      # composite action for CI releases
  src/release.mjs             # orchestrator
  src/parse.mjs               # commit message parsing + tag validation
  src/artifact.mjs            # artifact download + entrypoint resolution
```

### Formatting

This project uses [dprint] with a remote shared config. Shell scripts are
formatted with `shfmt`. Run `bun fmt` before committing.

### Type checking

The `tsconfig.json` has `allowJs: true` and `checkJs: true`. This means
`tsgo` checks both `.ts` source files and `.mjs` files (including the
release action under `.github/`). All code in the repo is typechecked.

## Releasing

Releases are triggered by a `Release:` [git trailer] in the commit message
on `master`. No manual tagging or scripts needed.

### Commit message format

```commit
feat: add support for arm64

Release: 1.1.0
```

The subject line plus version prefix must fit in 50 characters
(`vX.Y.Z — <subject>`). Body lines must be at most 72 characters.

CI will:

1. Build and test as usual
2. Detect the `Release:` trailer
3. Commit `dist/main.mjs` to `master`
4. Create `v1.1.0` (annotated), `v1.1` and `v1` (lightweight) tags
5. Push everything

### No release

Just omit the `Release:` trailer. CI runs build + test only.

## License

By contributing, you agree that your contributions will be licensed under
the [MIT License].

<!-- links -->

[Bun]: https://bun.sh
[Node.js]: https://nodejs.org
[dprint]: https://dprint.dev
[git trailer]: https://git-scm.com/docs/git-interpret-trailers
[MIT License]: ./LICENSE
