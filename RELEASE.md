# Releasing

This project uses [Changesets](https://github.com/changesets/changesets) for
versioning, and the org-wide [`paritytech/npm_publish_automation`](https://github.com/paritytech/npm_publish_automation)
for the actual `npm publish`. The package is **never** published from a personal
account or directly from this repo's CI — the publish always runs as the
`paritytech` npm account inside the automation repo. This gives us a single,
auditable publishing identity for all Parity packages.

## Adding a changeset

Before merging a PR that should result in a version bump, add a changeset:

```sh
bun changeset
```

Follow the prompts to pick the bump type (`patch`/`minor`/`major`) and describe
the change. Commit the generated `.changeset/*.md` file with your PR.

## How a release happens

Two workflows drive it:

1. **`.github/workflows/release.yml`** runs on every push to `main`. Via
   [`changesets/action`](https://github.com/changesets/action) it:
   - opens (or updates) a **"chore: version packages"** PR that consumes the
     pending changesets, bumps `package.json` and updates `CHANGELOG.md`;
   - once that PR is merged and no changesets remain, creates a **GitHub
     Release** for the new `vX.Y.Z` tag and dispatches `npm-release.yml`.

2. **`.github/workflows/npm-release.yml`** runs on the release event. It builds,
   `npm pack`s the tarball, uploads it as an artifact, and dispatches
   `paritytech/npm_publish_automation`'s `publish.yml`, passing this repo and the
   run id. That automation downloads the tarball and runs the real `npm publish`
   as the `paritytech` account, under the `latest` dist-tag.

### Normal flow

1. Open PRs with changesets attached.
2. Merge them into `main`.
3. Review and merge the auto-created **"chore: version packages"** PR.
4. The GitHub Release and npm publish happen automatically. Watch both:
   - <https://github.com/paritytech/polkadot-cli/actions/workflows/npm-release.yml>
   - <https://github.com/paritytech/npm_publish_automation/actions/workflows/publish.yml>
5. Verify: `npm view polkadot-cli dist-tags` should show the new `latest`.

### Re-running a publish without a new tag

If `npm-release.yml` failed transiently after the release was created, re-run it
via **Actions → NPM Release → Run workflow** with `tag: vX.Y.Z`. The automation
skips versions already on the registry, so this is safe.

## Pre-releases (betas)

There is no automated snapshot/beta job — pre-releases are cut manually, the same
way the `paritytech/verifiablejs` repo does it: bump to a `-beta.N` version on a
release branch and `npm publish --tag beta` locally (requires npm publish rights
on the package). Never publish a beta as `latest`.

## Prerequisites (one-time org setup)

For the automated flow to work, these must be in place (see the PR that
introduced this flow for the checklist):

- `paritytech/polkadot-cli` is mapped to the `polkadot-cli` npm package in
  `paritytech/npm_publish_automation`'s `packages.ts`.
- The `paritytech` npm publishing account is an **owner** of the `polkadot-cli`
  npm package.
- The org-level `NPM_PUBLISH_AUTOMATION_TOKEN` secret is available to this repo.
- GitHub Actions is allowed to create pull requests (Settings → Actions →
  General → Workflow permissions).
