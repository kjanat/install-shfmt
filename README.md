# Install shfmt

A GitHub Action to install the [shfmt] shell formatter.

## Usage

```yaml
- uses: kjanat/install-shfmt@v1
```

### Pin a specific version

```yaml
- uses: kjanat/install-shfmt@v1
  with:
    version: "3.12.0"
```

### Run shfmt after install

```yaml
- uses: kjanat/install-shfmt@v1
- run: shfmt -d .
```

### Format and autofix

```yaml
name: autofix.ci
on:
  push: { branches: ["main"] }
  pull_request:
permissions: { contents: read }
jobs:
  autofix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: kjanat/install-shfmt@v1
      - run: shfmt -w .
      - uses: autofix-ci/action@v1
```

## Inputs

| Name      | Description                              | Default  |
| --------- | ---------------------------------------- | -------- |
| `version` | shfmt version to install (e.g. `3.12.0`) | `latest` |

## Outputs

| Name        | Description                        |
| ----------- | ---------------------------------- |
| `version`   | Installed shfmt version            |
| `location`  | Path to the installed shfmt binary |
| `cache-hit` | Whether the binary was from cache  |

## License

[MIT]

<!-- links -->

[shfmt]: https://github.com/mvdan/sh "mvdan/sh on GitHub"
[MIT]: https://github.com/kjanat/install-shfmt/blob/master/LICENSE
