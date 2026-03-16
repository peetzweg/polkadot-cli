# Releasing

This project uses [Changesets](https://github.com/changesets/changesets) to manage versioning and publishing to npm.

## Adding a changeset

Before merging a PR that should result in a version bump, add a changeset:

```sh
bun changeset
```

Follow the prompts to select the bump type (`patch`, `minor`, `major`) and describe the change. This creates a markdown file in `.changeset/` that should be committed with your PR.

## Production release

Production releases happen automatically when changes are pushed to `main`.

The [Release workflow](.github/workflows/release.yml) runs on every push to `main` and does the following:

1. If there are pending changesets, it opens (or updates) a **"Version Packages"** PR that bumps `package.json` and updates the changelog.
2. When that PR is merged, the workflow detects there are no remaining changesets, builds the project, publishes to npm under the `latest` tag, and creates a GitHub Release with auto-generated release notes.

This is handled by the [`changesets/action`](https://github.com/changesets/action) GitHub Action.

### Steps

1. Add changesets to your PRs as described above.
2. Merge your PRs into `main`.
3. Review and merge the auto-created "Version Packages" PR.
4. The release is published automatically.

## Snapshot release

Snapshot releases publish a pre-release version from any branch, useful for testing changes before they land on `main`.

The [Snapshot Release workflow](.github/workflows/snapshot-release.yml) is triggered manually via `workflow_dispatch`.

### Via GitHub UI

1. Go to **Actions** > **Snapshot Release**.
2. Click **Run workflow**.
3. Select the branch you want to publish from.
4. Optionally change the dist-tag (defaults to `beta`; other useful values: `next`, `canary`).
5. Click **Run workflow**.

### Via GitHub CLI

```sh
gh workflow run snapshot-release.yml --ref <branch> --field tag=beta
```

### What it does

1. Checks out the selected branch.
2. Installs dependencies and builds.
3. Runs `npx changeset version --snapshot <tag>` to generate a snapshot version (e.g. `1.2.0-beta-20260316120000`).
4. Publishes to npm under the specified dist-tag.
5. Reports the published version in the workflow summary.

### Installing a snapshot

```sh
npx polkadot-cli@beta
# or whatever tag you used:
npx polkadot-cli@next
npx polkadot-cli@canary
```

## Prerequisites

- The `NPM_TOKEN` secret must be configured in the repository settings with publish access to the `polkadot-cli` package on npm.
