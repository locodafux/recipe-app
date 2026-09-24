// Supabase wiring for the shared list: sign-in, the list itself, the tick queue, realtime and invites.
// The rules live in sync.ts; this file only moves data.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import app from '../app.json';
import { CHANGELOG } from './changelog.ts';
import { dishSummary, tripFromRows } from './history.ts';
import type { Line } from './merge.ts';
import { applyRows, archived, closeArchived, feedbackSent, getState, markSynced, pendingTicks, setFeedback, setPartner, setRemoteHistory, setShared, type Feedback } from './store.ts';
import { firstName, flush, linesToRows, type Row } from './sync.ts';

// The hosted project's public config. The publishable key is public by design (RLS guards the data);
// EXPO_PUBLIC_SUPABASE_* overrides both, e.g. for the local stack. Setting them to "" turns sharing off.
const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://hdfezamurbsiaygnlgto.supabase.co';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_x9lWzWltF6PbpVsxFrjqwg_EIAbq_WU';

// Implicit flow, not PKCE: the invitee's magic link is requested from the inviter's phone, so the
// invitee's phone never holds a PKCE code verifier. Tokens arrive in the link's #fragment instead.
export const supabase = URL_ && KEY
  ? createClient(URL_, KEY, {
    auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'implicit' },
  })
  : null;

AppState.addEventListener('change', (s) => {
  if (s === 'active') { supabase?.auth.startAutoRefresh(); flushFeedback(); }
  else supabase?.auth.stopAutoRefresh();
});

// --- online status (5B banner) ---

let online = true;
const onlineListeners = new Set<() => void>();
function setOnline(v: boolean) {
  if (v === online) return;
  online = v;
  onlineListeners.forEach((l) => l());
}
export const useOnline = () =>
  useSyncExternalStore((l) => (onlineListeners.add(l), () => onlineListeners.delete(l)), () => online);

// --- session ---

export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

const redirect = (queryParams?: Record<string, string>) => Linking.createURL('join', { queryParams });

/** Sign this phone in: a magic link back into the app, no password. */
export async function sendSignInLink(email: string) {
  const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect() } });
  if (error) throw error;
}

export type InvitePreview = { token: string; from: string; list: string; n: string; dishes: string };

/**
 * Handles a magic link opening the app: signs in from the #fragment and returns the invite it carries,
 * if any. The preview fields are only what the inviter's phone wrote into the link, for display on 7C.
 */
export async function openLink(url: string): Promise<{ invite?: InvitePreview; error?: string } | null> {
  if (!supabase) return null;
  const hash = new URLSearchParams(url.split('#')[1] ?? '');
  const q = Linking.parse(url).queryParams ?? {};
  const str = (k: string) => (typeof q[k] === 'string' ? (q[k] as string) : '');
  if (hash.get('error')) return { error: hash.get('error_description') ?? 'The link did not work. Ask for a new one.' };
  const access_token = hash.get('access_token');
  const refresh_token = hash.get('refresh_token');
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) return { error: error.message };
  }
  if (!str('invite')) return null;
  return { invite: { token: str('invite'), from: str('from'), list: str('list'), n: str('n'), dishes: str('dishes') } };
}

// --- the list ---

const listName = (email: string | undefined) => `${firstName(email)}'s market list`;

/**
 * Makes sure this trip's lines are on a shared list: creates the list on first use and adds lines that
 * are not on it yet. Offline or signed out, it does nothing and shopping carries on locally.
 */
export async function ensureList(lines: Line[]) {
  if (!supabase || lines.length === 0) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const me = session.user.id;
  let shared = getState().shared;
  if (shared && shared.me !== me) shared = null; // signed in as someone else since
  if (!shared) {
    const { data, error } = await supabase.from('lists').insert({ name: listName(session.user.email) }).select('id, name').single();
    if (error) return console.warn('create list failed', error.message);
    shared = { id: data.id, name: data.name, rows: [], me, owner: true };
    setShared(shared);
  }
  const have = new Set(shared.rows.map((r) => r.item));
  const add = lines.filter((l) => !have.has(l.key));
  if (add.length === 0) return;
  const start = Math.max(-1, ...shared.rows.map((r) => r.position)) + 1;
  const { data, error } = await supabase.from('list_items').insert(linesToRows(add, shared.id, start)).select();
  if (error) return console.warn('add items failed', error.message);
  applyRows(shared.id, data as Row[]);
  await syncNow();
}

