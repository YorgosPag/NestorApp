'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΜΙΑΣ ΣΥΝΟΜΙΛΙΑΣ** — `/messages/{threadId}` (ADR-867 Β9γ).
 * @related `NetworkThreadPanel` (η ίδια η συνομιλία) · `ThreadContextCard` · `NetworkThreadDirectoryBody`
 * @module components/network-messaging/NetworkThreadScreen
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🌐 ΔΥΟ ΦΥΛΛΑ — ΤΟ ΠΡΟΤΥΠΟ, ΟΧΙ Η ΠΡΟΤΙΜΗΣΗ (έρευνα 2026-09-21)
 * ────────────────────────────────────────────────────────────────────────────
 * · **Procore Conversations** — αριστερά `Direct Messages · Groups · Items`, δεξιά η συνομιλία·
 *   *«click the item to view the conversation»* **χωρίς** τη σελίδα του αντικειμένου.
 * · **Linear Split Inbox** — λίστα + ανοιγμένο θέμα μαζί, «χωρίς να χάνεις τα συμφραζόμενα».
 * · **Zillow** — ανοίγεις από το inbox και προσγειώνεσαι στο **message panel**.
 * ⇒ Σε πλατιά οθόνη η λίστα **μένει**· σε στενή μένει μόνο η συνομιλία, με τον δρόμο πίσω.
 *
 * 🔴 **Ο ΔΡΟΜΟΣ ΠΙΣΩ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟΣ, ΟΧΙ ΕΥΓΕΝΕΙΑ** (ίδιο ιδίωμα με το `MandateDetailContent`):
 * ο άνθρωπος φτάνει εδώ από **ειδοποίηση** — συχνά σε καινούργια καρτέλα χωρίς ιστορικό, όπου το
 * «πίσω» του φυλλομετρητή δεν υπάρχει. Χωρίς αυτόν τον σύνδεσμο η οθόνη είναι **αδιέξοδο**.
 *
 * 🔴 **ΓΕΩΜΕΤΡΙΑ — ΤΟ ΜΑΘΗΜΑ ΤΩΝ ~390px, ΚΑΙ ΤΟ ΔΕΥΤΕΡΟ ΜΑΘΗΜΑ ΤΩΝ 37px** (ADR-797, CHECK 3.63):
 * ρίζα **απλό `<main>` με `flex`** — ⛔ κανένα δεύτερο `ShellSurface`, ⛔ κανένα `mx-auto max-w-* p-*`,
 * ⛔ καμία κλάση ύψους.
 *
 * 🔴 **`data-shell-span="full"` — Ο ΔΗΛΩΜΕΝΟΣ ΤΡΟΠΟΣ, ΚΑΙ ΤΟΝ ΕΠΙΒΑΛΕ ΜΕΤΡΗΣΗ.** Η πρώτη γραφή
 * βασίστηκε σε **υπόθεση** ότι ο διάδρομος χωρά δύο φύλλα. Μετρημένο ζωντανά (2026-09-21): με
 * viewport **2400px** και επιφάνεια **2400px**, το `<main>` ήταν **719px** — ο διάδρομος δεν είναι
 * δηλωμένο πλάτος, είναι **αυτο-διαστασιολογημένη στήλη του grid της επιφάνειας**. Το πλαϊνό φύλλο
 * πήρε 288, η συνομιλία έμεινε με 407, και το πλαίσιο σύνθεσης με **37px**: το κείμενο έσπαγε
 * **ένα γράμμα ανά γραμμή**. Το είδε ο Giorgio σε στιγμιότυπο· **καμία** πύλη δεν το ρωτά (η 3.63
 * ρωτά «έγραψες γεωμετρία;», όχι «χωράει;» — και η 3.82, που όντως το ρωτά, τρέχει μόνο σε CI).
 *
 * ⇒ Ένα inbox δύο φύλλων **δεν είναι πρόζα**. Το `shell-surface.css` δίνει γι' αυτό ακριβώς ονομασμένη
 * διέξοδο: *«Ένας ήρωας ή ένας χάρτης μέσα σε σελίδα πρόζας ζητά ολόκληρο το πλάτος — και το ζητά με
 * ΟΝΟΜΑ, όχι με `-mx-6`»*. Αυτό είναι **αίτημα προς το κέλυφος**, όχι δική μας γεωμετρία: το πλάτος
 * το δίνει πάντα εκείνο. ⛔ **ΜΗΝ** το αντικαταστήσεις με `w-screen`/`-mx-*`/`max-w-none` — εκείνα
 * είναι το ίδιο αίτημα **χωρίς** όνομα, και η επόμενη αλλαγή του κελύφους θα τα σπάσει σιωπηλά.
 */

