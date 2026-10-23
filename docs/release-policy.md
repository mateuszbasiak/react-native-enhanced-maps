# Prerelease and maintenance policy

The package is experimental, private and UNLICENSED. No public release or supported
production version exists. The checked-in SDK/React Native versions are the tested
development baseline; they are not a support promise for other versions.

## Changes and versions

Record user-visible API changes, fixes and known limits in CHANGELOG.md. Describe
breaking changes with a before/after migration example. While the package is 0.x,
use a minor release for an incompatible API change and a patch for a compatible
fix. Use explicit prerelease versions such as 0.1.0-alpha.1 while release gates are
open; advance the prerelease suffix for each immutable published artifact. Never
replace a published version or silently move its tag.

A release candidate must name its source commit and include package checks,
production bundles, native build evidence, clean consumer results and known
limitations. Keep unverified and skipped checks explicit. Physical-device Release
testing is deferred to the maintainer; simulator results cannot substitute for it.

## Publishing

Publishing requires explicit maintainer approval for the exact version and source
commit, resolved package/repository ownership and licensing, and an accepted gate
report. Keeping a package private prevents accidental publication; removing that
flag is part of an approved release change, not routine development.

Use an organization-controlled npm scope and GitHub repository once ownership is
resolved. Prefer npm trusted publishing from a protected, reviewed release workflow
with provenance. Do not add an active publish workflow until the namespace,
credentials/identity and approval process are resolved. Never commit npm tokens,
signing material or tile-service secrets. Use least-privilege, short-lived identity
and GitHub environment approval where available. Test the packed artifact before
publishing and inspect npm's resulting metadata/provenance afterward.

## Maintenance and reports

There is no response-time or long-term-support commitment during experimentation.
Issue reports should identify package/source revision, RN/SDK versions, OS/device,
build mode, reproduction steps and expected/actual behavior. Include sanitized
logs and fixtures; omit credentials and private coordinates or user metadata.
A regression fix should carry a focused reproduction and applicable verification.
Dependency upgrades are reviewed changes and require relevant native and consumer
checks; a green JavaScript workflow alone does not validate SDK compatibility.

Security reports must use a private channel. Do not publish exploit details or
secrets in a public issue. GitHub private vulnerability reporting is enabled; see [SECURITY.md](../SECURITY.md)
for the private reporting link and handling policy.
