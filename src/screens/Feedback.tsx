// Feedback: send an idea, a wish or a fault from the app, and see what you sent and whether it is done.
// It needs an account, so it can be read back: signed out, it signs this phone in first (as Invite does).
// Offline it is queued on the phone and sent by remote.ts flushFeedback(). The status is set outside the app.
import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { tripDate } from '../history.ts';
import { errorText, refreshFeedback, sendSignInLink, supabase, useSession } from '../remote.ts';
import { getState, queueFeedback, useStore, type Feedback as Sent } from '../store.ts';
import { Badge, Button, C, Header, s } from '../ui.tsx';
import { EmailForm } from './Invite.tsx';

const STATUS: Record<Sent['status'], { text: string; fg: string; bg: string }> = {
  open: { text: 'Received', fg: C.ink2, bg: C.line },
  planned: { text: 'Planned', fg: C.ube, bg: C.ubeSoft },
  done: { text: 'Done', fg: C.dahon, bg: C.dahonSoft },
};

export function Feedback({ onBack }: { onBack: () => void }) {
  const session = useSession();
  const { outbox, feedback } = useStore();
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const me = session?.user.id;
  const refresh = () => refreshFeedback().then(() => setError(null), (e) => setError(errorText(e)));
  useEffect(() => { if (me) refresh(); }, [me]);

  if (!supabase) {
    return (
      <View style={s.screen}>
        <Header onBack={onBack} title="Feedback" />
        <View style={s.empty}><Text style={s.emptyText}>Feedback is turned off in this build (EXPO_PUBLIC_SUPABASE_URL is empty).</Text></View>
      </View>
    );
  }

  if (!me) {
    return (
      <View style={s.screen}>
        <Header onBack={onBack} title="Feedback" sub="Ideas, wishes, or something that went wrong" />
        <EmailForm title="First, your email"
          help="So you can see what you sent and when it is done. We will email you a link — tap it and you are signed in, no password."
          button="Email me a sign-in link" error={error}
          sent={sent && `Check ${sent}: the link signs you in on this phone.`}
          onSubmit={(email) => { setError(null); sendSignInLink(email).then(() => setSent(email), (e) => setError(errorText(e))); }} />
      </View>
    );
  }

  const ok = text.trim().length > 0;
  const send = () => {
    if (!ok) return;
    queueFeedback(me, text.trim());
    setText('');
    setNote('Thank you! It is saved on this phone and sends as soon as there is signal.');
    refresh().then(() => { if (!getState().outbox.some((o) => o.by === me)) setNote('Thank you — sent.'); });
  };
  const waiting = outbox.filter((o) => o.by === me);
  const mine = feedback.filter((f) => f.user_id === me);

  return (
    <View style={s.screen}>
      <Header onBack={onBack} title="Feedback" sub="Ideas, wishes, or something that went wrong" />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <Text style={[s.mt, { fontSize: 14, lineHeight: 20 }]}>
            Something you wish it did, an idea for the list, or anything that got in the way — all of it helps.
          </Text>
          <TextInput value={text} onChangeText={setText} multiline placeholder="What would make it better?" placeholderTextColor={C.ink2}
            accessibilityLabel="Your feedback" textAlignVertical="top"
            style={[s.search, { marginHorizontal: 0, marginBottom: 0, height: 120, paddingVertical: 11, alignItems: 'flex-start', fontSize: 16, color: C.ink }]} />
          <Button small title="Send feedback" onPress={send} style={!ok ? { opacity: 0.5 } : undefined} />
          {note && <Text style={[s.hint, { color: C.dahon }]}>{note}</Text>}
        </View>
        {(waiting.length > 0 || mine.length > 0) && (
          <Text style={[s.lab, { marginHorizontal: 16, marginTop: 22, marginBottom: 7 }]}>What you sent</Text>
        )}
        {error && <Text style={[s.hint, { marginBottom: 7, marginHorizontal: 16 }]}>{error}</Text>}
        <View style={{ borderTopWidth: waiting.length || mine.length ? 1 : 0, borderTopColor: C.line }}>
          {waiting.map((q) => (
            <Row key={q.at} when={new Date(q.at).toISOString()} text={q.description} badge={{ text: 'Waiting to send', fg: C.tanso, bg: C.tansoSoft }} />
          ))}
          {mine.map((f) => <Row key={f.id} when={f.created_at} text={f.description} badge={STATUS[f.status] ?? STATUS.open} />)}
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ when, text, badge }: { when: string; text: string; badge: { text: string; fg: string; bg: string } }) {
  return (
    <View style={[s.row, { alignItems: 'flex-start', paddingVertical: 4 }]}>
      <View style={s.main}>
        <Text style={[s.nm, { fontSize: 15.5, fontWeight: '500' }]} numberOfLines={3}>{text}</Text>
        <Text style={s.mt}>{tripDate(when)}</Text>
      </View>
      <View style={{ marginTop: 10 }}><Badge text={badge.text} fg={badge.fg} bg={badge.bg} /></View>
    </View>
  );
}
