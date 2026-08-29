'use client';

/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΤΩΝ ΕΙΣΕΡΧΟΜΕΝΩΝ** — φόρτωση, άνοιγμα, απόφαση.
 * @related ADR-827 §9.21 · services/mandate/mandate-inbox.client.ts
 * @module hooks/mandate/useMandateInbox
 *
 * 🔴 **ΜΕΤΑ ΑΠΟ ΚΑΘΕ ΑΠΟΦΑΣΗ, ΞΑΝΑΦΟΡΤΩΝΕΙ — ΔΕΝ «ΔΙΟΡΘΩΝΕΙ» ΤΗ ΓΡΑΜΜΗ ΤΟΠΙΚΑ.**
 * Ένα αισιόδοξο *«τώρα είναι στα κριμένα»* θα ήταν **τρίτος** ταξινομητής, μετά τον
 * διακομιστή και τον κοινό κριτή — και θα απέκλινε την πρώτη φορά που κάποιος άλλαζε
 * τον κανόνα σε ένα από τα δύο άλλα σημεία. Το κόστος είναι μία ανάγνωση· το όφελος
 * είναι ότι υπάρχει **μία** αλήθεια για το τι βλέπει ο μεσίτης.
 *
 * 🔴 **ΠΕΡΙΜΕΝΕ ΤΗΝ ΤΑΥΤΟΤΗΤΑ ΠΡΙΝ ΡΩΤΗΣΕΙΣ — ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ, 2026-08-28.**
 * Χωρίς αυτό ο κατάλογος εντολών έγραφε **πάντα** «δεν φορτώθηκαν» στο πρώτο άνοιγμα:
 * **0 από 251** αιτήματα έφταναν στον διακομιστή, γιατί ο `apiClient` πετά συγχρόνως
 * `401` όσο ο `auth.currentUser` είναι `null`, και το `onAuthStateChanged` απλώς
 * **καταγράφει** τον χρήστη αργότερα — δεν ξαναζητά τίποτα.
 *
 * ⚠️ **Το «περίμενε» δεν είναι ευγένεια: αλλιώς η οθόνη ΨΕΥΔΕΤΑΙ** — λέει «δεν
 * φορτώθηκαν» ενώ ο διακομιστής **δεν ρωτήθηκε ποτέ**, και ο μεσίτης συμπεραίνει ότι
 * έχει πρόβλημα ο λογαριασμός του.
 *
 * ⚠️ **Η γραμμή που δουλεύει ονομάζεται** ({@link MandateInboxState.busyId}), ώστε η
 * οθόνη να κλειδώνει **μόνο** τα δικά της κουμπιά. Ένα καθολικό «φορτώνει» θα πάγωνε
 * όλη τη λίστα επειδή μία γραμμή αποφασίζεται.
 */

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import {
  decideMandateRequestFromScreen,
  fetchMandateInbox,
  openMandateRequest,
  type DecisionResult,
  type OpenResult,
} from '@/services/mandate/mandate-inbox.client';
import type { MandateInbox } from '@/services/mandate/mandate-inbox.service';
import type {
  MandateRequestDecision,
  MandateRequestForAgency,
} from '@/types/mandate-request';

/** Το αποτέλεσμα της **τελευταίας** απόφασης, όπως το δείχνει η οθόνη. */
export interface InboxFeedback {
  readonly requestId: string;
  readonly result: DecisionResult;
}

export type MandateInboxState =
  | { readonly state: 'loading' }
  | { readonly state: 'failed' }
  | {
      readonly state: 'ready';
      readonly inbox: MandateInbox;
      readonly busyId: string | null;
      readonly feedback: InboxFeedback | null;
      /**
       * Το αίτημα που είναι **ανοιχτό** αυτή τη στιγμή — `null` όταν κανένα.
       *
       * 🔑 Κρατιέται **ξεχωριστά** από τη λίστα και **δεν** τη συγχωνεύει: η λίστα λέει
       * *τι υπάρχει*, το ανοιχτό λέει *τι κοιτάζω*. Μια συγχώνευση θα σήμαινε ότι το
       * `seenAt` του ενός γράφεται πάνω σε στιγμιότυπο των είκοσι.
       */
      readonly opened: MandateRequestForAgency | null;
    };

