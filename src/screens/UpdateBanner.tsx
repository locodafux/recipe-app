// "A new version is available" card over the top of the app, when the `latest` release has a newer APK (src/update.ts).
// Mounted once in App, above every screen, so it checks at most once per app session.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { checkForUpdate, downloadAndInstall } from '../appUpdate.ts';
import { Button, C } from '../ui.tsx';
import type { AvailableUpdate } from '../update.ts';

export function UpdateBanner() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    checkForUpdate().then(setUpdate).catch(() => {});
  }, []);

  if (!update || dismissed) return null;

  const download = async () => {
    if (progress !== null) return;
    setError(false);
    setProgress(0);
    try {
      await downloadAndInstall(update, setProgress);
      setDismissed(true);
    } catch {
      setError(true);
    } finally {
      setProgress(null);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => setDismissed(true)}>
      <SafeAreaView edges={['top']} pointerEvents="box-none" style={{ flex: 1 }}>
        <View style={{ marginHorizontal: 16, marginTop: 12, padding: 16, gap: 12, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, elevation: 6, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>A new version is available</Text>
              <Text style={{ marginTop: 3, fontSize: 14, color: C.ink2 }}>
                {error ? "Couldn't finish the download or install. Try again." : 'Download it to update the app.'}
              </Text>
            </View>
            <Pressable onPress={() => setDismissed(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Not now">
              <Ionicons name="close" size={22} color={C.ink2} />
            </Pressable>
          </View>
          <Button small icon="download-outline" onPress={download}
            title={progress === null ? 'Download' : `Downloading… ${Math.round(progress * 100)}%`} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
