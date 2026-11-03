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
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

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

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (TEXT_ENTRY.has((event.target as HTMLElement).tagName)) return;
    const current = activeId;
    const run = (action: () => void) => { event.preventDefault(); action(); };

    switch (event.key) {
      case 'j': case 'ArrowDown': return run(() => move(1));
      case 'k': case 'ArrowUp': return run(() => move(-1));
      case 'Home': return run(() => focusRow(ids[0] ?? null));
      case 'End': return run(() => focusRow(ids[ids.length - 1] ?? null));
    }
    if (current === null || !isOnRow(event)) return;
    switch (event.key) {
      case 'Enter': case 'o': return run(() => handlers.open(current));
      case 'e': return run(() => { focusRow(neighbourAfterRemoval(ids, current)); handlers.dismiss(current); });
      case 'I': return run(() => handlers.markRead(current));
      case 'U': return run(() => handlers.markUnread(current));
    }
  }, [activeId, focusRow, handlers, ids, move]);

  return { activeId, setActiveId: setRequestedId, register, onKeyDown };
}