export interface MandateInboxApi {
  readonly view: MandateInboxState;
  readonly reload: () => void;
  readonly open: (requestId: string) => void;
  readonly close: () => void;
  readonly decide: (requestId: string, decision: MandateRequestDecision) => void;
}

export function useMandateInbox(): MandateInboxApi {
  const [inbox, setInbox] = useState<MandateInbox | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<InboxFeedback | null>(null);
  const [opened, setOpened] = useState<MandateRequestForAgency | null>(null);
  const [epoch, setEpoch] = useState(0);

  const { user, loading: authLoading } = useAuth();
  // ⚠️ **Πρωτογενής εξάρτηση, όχι το αντικείμενο**: το `user` του context
  //    ανακατασκευάζεται και θα ξανάτρεχε το effect σε κάθε απόδοση — δηλαδή θα
  //    ξαναδιάβαζε τα εισερχόμενα σε βρόχο.
  const userId = user?.uid ?? null;

  useEffect(() => {
    // Όσο δεν ξέρουμε **ποιος** ρωτά, η οθόνη μένει «φορτώνει» — που είναι η αλήθεια.
    if (authLoading) return;

    let alive = true;
    setInbox(null);
    setLoadFailed(false);

    // Λύθηκε η ταυτότητα και **δεν υπάρχει κανείς**: τα εισερχόμενα είναι αδύνατα.
    // Αυτό λέγεται, δεν σιωπά — αλλιώς η οθόνη θα γύριζε για πάντα.
    if (userId === null) {
      setLoadFailed(true);
      return;
    }

    void fetchMandateInbox().then((load) => {
      if (!alive) return;
      if (load.kind === 'ready') setInbox(load.inbox);
      else setLoadFailed(true);
    });

    return () => {
      alive = false;
    };
  }, [epoch, authLoading, userId]);

  const reload = useCallback(() => setEpoch((value) => value + 1), []);

  const open = useCallback((requestId: string) => {
    setBusyId(requestId);
    setFeedback(null);

    void openMandateRequest(requestId).then((result: OpenResult) => {
      setBusyId(null);
      setOpened(result.kind === 'opened' ? result.request : null);
      // 🔑 **Το άνοιγμα άλλαξε τη βάση** (`seenAt`), άρα η λίστα είναι πλέον μπαγιάτικη
      //    ως προς τον μετρητή «αδιάβαστα». Ξαναφόρτωση, ποτέ τοπική μείωση κατά ένα:
      //    δεύτερος μετρητής είναι δεύτερο βιβλίο (ADR-749).
      if (result.kind === 'opened') reload();
    });
  }, [reload]);

  const close = useCallback(() => setOpened(null), []);

  const decide = useCallback(
    (requestId: string, decision: MandateRequestDecision) => {
      setBusyId(requestId);
      setFeedback(null);

      void decideMandateRequestFromScreen(requestId, decision).then((result) => {
        setBusyId(null);
        setFeedback({ requestId, result });
        // ⚠️ Ξαναφόρτωση **μόνο** σε επιτυχία: μια άρνηση δεν άλλαξε τίποτα στη βάση,
        //    και μια περιττή ανάγνωση θα έσβηνε το μήνυμα προτού προλάβει να διαβαστεί.
        if (result.kind === 'decided') {
          setOpened(null);
          reload();
        }
      });
    },
    [reload],
  );

  if (loadFailed) return { view: { state: 'failed' }, reload, open, close, decide };
  if (inbox === null) return { view: { state: 'loading' }, reload, open, close, decide };
  return {
    view: { state: 'ready', inbox, busyId, feedback, opened },
    reload,
    open,
    close,
    decide,
  };
}
