// "Banig" design tokens and the shared pieces from the wireframes.
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { AISLE_LABEL, type Aisle } from './merge.ts';

export const C = {
  paper: '#FAF5EA',
  card: '#FFFFFF',
  ink: '#1F1A13',
  ink2: '#6E6355',
  line: '#E7DDCA',
  dahon: '#14613C', // actions, and you
  dahonSoft: '#E3F0E7',
  achuete: '#B54314', // only where two dishes meet
  achueteSoft: '#FBEADF',
  ube: '#5F3D9E', // only your partner (sync, later)
  ubeSoft: '#EFE8FA',
  tanso: '#8A5A10', // offline and queued
  tansoSoft: '#FBF0D8',
  done: '#F6F2E8',
};

const AISLE_COLOR: Record<string, { dot: string; lab: string }> = {
  gulay: { dot: '#2E7D32', lab: '#235C26' },
  isda: { dot: '#1565A8', lab: '#124E80' },
  karne: { dot: '#B03A3A', lab: '#8A2B2B' },
  'dry goods': { dot: '#8A5A10', lab: '#6E480C' },
  null: { dot: C.ink2, lab: C.ink2 },
};

export function Header({ title, sub, onBack, right }: { title: string; sub?: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={s.nav}>
      {onBack && (
        <Pressable onPress={onBack} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={20} color={C.ink} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[s.h1, onBack && s.h1small]} accessibilityRole="header">{title}</Text>
        {sub != null && <Text style={s.sub}>{sub}</Text>}
      </View>
      {right}
    </View>
  );
}

/** Sticky section band: a letter, a label, or an aisle with its colour dot. */
export function Section({ label, count, aisle }: { label?: string; count?: string | number; aisle?: Aisle | null }) {
  const col = aisle !== undefined ? AISLE_COLOR[String(aisle)] : undefined;
  return (
    <View style={s.sec}>
      {col && <View style={[s.dot, { backgroundColor: col.dot }]} />}
      <Text style={[s.lab, col && { color: col.lab }]}>{label ?? AISLE_LABEL[String(aisle)]}</Text>
      {count != null && <Text style={s.cnt}>{count}</Text>}
      <View style={s.hair} />
    </View>
  );
}

export function Button({ title, onPress, kind = 'primary', small, icon, style }: {
  title: string; onPress: () => void; kind?: 'primary' | 'secondary'; small?: boolean; icon?: keyof typeof Ionicons.glyphMap; style?: ViewStyle;
}) {
  const fg = kind === 'primary' ? '#fff' : C.ink;
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [s.btn, small && s.btnSm, kind === 'secondary' && s.btnSec, pressed && { opacity: 0.85 }, style]}>
      {icon && <Ionicons name={icon} size={small ? 18 : 20} color={fg} />}
      <Text style={[s.btnText, small && { fontSize: 15.5 }, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Checkbox({ checked, big }: { checked: boolean; big?: boolean }) {
  return (
    <View style={[s.cbx, big && s.cbxBig, checked && { backgroundColor: C.dahon, borderColor: C.dahon }]}>
      {checked && <Ionicons name="checkmark" size={big ? 22 : 18} color="#fff" />}
    </View>
  );
}

export function Badge({ text, fg, bg }: { text: string; fg: string; bg: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Cta({ children }: { children: ReactNode }) {
  return <View style={s.cta}>{children}</View>;
}

/** Bottom sheet for a confirmation. A tap outside or hardware back calls onClose, same as its cancel button. */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(31,26,19,0.35)' }} onPress={onClose} accessibilityLabel="Cancel" />
      <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28, gap: 10 }}>
        {children}
      </View>
    </Modal>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  nav: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  back: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(31,26,19,0.06)', marginTop: 2 },
  h1: { fontSize: 30, lineHeight: 34, fontWeight: '800', letterSpacing: -0.75, color: C.ink },
  h1small: { fontSize: 22, lineHeight: 28 },
  sub: { fontSize: 13, lineHeight: 18, color: C.ink2, marginTop: 3, fontWeight: '500' },
  sec: { backgroundColor: C.paper, paddingTop: 14, paddingBottom: 7, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  lab: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', color: C.ink2 },
  cnt: { fontSize: 11, fontWeight: '800', color: C.ink2 },
  hair: { flex: 1, height: 1, backgroundColor: C.line },
  dot: { width: 9, height: 9, borderRadius: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, minHeight: 58, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line },
  rowDone: { backgroundColor: C.done },
  main: { flex: 1, minWidth: 0, paddingVertical: 9 },
  nm: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: C.ink },
  nmDone: { textDecorationLine: 'line-through', color: C.ink2 },
  mt: { fontSize: 13, lineHeight: 17, color: C.ink2, marginTop: 2, fontWeight: '500' },
  qty: { fontSize: 16, fontWeight: '700', color: C.ink },
  search: { marginHorizontal: 16, marginBottom: 12, height: 46, borderRadius: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13 },
  searchOn: { borderColor: C.dahon, boxShadow: '0 0 0 2px rgba(20,97,60,0.14)' },
  searchInput: { flex: 1, fontSize: 15, color: C.ink, height: '100%' },
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipOn: { backgroundColor: C.dahon, borderColor: C.dahon },
  chipText: { fontSize: 14, fontWeight: '600', color: C.ink },
  chipN: { fontSize: 12, fontWeight: '700', color: C.ink2 },
  cbx: { width: 28, height: 28, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(31,26,19,0.3)', backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  cbxBig: { width: 32, height: 32, borderRadius: 10 },
  badge: { height: 22, paddingHorizontal: 8, borderRadius: 7, justifyContent: 'center' },
  badgeText: { fontSize: 11.5, fontWeight: '800' },
  cta: { paddingHorizontal: 16, paddingVertical: 11, backgroundColor: C.paper, borderTopWidth: 1, borderTopColor: C.line },
  hint: { textAlign: 'center', fontSize: 12, color: C.ink2, marginTop: 7, fontWeight: '500' },
  btn: { height: 54, borderRadius: 15, backgroundColor: C.dahon, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  btnSm: { height: 46, borderRadius: 13 },
  btnSec: { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line },
  btnText: { fontSize: 17, fontWeight: '700' },
  seg: { marginHorizontal: 16, marginBottom: 12, height: 40, backgroundColor: 'rgba(31,26,19,0.07)', borderRadius: 11, padding: 3, flexDirection: 'row' },
  segItem: { flex: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: C.card, shadowColor: '#000', shadowOpacity: 0.13, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontSize: 14, fontWeight: '700', color: C.ink2 },
  empty: { padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 15, color: C.ink2, textAlign: 'center', lineHeight: 21 },
});
