// Screen 7A/7B: invite one person to the list by magic link, and see who is pending. Full-screen, no tab bar.
// Signed out, it first signs this phone in the same way (the wireframes have no separate sign-in screen).
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import type { Line } from '../merge.ts';
import { cancelInvite, ensureList, errorText, invite, listInvites, sendInviteLink, sendSignInLink, supabase, useSession, type Invite as Inv } from '../remote.ts';
import { useStore } from '../store.ts';
import { Badge, Button, C, Header, s } from '../ui.tsx';
import { Avatar } from './LineRow.tsx';

export function Invite({ lines, onBack }: { lines: Line[]; onBack: () => void }) {
  const session = useSession();
  const { shared } = useStore();
  const [invites, setInvites] = useState<Inv[] | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const me = session?.user.email ?? '';
  useEffect(() => { setSent(null); if (session) ensureList(lines); }, [session?.user.id]);
  const reload = useCallback(() => { if (shared) listInvites(shared.id).then(setInvites, (e) => setError(errorText(e))); }, [shared?.id]);
  useEffect(reload, [reload]);

  const run = (f: () => Promise<unknown>, done?: () => void) => {
    setError(null);
    f().then(() => { done?.(); reload(); }, (e) => setError(errorText(e)));
  };

  if (!supabase) {
    return (
      <View style={s.screen}>
        <Header onBack={onBack} title="Share the list" />
        <View style={s.empty}><Text style={s.emptyText}>Sharing is turned off in this build (EXPO_PUBLIC_SUPABASE_URL is empty).</Text></View>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={s.screen}>
        <Header onBack={onBack} title="Share the list" />
        <EmailForm title="First, your email"
          help="We will email you a link. Tap it and you are signed in — no password to remember."
          button="Email me a sign-in link" error={error}
          sent={sent && `Check ${sent}: the link signs you in on this phone.`}
          onSubmit={(email) => run(() => sendSignInLink(email), () => setSent(email))} />
      </View>
    );
  }

  if (!shared || !invites) {
    return (
      <View style={s.screen}>
        <Header onBack={onBack} title="Share the list" />
        <View style={s.empty}>
          {error ? <Text style={s.emptyText}>{error}</Text> : shared ? <ActivityIndicator color={C.dahon} />
            : <Text style={s.emptyText}>No signal yet. The list is shared as soon as this phone is online.</Text>}
        </View>
      </View>
    );
  }

  const pending = invites.filter((i) => !i.accepted_at);
  // The owner sees who accepted; the invitee knows the owner from the invite link.
  const others = shared.owner ? invites.filter((i) => i.accepted_at).map((i) => i.email) : shared.partner ? [shared.partner.email] : [];
  const members = 1 + others.length;
  const full = members >= 2; // two people only

  return (
    <View style={s.screen}>
      <Header onBack={onBack} title={shared.name}
        sub={`${members} member${members === 1 ? '' : 's'}${pending.length ? ` · ${pending.length} pending` : ''}`} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {sent && (
          <View style={{ marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 13, backgroundColor: C.dahonSoft }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.dahon }}>Sent to {sent}</Text>
            <Text style={s.mt}>The link expires in 1 hour. Resend it if it lapses.</Text>
          </View>
        )}
        <Text style={[s.lab, { marginHorizontal: 16, marginBottom: 7 }]}>Members</Text>
        <View style={{ borderTopWidth: 1, borderTopColor: C.line }}>
          <Member name="You" avatar={me} sub={`${me} · ${shared.owner ? 'owner' : 'member'}`} me />
          {others.map((e) => <Member key={e} name={e} sub={shared.owner ? 'member' : 'owner'} />)}
          {pending.map((i) => (
            <View key={i.id}>
              <Member name={i.email} sub={`Invited ${ago(i.created_at)}`} pending />
              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
                <Button small kind="secondary" title="Resend link" style={{ flex: 1 }}
                  onPress={() => run(() => sendInviteLink(i, lines), () => setSent(i.email))} />
                <Button small kind="secondary" title="Cancel invite" style={{ flex: 1 }}
                  onPress={() => run(() => cancelInvite(i.id), () => setSent(null))} />
              </View>
            </View>
          ))}
        </View>
        {!full && pending.length === 0 && (
          <EmailForm title="Add someone"
            help="We will email them a link. They tap it, and you are on the same list — no password to remember."
            button="Send invite" error={error}
            onSubmit={(email) => run(() => invite(email, lines), () => setSent(email))} />
        )}
        {error && (full || pending.length > 0) && <Text style={[s.hint, { color: C.achuete }]}>{error}</Text>}
      </ScrollView>
    </View>
  );
}

function EmailForm({ title, help, button, error, sent, onSubmit }: {
  title: string; help: string; button: string; error: string | null; sent?: string | null; onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const ok = /^\S+@\S+\.\S+$/.test(email.trim());
  return (
    <View style={{ padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>{title}</Text>
      <Text style={[s.mt, { fontSize: 14, lineHeight: 20 }]}>{help}</Text>
      <Text style={[s.lab, { marginTop: 4 }]}>Email</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor={C.ink2} autoCapitalize="none" autoComplete="email"
        keyboardType="email-address" inputMode="email" accessibilityLabel="Email" onSubmitEditing={() => ok && onSubmit(email.trim())}
        style={[s.search, { marginHorizontal: 0, marginBottom: 0, fontSize: 16, color: C.ink }]} />
      <Button small title={button} onPress={() => ok && onSubmit(email.trim())} style={!ok ? { opacity: 0.5 } : undefined} />
      {sent && <Text style={[s.hint, { color: C.dahon }]}>{sent}</Text>}
      {error && <Text style={[s.hint, { color: C.achuete }]}>{error}</Text>}
    </View>
  );
}

function Member({ name, avatar, sub, me, pending }: { name: string; avatar?: string; sub: string; me?: boolean; pending?: boolean }) {
  return (
    <View style={[s.row, pending && { opacity: 0.6 }]}>
      <Avatar name={avatar ?? name} me={me} />
      <View style={s.main}>
        <Text style={s.nm} numberOfLines={1}>{name}</Text>
        <Text style={s.mt}>{sub}</Text>
      </View>
      {pending && <Badge text="Pending" fg={C.tanso} bg={C.tansoSoft} />}
    </View>
  );
}

function ago(iso: string) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  return `${Math.round(min / 60)} h ago`;
}