let flushing = false;

/** Pull the list's rows, then push queued ticks and unchecks oldest first. Safe to call often. */
export async function syncNow() {
  const shared = getState().shared;
  if (!supabase || !shared || flushing) return;
  flushing = true;
  try {
    const [list, items] = await Promise.all([
      supabase.from('lists').select('archived_at').eq('id', shared.id).single(),
      supabase.from('list_items').select().eq('list_id', shared.id),
    ]);
    if (list.error) throw list.error;
    if (items.error) throw items.error;
    if (list.data.archived_at) return closeArchived(shared.id, list.data.archived_at, items.data as Row[]);
    applyRows(shared.id, items.data as Row[]);
    const sent = await flush(pendingTicks(), async (p) => {
      let q = supabase.from('list_items').update({ checked: p.checked }).eq('list_id', shared.id).eq('item', p.key);
      // An uncheck only undoes the tick it was tapped on. If someone else has bought the item since, it
      // matches no row and the next fetch brings their tick back: a late phone cannot un-buy it (README 4).
      if (!p.checked) q = q.eq('checked_by', p.by ?? shared.me);
      const { error } = await q;
      if (error) throw error;
    });
    markSynced(sent);
    setOnline(pendingTicks().length === 0);
    if (!shared.partner) await findPartner(shared.id, shared.me);
  } catch (e) {
    setOnline(false);
  } finally {
    flushing = false;
  }
}

async function findPartner(listId: string, me: string) {
  const { data } = await supabase!.from('invites').select('email, accepted_by').eq('list_id', listId).not('accepted_by', 'is', null);
  const p = data?.find((i) => i.accepted_by !== me);
  if (p) setPartner({ id: p.accepted_by, email: p.email });
}

