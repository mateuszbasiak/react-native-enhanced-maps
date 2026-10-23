import React from 'react';
import { Pressable, Text } from 'react-native';
import type { ClusterComponentProps } from './types';

export function DefaultCluster({ count, expand }: ClusterComponentProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Expand cluster of ${count} markers`}
      onPress={() => {
        void expand().catch(() => {
          /* MapView reports the error. */
        });
      }}
      style={{
        minWidth: 40,
        height: 40,
        borderRadius: 20,
        paddingHorizontal: 8,
        backgroundColor: '#145e99',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{count}</Text>
    </Pressable>
  );
}
