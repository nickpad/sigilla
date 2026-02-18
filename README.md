# Sigilla

<img src="docs/logo.png" alt="Sigilla logo" width="200">

_Form validation with the stamp of correctness_

**A form validation library that pairs well with React Router 7. Focused on type-safety and simplicity.**

## Release

Releases publish to npm from GitHub Actions when a version tag is pushed.

1. Add repository secret `NPM_TOKEN` (npm automation token with publish access).
2. Bump `package.json` version.
3. Commit the version change.
4. Tag and push:

```bash
git tag v0.0.1
git push origin main --tags
```

The release workflow verifies the tag equals `package.json` version, runs build/lint/typecheck/tests, publishes to npm, and creates a GitHub release.
