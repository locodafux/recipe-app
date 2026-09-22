// Screen 7C: the invitee's landing after the magic link signed them in. Joining swaps this phone onto the inviter's list.
import { useState } from 'react';
import { Text, View } from 'react-native';
import { acceptInvite, errorText, useSession, type InvitePreview } from '../remote.ts';
import { Button, C, Cta, Header, s } from '../ui.tsx';
import { Avatar } from './LineRow.tsx';

export function Join({ invite, onBack, onJoined }: { invite: InvitePreview; onBack: () => void; onJoined: () => void }) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const join = () => {
    setBusy(true);
    setError(null);
    acceptInvite(invite).then(onJoined, (e) => { setError(errorText(e)); setBusy(false); });
  };
  return (
    <View style={s.screen}>
      <Header onBack={onBack} title="Join" />
      <View style={{ flex: 1, padding: 16, gap: 14 }}>
        <Text style={{ fontSize: 40, textAlign: 'center' }}>🧺</Text>
        <Text style={[s.h1, { fontSize: 26, textAlign: 'center' }]}>{invite.list || 'A market list'}</Text>
        <Text style={[s.emptyText, { color: C.ink }]}>
          You were invited by <Text style={{ fontWeight: '700' }}>{invite.from || 'someone'}</Text> to a market list.
          You will both see the same list, and each other's ticks.
        </Text>
        {invite.n !== '' && (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
            <Avatar name={invite.from || '?'} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>Current list: {invite.n} to buy</Text>
              {invite.dishes !== '' && <Text style={s.mt}>{invite.dishes}</Text>}
            </View>
          </View>
        )}
        {error && <Text style={[s.hint, { color: C.achuete, fontSize: 14 }]}>{error}</Text>}
      </View>
      <Cta>
        <Button title={busy ? 'Joining…' : 'Join the list'} onPress={() => !busy && session && join()} />
        <Text style={s.hint}>{session ? `Signed in as ${session.user.email}` : 'Signing in…'}</Text>
      </Cta>
    </View>
  );
}
