// Shown once after an update: the changelog entries this phone has not seen yet (src/whatsnew.ts).
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Entry } from '../changelog.ts';
import { Button, C, s } from '../ui.tsx';

export function WhatsNew({ entries, onClose }: { entries: Entry[]; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31,26,19,0.4)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        <SafeAreaView edges={['bottom']} style={{ maxHeight: '85%', backgroundColor: C.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.line, marginTop: 8 }} />
          <View style={[s.nav, { paddingTop: 14 }]}>
            <Text style={s.h1} accessibilityRole="header">What's new</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 18 }}>
            {entries.map((e) => (
              <View key={e.id} style={{ gap: 10 }}>
                <Text style={[s.nm, { fontWeight: '800' }]}>{e.title}</Text>
                {e.items.map((item) => (
                  <View key={item} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: C.dahonSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="checkmark" size={16} color={C.dahon} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 15.5, lineHeight: 22, color: C.ink, fontWeight: '500' }}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
          <View style={[s.cta, { borderTopWidth: 0 }]}>
            <Button title="Got it" onPress={onClose} />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
