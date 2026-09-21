'use client';

/**
 * @fileoverview **ΤΟ ΜΟΝΤΕΛΟ ΤΟΥ ΠΑΝΕΛ ΝΗΜΑΤΟΣ** — όλα τα hooks, σε έναν τόπο, ώστε η απόδοση να είναι μόνο απόδοση.
 * @related ADR-867 Β7 · `hooks/network-messaging/*`
 * @module components/network-messaging/useThreadPanelModel
 *
 * ⏱️ **Ένα «τικ» ανά λεπτό**: η αντίστροφη μέτρηση της ανάκλησης («για 12 ακόμη λεπτά») πρέπει να είναι
 * **αληθινή** τη στιγμή που ανοίγει το μενού — όχι «όσο ίσχυε στο τελευταίο render». Ο διακομιστής
 * ξανακρίνει ούτως ή άλλως (`window-expired`), αλλά η οθόνη δεν υπόσχεται κάτι που έληξε.
 * 🔗 **Ο σύνδεσμος της ειδοποίησης** (`#network-thread-<id>`, ADR-867 §8 #9) φέρνει το πάνελ στην οθόνη
 * μόλις το νήμα είναι έτοιμο — η σελίδα φορτώνει ασύγχρονα, άρα ο φυλλομετρητής δεν το βρίσκει μόνος του.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { useActTeam, useMyNetworkAway } from '@/hooks/network-messaging/useNetworkAwayAndTeam';
import { useNetworkThread } from '@/hooks/network-messaging/useNetworkThread';
import { useNetworkThreadActions } from '@/hooks/network-messaging/useNetworkThreadActions';
import { useSeatToggle, useThreadRoster } from '@/hooks/network-messaging/useThreadRoster';
import { revealInScroll } from '@/lib/a11y/reveal-in-scroll';
import { threadIdFromHash } from '@/lib/network-messaging/thread-anchor';
import type { NetworkFailure } from '@/services/network-messaging/network-thread.client';

import { usePersonLabeler } from './thread-labels';

const MINUTE_MS = 60_000;

/** Τι να πει το πάνελ μετά από ανάκληση/επεξεργασία — ποτέ σιωπή. */
export type PanelNotice =
  | { readonly kind: 'retracted'; readonly readBefore: boolean }
  | { readonly kind: 'edited-after-read' }
  | { readonly kind: 'failed'; readonly failure: NetworkFailure };

function useMinuteTick(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), MINUTE_MS);
    return () => clearInterval(timer);
  }, []);
}

function useRevealOnHash(threadId: string, ready: boolean) {
  const sectionRef = useRef<HTMLElement>(null);
  const revealed = useRef(false);
  useEffect(() => {
    if (!ready || revealed.current || sectionRef.current === null) return;
    if (threadIdFromHash(window.location.hash) !== threadId) return;
    revealed.current = true;
    revealInScroll(sectionRef.current, { urgency: 'requested', block: 'start' });
  }, [ready, threadId]);
  return sectionRef;
}

export function useThreadPanelModel(threadId: string, teamId: string | null) {
  const { user } = useAuth();
  const viewerUid = user?.uid ?? null;
  const view = useNetworkThread(threadId, viewerUid);
  const me = view.audience?.find((entry) => entry.uid === viewerUid) ?? null;
  const actions = useNetworkThreadActions(threadId, viewerUid, view.messages, view.mine?.lastReadAt ?? null);
  const roster = useThreadRoster(threadId, view.audience);
  const labeler = usePersonLabeler(roster.people, view.audience, viewerUid);
  const mute = useSeatToggle(threadId, 'muted', view.mine?.muted ?? false);
  const follow = useSeatToggle(threadId, 'following', view.mine?.following ?? false);
  const away = useMyNetworkAway(viewerUid !== null && view.thread.state === 'ready');
  const team = useActTeam(teamId);
  const [notice, setNotice] = useState<PanelNotice | null>(null);
  const sectionRef = useRevealOnHash(threadId, view.thread.state === 'ready');
  useMinuteTick();

  const { retract: retractAction, edit: editAction } = actions;
  const retract = useCallback(async (messageId: string) => {
    const result = await retractAction(messageId);
    setNotice(result.ok ? { kind: 'retracted', readBefore: result.value.readBeforeRetraction } : { kind: 'failed', failure: result.failure });
  }, [retractAction]);
  const edit = useCallback(async (messageId: string, text: string) => {
    const result = await editAction(messageId, text);
    if (!result.ok) setNotice({ kind: 'failed', failure: result.failure });
    else setNotice(result.value.edited && result.value.readBeforeEdit ? { kind: 'edited-after-read' } : null);
    return result.ok;
  }, [editAction]);

  return { viewerUid, view, me, actions, roster, labeler, mute, follow, away, team, notice, retract, edit, sectionRef };
}

export type ThreadPanelModel = ReturnType<typeof useThreadPanelModel>;
