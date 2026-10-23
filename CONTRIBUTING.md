# Contributing

The package is experimental. Check [FEATURE_CHECKLIST.md](FEATURE_CHECKLIST.md)
and the current [contracts](docs/contracts.md) before changing public behavior.
Discuss new API scope through an issue or PR description; component names do not
imply complete react-native-maps compatibility.

Keep significant changes in focused PRs with meaningful commits. Explain the concrete
problem, resulting behavior, compatibility impact and relevant validation. Include a
focused regression when fixing behavior. Run `npm run ci`; native changes also need
app compilation on the affected platforms and applicable runtime scenarios. Record
commit, device/OS, SDK/RN, build mode and pass/fail/skip. Missing devices are skips.
Physical-device Release testing is currently deferred to the maintainer.

Follow [development setup](docs/development.md). Use immutable geometry and stable
marker IDs in fixtures. Include sanitized reproduction data and logs in bug reports.
Never commit credentials or private location/metadata fixtures. Security issues use
the private channel in [SECURITY.md](SECURITY.md), not public issue reports.

See [release and maintenance policy](docs/release-policy.md). Public publishing,
package ownership and licensing changes require an explicit maintainer decision.
