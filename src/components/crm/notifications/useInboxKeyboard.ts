'use client';

/**
 * @fileoverview **ΠΛΗΚΤΡΟΛΟΓΙΟ ΤΟΥ INBOX** — j/k μετακίνηση, Enter άνοιγμα, e απόρριψη, Shift+I/U κατάσταση.
 * @related ADR-927 · GitHub Notifications (E = Done · Shift+I/U) · Gmail (j/k)
 * @module components/crm/notifications/useInboxKeyboard
 *
 * Roving tabindex (WAI-ARIA APG «Grid/List with roving focus»): **ένα** στοιχείο της λίστας είναι στη σειρά
 * του Tab, τα βέλη/j/k μετακινούν την εστίαση. Οι συντομεύσεις ισχύουν **μόνο** όταν η εστίαση είναι πάνω
 * σε στοιχείο της λίστας — ποτέ μέσα σε πεδίο κειμένου, ποτέ με Ctrl/Alt/Meta (ανήκουν στον browser).
 *
 * Μετά από απόρριψη η εστίαση πάει στο **επόμενο** (ή στο προηγούμενο, αν ήταν τελευταίο) — όπως το Gmail
 * μετά την αρχειοθέτηση: ο άνθρωπος συνεχίζει χωρίς να ξαναβρεί τη θέση του.
 *
 * 🔴 ADR-927 §12 (μετρημένο στην παραγωγή 2026-11-03): η σύγκριση `event.key === 'j'` δεν δούλευε ΠΟΤΕ με
 *    ελληνική διάταξη (`ξ`), και το `'I'` ταίριαζε με Caps Lock χωρίς Shift. Η πρόθεση βγαίνει πλέον από το
 *    `inboxIntentOf` (`latinLetterOf` + `shiftKey`). Και η μετακίνηση δουλεύει και από το `body`.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { latinLetterOf, type LetterKeyEvent } from '@/lib/keyboard/latin-letter';

export interface InboxKeyboardHandlers {
  readonly open: (id: string) => void;
  readonly dismiss: (id: string) => void;
  readonly markRead: (id: string) => void;
  readonly markUnread: (id: string) => void;
}

export interface InboxKeyboard {
  /** Το στοιχείο που είναι στη σειρά του Tab (roving tabindex). */
  readonly activeId: string | null;
  readonly setActiveId: (id: string) => void;
  /** Καταχώριση του DOM στοιχείου κάθε γραμμής — για μετακίνηση εστίασης. */
  readonly register: (id: string) => (el: HTMLElement | null) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

const TEXT_ENTRY = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export type InboxIntent = 'next' | 'prev' | 'first' | 'last' | 'open' | 'dismiss' | 'read' | 'unread';

/** Γράμμα χωρίς Shift → πρόθεση· με Shift → πρόθεση. Το Shift κρίνεται ΜΟΝΟ από το `shiftKey` (όχι Caps Lock). */
const PLAIN_LETTERS: Readonly<Record<string, InboxIntent>> = { j: 'next', k: 'prev', o: 'open', e: 'dismiss' };
const SHIFT_LETTERS: Readonly<Record<string, InboxIntent>> = { i: 'read', u: 'unread' };
const NAMED_KEYS: Readonly<Record<string, InboxIntent>> = {
  ArrowDown: 'next', ArrowUp: 'prev', Home: 'first', End: 'last', Enter: 'open',
};

interface IntentKeyEvent extends LetterKeyEvent {
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

/**
 * **Τι ζητά το πλήκτρο;** — ανεξάρτητα από τη διάταξη (`latinLetterOf`: `ξ` ⇒ `j`, `Ι` ⇒ `i`). Ποτέ με
 * Ctrl/Alt/Meta (ανήκουν στον browser και στο λειτουργικό).
 */
export function inboxIntentOf(event: IntentKeyEvent): InboxIntent | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  const named = NAMED_KEYS[event.key];
  if (named) return named;
  const letter = latinLetterOf(event);
  if (letter === null) return null;
  return (event.shiftKey ? SHIFT_LETTERS[letter] : PLAIN_LETTERS[letter]) ?? null;
}

function isOnRow(event: KeyboardEvent<HTMLElement>): boolean {
  const target = event.target as HTMLElement;
  return target.dataset.inboxRow !== undefined;
}

function neighbourAfterRemoval(ids: readonly string[], id: string): string | null {
  const i = ids.indexOf(id);
  return ids[i + 1] ?? ids[i - 1] ?? null;
}

