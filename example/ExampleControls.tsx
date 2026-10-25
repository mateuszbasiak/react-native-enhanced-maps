import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

export default function ExampleControls({
  children,
}: {
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const { height } = useWindowDimensions();
  return (
    <View style={styles.panel}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.toggle}
      >
        <Text style={styles.label}>
          {expanded ? 'Hide controls ▴' : 'Show controls ▾'}
        </Text>
      </Pressable>
      {expanded && (
        <ScrollView
          style={{ maxHeight: height * 0.3 }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#fff', flexShrink: 0 },
  toggle: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  label: { color: '#145e99', fontSize: 15, fontWeight: '600' },
});
