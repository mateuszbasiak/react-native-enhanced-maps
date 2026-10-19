# React Native Enhanced Maps

Private feasibility implementation. Not published and not ready for production.

Fabric MapView with an initial camera, imperative camera movement, readiness,
camera events and structured errors. MapKit on iOS; Google Maps adapters on iOS
and Android. Native builds/device behavior are tracked in the repository docs.

Layers, clustering, detailed gestures, and react-native-maps compatibility remain
planned work. No drop-in compatibility claim is made.

Google iOS is opt-in during pod installation with `ENHANCED_MAPS_GOOGLE_IOS=1`.
Set `EnhancedMapsGoogleApiKey` in the application's Info.plist. Android requires
`com.google.android.geo.API_KEY` metadata. Never commit API keys.

The companion TypeGPU package is a separate installation. Core has no runtime npm
dependencies beyond its React/React Native peers; native maps SDK size still applies.