/** While a list is shared: realtime for the partner's ticks and unchecks, and a retry loop for the queue. */
export function useSync(listId: string | undefined) {
  useEffect(() => {
    if (!supabase || !listId) return;
    syncNow();
    const channel = supabase
      .channel(`list:${listId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items', filter: `list_id=eq.${listId}` },
        (p) => { if (p.new && 'item' in p.new) applyRows(listId, [p.new as Row]); })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') syncNow(); // (re)connected: catch up and flush
        else if (status !== 'CLOSED') setOnline(false);
      });
    // ponytail: fixed 10 s retry, no backoff; NetInfo would flush the instant signal returns.
    const retry = setInterval(() => { if (!online || pendingTicks().length) syncNow(); }, 10_000);
    return () => { clearInterval(retry); supabase.removeChannel(channel); };
  }, [listId]);
}

// --- history (M5) ---

/**
 * Archives lists finished on this phone: first the ticks that never reached the server, then `archived_at`
 * (one-way; the database freezes the list after it). Offline, the queue waits for the next call.
 */
export async function flushArchives() {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return; // signed out, RLS would match no rows and look like success
  for (const a of getState().archiving) {
    if (a.ticks.length) {
      const { error } = await supabase.from('list_items').update({ checked: true }).eq('list_id', a.id).in('item', a.ticks);
      if (error && !/archived/.test(error.message)) return; // offline: try again later
    }
    const { error } = await supabase.from('lists').update({ archived_at: new Date().toISOString() }).eq('id', a.id);
    if (error && !/archived/.test(error.message)) return; // already archived by the partner counts as done
    archived(a.id);
  }
}

/** Every archived list this user is a member of, with its rows, into History. */
export async function refreshHistory() {
  if (!supabase) return;
  await flushArchives();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { data, error } = await supabase.from('lists').select('id, archived_at, list_items(*)').not('archived_at', 'is', null);
  if (error) return console.warn('history failed', error.message);
  setRemoteHistory(data.map((l) => tripFromRows(l.id, l.archived_at!, l.list_items as Row[])));
}

// --- feedback ---

let sendingFeedback = false;

/**
 * Sends feedback queued on this phone, oldest first, as the user who wrote it; offline or signed in as
 * someone else, it stays queued for the next call (app start, back in the foreground, the Feedback screen).
 */
export async function flushFeedback() {
  if (!supabase || sendingFeedback) return;
  sendingFeedback = true;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    for (const q of getState().outbox.filter((o) => o.by === session.user.id)) {
      // ponytail: a reply lost after the insert landed sends it twice; add a client id if that shows up.
      const { error } = await supabase.from('feedback').insert({ description: q.description,
        app_version: `${app.expo.version} (${CHANGELOG[0]?.id})`, platform: Platform.OS, os_version: String(Platform.Version) });
      if (error) return console.warn('feedback not sent', error.message);
      feedbackSent(q);
    }
  } finally {
    sendingFeedback = false;
  }
}

/** Sends what is queued, then fetches what this user has sent, with its status. */
export async function refreshFeedback() {
  await flushFeedback();
  const { error, data } = await supabase!.from('feedback').select('id, user_id, description, status, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  setFeedback(data as Feedback[]);
}

// --- invites (7A/7B/7C) ---

/** Error text for the invite screens; a dropped connection reads as the offline state it is, not a crash. */
export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
  return /fetch|network/i.test(msg) ? 'No signal. This needs a connection — try again when you are back online.' : msg;
}

export type Invite = { id: string; email: string; token: string; created_at: string; accepted_at: string | null };

export async function listInvites(listId: string): Promise<Invite[]> {
  const { data, error } = await supabase!.from('invites').select('id, email, token, created_at, accepted_at')
    .eq('list_id', listId).order('created_at');
  if (error) throw error;
  return data;
}

/** Emails the invitee a magic link whose redirect carries the token and what 7C previews. */
export async function sendInviteLink(invite: Pick<Invite, 'email' | 'token'>, lines: Line[]) {
  const { data: { session } } = await supabase!.auth.getSession();
  const shared = getState().shared!;
  const dishes = [...new Set(lines.flatMap((l) => l.from.map((f) => f.dish)))];
  const preview = { invite: invite.token, from: session?.user.email ?? '', list: shared.name, n: String(lines.length),
    dishes: dishSummary(dishes) };
  const { error } = await supabase!.auth.signInWithOtp({ email: invite.email, options: { emailRedirectTo: redirect(preview) } });
  if (error) throw error;
}

export async function invite(email: string, lines: Line[]) {
  const shared = getState().shared!;
  const { data, error } = await supabase!.from('invites').insert({ list_id: shared.id, email }).select('email, token').single();
  if (error) throw error;
  await sendInviteLink(data, lines);
}

export async function cancelInvite(id: string) {
  const { error } = await supabase!.from('invites').delete().eq('id', id);
  if (error) throw error;
}

/** 7C "Join the list": accept, then shop on the inviter's list instead of this phone's own. */
export async function acceptInvite(preview: InvitePreview) {
  const { data: listId, error } = await supabase!.rpc('accept_invite', { p_token: preview.token });
  if (error) throw error;
  const { data: { session } } = await supabase!.auth.getSession();
  const [list, items] = await Promise.all([
    supabase!.from('lists').select('id, name, created_by').eq('id', listId).single(),
    supabase!.from('list_items').select().eq('list_id', listId),
  ]);
  if (list.error) throw list.error;
  if (items.error) throw items.error;
  setShared({ id: list.data.id, name: list.data.name, rows: items.data as Row[], me: session!.user.id, owner: false,
    partner: { id: list.data.created_by, email: preview.from } }, true);
}