import * as React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNetworkThreadContext } from '@/hooks/network-messaging/useNetworkThreadContext';
import { MY_MESSAGES_ROUTE } from '@/lib/network-messaging/network-messaging-routes';
import { Link } from '@/lib/workspace/navigation';
import type { NetworkThreadContext } from '@/types/network-wire';

import { NetworkFailureNotice } from './NetworkFailureNotice';
import { DIRECTORY_KEYS, NETWORK_NS, SCREEN_KEYS } from './network-messaging-keys';
import { NetworkThreadDirectoryBody } from './NetworkThreadDirectoryBody';
import { NetworkThreadPanel } from './NetworkThreadPanel';
import { ThreadContextCard } from './ThreadContextCard';

export interface NetworkThreadScreenProps {
  readonly threadId: string;
}

/**
 * Πλευρά ⇒ όψη της συνομιλίας.
 *
 * ⚠️ Το `person` (νήμα σχέσης — Β8) παίρνει `owner`: η μόνη διαφορά της όψης `office` είναι η
 * **διαχείριση ομάδας**, και ένα νήμα σχέσης **δεν έχει ομάδα**. Δηλωμένο εδώ ώστε το Β8 να το
 * αναθεωρήσει ρητά αν χρειαστεί, αντί να το ανακαλύψει.
 */
function variantOf(side: NetworkThreadContext['side']): 'owner' | 'office' {
  return side === 'host' ? 'office' : 'owner';
}

/** Ό,τι δείχνει η δεξιά στήλη — συμφραζόμενα + η συνομιλία, ή ο λόγος που δεν υπάρχει. */
function ThreadColumn({ threadId }: NetworkThreadScreenProps): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const view = useNetworkThreadContext(threadId);

  if (view.state === 'loading') {
    return <p role="status" className="m-0 text-sm text-muted-foreground">{t(SCREEN_KEYS.loading)}</p>;
  }

  if (view.state === 'failed') {
    // 🔑 **«Δεν βρέθηκε» ΔΕΝ είναι βλάβη**: ξένο και ανύπαρκτο νήμα απαντούν ίδια (`not-audience`,
    //    ADR-742). Μια «δοκιμάστε ξανά» εκεί θα καλούσε τον άνθρωπο να επιμείνει σε πόρτα που
    //    **σωστά** δεν ανοίγει — και θα πρόδιδε ότι η διαφορά υπάρχει.
    if (view.failure === 'not-audience') {
      return (
        <section className="flex flex-col gap-1">
          <h2 className="m-0 text-lg font-semibold text-foreground">{t(SCREEN_KEYS.missing)}</h2>
          <p className="m-0 text-sm text-muted-foreground">{t(SCREEN_KEYS.missingHint)}</p>
        </section>
      );
    }
    return <NetworkFailureNotice failure={view.failure} onRetry={view.reload} />;
  }

  const { context } = view;
  return (
    <>
      <ThreadContextCard title={context.subjectTitle} href={context.subjectHref} />
      <NetworkThreadPanel threadId={threadId} teamId={context.teamId} variant={variantOf(context.side)} />
    </>
  );
}

export function NetworkThreadScreen({ threadId }: NetworkThreadScreenProps): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);

  return (
    <main data-shell-span="full" className="flex w-full flex-col gap-6">
      <nav aria-label={t(DIRECTORY_KEYS.title)}>
        <Link href={MY_MESSAGES_ROUTE} className="text-sm font-medium text-foreground underline underline-offset-4">
          ← {t(SCREEN_KEYS.back)}
        </Link>
      </nav>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        {/*
          ⚠️ `hidden lg:flex` — σε στενή οθόνη η λίστα **δεν αποδίδεται καν** ως στήλη: ο άνθρωπος
          ήρθε για **αυτή** τη συνομιλία, και ο δρόμος πίσω είναι από πάνω. Ίδια απόφαση με το
          Linear Split Inbox, που πέφτει σε μία στήλη στα στενά.
        */}
        <aside aria-label={t(DIRECTORY_KEYS.listLabel)} className="hidden flex-col gap-4 lg:flex">
          <NetworkThreadDirectoryBody currentThreadId={threadId} />
        </aside>

        <section className="flex min-w-0 flex-col gap-4">
          <ThreadColumn threadId={threadId} />
        </section>
      </section>
    </main>
  );
}
