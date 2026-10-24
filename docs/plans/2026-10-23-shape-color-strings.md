# Shape color strings

Normalize Polyline/Polygon/Circle color strings with the pinned React Native color
normalizer into the existing native #RRGGBBAA representation. Keep existing long
hex strings stable, reject invalid/non-string colors before native work, and do
not extend this contract to dynamic/native color objects or shader uniforms.
Use the official small standalone normalizer as an explicit exact dependency
rather than copying its named-color table or importing undocumented RN internals.
Add failing contract coverage for names, short hex, rgba/hsl/transparent and invalid
inputs, then implement and test. Demonstrate the strings in the existing map
example, verify both simulator hosts and full package/bundle checks. Review the
new runtime dependency and publish an independent main-based PR.