export function useInboxKeyboard(ids: readonly string[], handlers: InboxKeyboardHandlers): InboxKeyboard {
  const [requestedId, setRequestedId] = useState<string | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const pendingFocus = useRef<string | null>(null);

  // Το ενεργό πρέπει να υπάρχει στη λίστα (φίλτρο ή απόρριψη μπορεί να το αφαίρεσαν) — αλλιώς το πρώτο.
  const activeId = requestedId !== null && ids.includes(requestedId) ? requestedId : (ids[0] ?? null);

  // Μία σταθερή συνάρτηση ref ανά γραμμή: νέα σε κάθε απόδοση θα ακύρωνε το `memo` της γραμμής και θα
  // έκανε το React να την καλεί null → στοιχείο σε κάθε απόδοση.
  const refCallbacks = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const register = useCallback((id: string) => {
    let cb = refCallbacks.current.get(id);
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        if (el) nodes.current.set(id, el);
        else { nodes.current.delete(id); refCallbacks.current.delete(id); }
      };
      refCallbacks.current.set(id, cb);
    }
    return cb;
  }, []);

  const focusRow = useCallback((id: string | null) => {
    if (id === null) return;
    setRequestedId(id);
    pendingFocus.current = id;
  }, []);

  useEffect(() => {
    const id = pendingFocus.current;
    if (id === null) return;
    const el = nodes.current.get(id);
    if (!el) return;
    pendingFocus.current = null;
    el.focus();
  });

  const move = useCallback((delta: number) => {
    if (ids.length === 0) return;
    const i = activeId === null ? -1 : ids.indexOf(activeId);
    focusRow(ids[Math.min(ids.length - 1, Math.max(0, i + delta))] ?? null);
  }, [activeId, focusRow, ids]);

  const navigate = useCallback((intent: InboxIntent): boolean => {
    switch (intent) {
      case 'next': move(1); return true;
      case 'prev': move(-1); return true;
      case 'first': focusRow(ids[0] ?? null); return true;
      case 'last': focusRow(ids[ids.length - 1] ?? null); return true;
      default: return false;
    }
  }, [focusRow, ids, move]);

  const act = useCallback((intent: InboxIntent, current: string): boolean => {
    switch (intent) {
      case 'open': handlers.open(current); return true;
      case 'dismiss': focusRow(neighbourAfterRemoval(ids, current)); handlers.dismiss(current); return true;
      case 'read': handlers.markRead(current); return true;
      case 'unread': handlers.markUnread(current); return true;
      default: return false;
    }
  }, [focusRow, handlers, ids]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (TEXT_ENTRY.has((event.target as HTMLElement).tagName)) return;
    const intent = inboxIntentOf(event);
    if (intent === null) return;
    const handled = navigate(intent) || (activeId !== null && isOnRow(event) && act(intent, activeId));
    if (handled) event.preventDefault();
  }, [act, activeId, navigate]);

  useBodyNavigation(activeId, ids, focusRow);

  return { activeId, setActiveId: setRequestedId, register, onKeyDown };
}

/**
 * 🔑 **Από το σώμα της σελίδας** (Gmail): μετά τη φόρτωση η εστίαση είναι στο `body` — το `j` πρέπει να δουλεύει
 *    χωρίς να πατήσει κανείς πρώτα Tab. Μόνο **μετακίνηση**: οι ενέργειες (e · I · U · Enter) θέλουν πάντα
 *    εστιασμένη γραμμή, ώστε ένα αδέσποτο πλήκτρο να μη γράψει ποτέ σε ειδοποίηση που ο άνθρωπος δεν βλέπει.
 *    Το πρώτο j/k εστιάζει την **τρέχουσα** γραμμή (όχι την επόμενη): ο άνθρωπος δεν έχει διαλέξει ακόμη καμία.
 */
function useBodyNavigation(activeId: string | null, ids: readonly string[], focusRow: (id: string | null) => void): void {
  useEffect(() => {
    const onWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.target !== document.body || event.defaultPrevented) return;
      const intent = inboxIntentOf(event);
      if (intent === 'next' || intent === 'prev') focusRow(activeId);
      else if (intent === 'first') focusRow(ids[0] ?? null);
      else if (intent === 'last') focusRow(ids[ids.length - 1] ?? null);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [activeId, focusRow, ids]);
}
