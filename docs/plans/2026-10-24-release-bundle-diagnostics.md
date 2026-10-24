# Release bundle diagnostics guard

**Goal:** Keep example Debug diagnostic globals out of both production bundles.

**Design:** Inspect actual Metro production output after each successful bundle.
Reserve the `__enhancedMaps` namespace for package/example globals. Allow only the
runtime `__enhancedMapsShader` handle; its transport/error checks are required in
Release. Fail on other names without printing surrounding bundle text, which may
contain consumer data. This is a bounded JavaScript exclusion check, separate from
native Debug/Release export checks and the broader TEST-12 privacy audit.

**Plan:**

1. Add contracts accepting ordinary bundles/runtime shader transport and rejecting
   current/future Debug namespace names. Verify failures and safe error messages.
2. Add a shared validator and invoke it after successful iOS/Android Metro bundling.
3. Run focused contracts and full CI, including actual production bundles.
4. Document namespace, evidence and limits; keep broader native privacy work open.
5. Review and publish an independent main-based PR.
