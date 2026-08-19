# Rollback Procedures

Covers the three deployment methods this project actually uses — see
[deploy-strategy.md](deploy-strategy.md) for why Docker/Heroku/AWS aren't
here.

## npm

**npm's unpublish policy is restrictive by design** (to protect the
ecosystem from packages other projects depend on disappearing). As of npm's
current public policy: a version can be unpublished freely within 72 hours
of publishing; after that, `npm unpublish` is blocked for packages with
existing external dependents, and for anything older, you generally need to
contact npm support. **Verify the current policy at
<https://docs.npmjs.com/policies/unpublish> before relying on any of this —
it has changed before and can change again.**

**Critical: once a version string is unpublished, npm will never let you
publish that exact version number again**, even later. Rollback is
effectively "publish a new, higher version that reverts the change," not
"undo the bad publish."

### If you published a broken version within the last 72 hours

```bash
npm unpublish codepromax@0.1.1 --force   # only works within npm's unpublish window
```

Then either:
- Fix the issue and publish `0.1.2` (skip `0.1.1` forever — it's now
  permanently unavailable even to you), or
- If `0.1.0` was fine, no action needed — installs default to the latest
  remaining version.

### If the unpublish window has passed, or you don't want to unpublish

**Deprecate instead — this is almost always the right move:**

```bash
npm deprecate codepromax@0.1.1 "Broken release — use 0.1.2 or later instead"
```

This doesn't remove the version (existing installs keep working) but warns
anyone who tries to install it fresh, and doesn't carry unpublish's
ecosystem risk or its "can never reuse this version" permanence.

Then publish the fix as a new version:

```bash
npm version patch   # bumps package.json, e.g. 0.1.1 -> 0.1.2
./scripts/deploy-npm.sh --publish
```

## GitHub Release

Reverting a release is low-risk — it doesn't affect anyone who already
pulled the tag/tarball, and re-publishing under the same tag name is
possible (unlike npm).

```bash
# Delete the GitHub release (keeps the tag by default)
gh release delete v0.1.1 --yes

# Delete the tag too, locally and on origin, if the release was fundamentally wrong
git tag -d v0.1.1
git push origin --delete v0.1.1
```

If you need to keep the same version number after fixing the issue, you can
re-tag and re-release `v0.1.1` from a corrected commit. If you'd rather not
reuse a version number that was briefly public, bump to `v0.1.2` instead —
consistent with the npm approach above, and simpler to reason about across
both channels together.

## Local Install

Nothing to roll back — there's no shared/hosted state. If someone's local
checkout is broken, `git pull` to a known-good commit or tag fixes it.

## After Any Rollback

1. Add a `## [x.y.z]` entry to `CHANGELOG.md` documenting what was wrong and
   what changed, even for a version that never should have shipped — the
   history should explain the gap in version numbers, not hide it.
2. Re-run `./scripts/deploy-prep.sh` before attempting the next release.
3. If the break was caught by a user report rather than
   `verify-deployment.sh`, add a case to `verify-deployment.sh` that would
   have caught it, so the same class of failure can't ship silently again.
