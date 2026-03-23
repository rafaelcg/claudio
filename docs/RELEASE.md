# Release checklist (Claudio Code fork)

## GitHub Actions secrets / variables

| Name                         | Used by                                   | Notes                                                                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NPM_TOKEN`                  | **`publish.yml` → `./script/publish.ts`** | Required in **Actions secrets** so CI can run `npm publish`. Granular **automation** token with publish to `@claudio-code` and unscoped `claudio-*` packages. Without it, the publish job fails when it reaches the npm step. |
| `GITHUB_TOKEN`               | Default                                   | Usually sufficient for `contents: write`; some steps use a bot token from `setup-git-committer`.                                                                                                                              |
| `CLAUDIO_APP_ID`             | `vars`                                    | GitHub App ID for release/version automation (if using `setup-git-committer`).                                                                                                                                                |
| `CLAUDIO_APP_SECRET`         | `secrets`                                 | GitHub App private key / secret for the same flow.                                                                                                                                                                            |
| `CLAUDIO_API_KEY`            | Version bump job                          | Optional; upstream used OpenCode API for version helper.                                                                                                                                                                      |
| Apple / Tauri / notarization | `publish.yml` desktop jobs                | `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_API_*`, `TAURI_SIGNING_*` — only if you ship signed desktop builds.                                                                                                 |
| `AUR_KEY`                    | Optional AUR publish                      | Only if `CLAUDIO_PUBLISH_DISTRIBUTIONS=1`.                                                                                                                                                                                    |

## Local publish (npm CLI + wrapper)

From repo root: `bun install`. Then:

```bash
cd packages/opencode
export NPM_TOKEN="npm_…"   # automation token
rm -rf dist && bun run script/build.ts
export CLAUDIO_SKIP_DOCKER=1   # omit if publishing Docker to GHCR
bun run script/publish.ts
```

Wrapper-only (platform tarballs already on npm):

```bash
export NPM_TOKEN="npm_…"
export CLAUDIO_PUBLISH_WRAPPER_ONLY=1
bun run script/publish.ts
```

Ensure `@claudio-code/cli` is **public**: `npm access set status=public @claudio-code/cli` (run from `$HOME` to avoid workspace `.npmrc` warnings), as an org owner.

## Triggering a new npm version from GitHub Actions

1. Add **`NPM_TOKEN`** to the repo’s **Actions secrets** (see table above). Without it, the **`publish`** job fails at `./script/publish.ts`.
2. Open **Actions → publish → Run workflow**, pick **patch** / **minor** / **major** (or set an optional **version** override). That sets `CLAUDIO_BUMP` / `CLAUDIO_VERSION` so `script/version.ts` bumps semver and the pipeline publishes **`@claudio-code/cli`** (and related packages) to npm.
3. Pushes to **`dev`**, **`beta`**, **`ci`**, or **`snapshot-*`** also run `publish.yml`, but on non-`latest` branches the version is usually a **preview** `0.0.0-<branch>-…` build unless you use the manual workflow inputs.

## Branches

`publish.yml` runs on pushes to `ci`, `dev`, `beta`, `snapshot-*` and `workflow_dispatch`, gated to `github.repository == 'rafaelcg/claudio'`.

## Runners

Workflows use **GitHub-hosted** labels (`ubuntu-latest`, `windows-2025`, `macos-latest`, `ubuntu-24.04-arm64` for Linux arm64 builds). If you reintroduce a custom runner (e.g. Blacksmith), update `runs-on` accordingly.
