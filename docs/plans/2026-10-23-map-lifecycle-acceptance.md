# Repeated map lifecycle acceptance

Add a separate Debug-only screen for a bounded 100-remount run. Each cycle waits
for its own map-ready event, validates a native bounds query and records pass/fail
with generation and duration. Old ref queries must reject after replacement.
Use explicit per-cycle timeout, cancellation on screen disposal and bounded
results. Run on both simulators. Do not claim memory/resource stability without
measurements, or physical-device Release acceptance. Keep the PR independent of
the settings/padding stack and clustering harness.
