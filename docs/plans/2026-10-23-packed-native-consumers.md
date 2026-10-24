# Packed native consumer verification

Build the private tarball into a separate temporary bare RN 0.85.3 app, without
workspace symlinks or optional Worklets/WebGPU peers. Copy only the repository's
native example scaffolding, adapt workspace paths to ordinary node_modules,
replace its JS with a minimal core map/marker/shape consumer and use standard
Babel/Metro configuration. Install dependencies independently. Check autolinking,
Codegen and Debug/Release builds on Android and iOS simulator; inspect Release
bridge exports. Preserve results and logs. This does not authorize npm publication
or claim Expo, signing, physical-device or license acceptance. Fix actual packed
integration problems in small commits and publish an independent main-based PR.
