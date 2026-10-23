import React, { useState } from 'react';
import { Button, Platform, SafeAreaView, StatusBar } from 'react-native';
import CustomMarkers from './markers/CustomMarkersPrototype';
import MapDemo from './maplibre/MapLibrePrototype';
import RuntimeVerification from './verification/RuntimeVerification';
import ClusterVerification from './verification/ClusterVerification';
import ShaderPrototype from './gpu/ShaderPrototype';
import WebGPUPrototype from './gpu/WebGPUPrototype';
export default function App() {
  const [webgpu, setWebgpu] = useState(false);
  const [shader, setShader] = useState(false);
  const [markers, setMarkers] = useState(true);
  const [verification, setVerification] = useState(false);
  const [clustering, setClustering] = useState(false);
  return (
    <SafeAreaView
      style={{
        flex: 1,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
      }}
    >
      <Button
        title={markers ? 'Show native layers' : 'Show custom markers'}
        onPress={() => setMarkers((v) => !v)}
      />
      {__DEV__ && (
        <Button
          title={verification ? 'Close verification' : 'Open verification'}
          onPress={() => {
            setClustering(false);
            setVerification((v) => !v);
          }}
        />
      )}
      {__DEV__ && !verification && (
        <Button
          title={clustering ? 'Close clustering' : 'Open clustering'}
          onPress={() => setClustering((value) => !value)}
        />
      )}
      {__DEV__ && (
        <Button
          title={shader ? 'Close GPU prototype' : 'Open GPU prototype'}
          onPress={() => setShader((v) => !v)}
        />
      )}
      {__DEV__ && (
        <Button
          title={webgpu ? 'Close WebGPU prototype' : 'Open WebGPU prototype'}
          onPress={() => setWebgpu((v) => !v)}
        />
      )}
      {webgpu && __DEV__ ? (
        <WebGPUPrototype />
      ) : shader && __DEV__ ? (
        <ShaderPrototype />
      ) : clustering && __DEV__ ? (
        <ClusterVerification />
      ) : verification && __DEV__ ? (
        <RuntimeVerification />
      ) : markers ? (
        <CustomMarkers />
      ) : (
        <MapDemo />
      )}
    </SafeAreaView>
  );
}
