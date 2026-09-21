'use client';

/**
 * @fileoverview **Ο ΚΟΡΜΟΣ ΤΟΥ ΚΑΤΑΛΟΓΟΥ** — μήνυμα κατάστασης · λίστα · «παλαιότερες» (ADR-867 Β9γ).
 * @related `NetworkThreadDirectoryContent` (η σελίδα) · `NetworkThreadScreen` (το πλαϊνό φύλλο)
 * @module components/network-messaging/NetworkThreadDirectoryBody
 *
 * 🔑 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΓΙΑΤΙ ΠΡΙΝ ΤΗ ΔΕΥΤΕΡΗ ΧΡΗΣΗ**: ο κατάλογος εμφανίζεται πλέον σε
 * **δύο** θέσεις — ως **σελίδα** (`/messages`) και ως **πλαϊνό φύλλο** δίπλα στην ανοιχτή συνομιλία
 * (`/messages/{threadId}`, το πρότυπο του Linear Split Inbox και του Procore Conversations). Μια
 * αντιγραφή του `<ul>` στη δεύτερη οθόνη θα ήταν **δίδυμο** που το CHECK 3.28 θα το έπιανε, και που
 * θα απέκλινε την ημέρα που η μία όψη μάθαινε κάτι που η άλλη δεν έμαθε (N.0.2 — ο κανόνας του
 * προσκόπου: το κοινό εξάγεται **πριν** γραφτεί το δεύτερο αντίγραφο, όχι μετά).
 *
 * ⚠️ **Καμία γεωμετρία εδώ**: ο κορμός δεν ξέρει αν ζει σε σελίδα ή σε στήλη — διάδρομο και μέτρο
 * τα κατέχει ο καλών (ADR-797, CHECK 3.63).
 */

import * as React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNetworkThreadDirectory } from '@/hooks/network-messaging/useNetworkThreadDirectory';

import { NetworkFailureNotice } from './NetworkFailureNotice';
import { DIRECTORY_KEYS, NETWORK_NS } from './network-messaging-keys';
import { NetworkThreadRow } from './NetworkThreadRow';

/** Κενό, αποτυχία ή «φορτώνει» — **μία** θέση, ώστε να μη δείχνουν δύο ταυτόχρονα. */
function DirectoryNotice({ view }: { readonly view: ReturnType<typeof useNetworkThreadDirectory> }): React.ReactElement | null {
  const { t } = useTranslation([NETWORK_NS]);

  if (view.failure !== null) return <NetworkFailureNotice failure={view.failure} onRetry={view.reload} />;
  if (view.isLoading && view.items.length === 0) {
    return <p role="status" className="m-0 text-sm text-muted-foreground">{t(DIRECTORY_KEYS.loading)}</p>;
  }
  if (view.items.length === 0) {
    return (
      <section className="flex flex-col gap-1">
        <p className="m-0 text-sm font-medium text-foreground">{t(DIRECTORY_KEYS.empty)}</p>
        <p className="m-0 text-sm text-muted-foreground">{t(DIRECTORY_KEYS.emptyHint)}</p>
      </section>
    );
  }
  return null;
}

export interface NetworkThreadDirectoryBodyProps {
  /** Η συνομιλία που είναι **ανοιχτή τώρα** — `null` στη σελίδα του καταλόγου. */
  readonly currentThreadId?: string | null;
}

export function NetworkThreadDirectoryBody({
  currentThreadId = null,
}: NetworkThreadDirectoryBodyProps): React.ReactElement {
  const { t } = useTranslation([NETWORK_NS]);
  const view = useNetworkThreadDirectory();

  return (
    <>
      <DirectoryNotice view={view} />

      {view.items.length > 0 && (
        <ul aria-label={t(DIRECTORY_KEYS.listLabel)} className="m-0 flex list-none flex-col gap-2 p-0">
          {view.items.map((item) => (
            <NetworkThreadRow key={item.threadId} item={item} current={item.threadId === currentThreadId} />
          ))}
        </ul>
      )}

      {view.hasMore && (
        <footer className="flex justify-center">
          <button
            type="button"
            onClick={view.loadMore}
            disabled={view.isLoading}
            className="text-sm font-medium text-foreground underline underline-offset-4 disabled:opacity-60"
          >
            {t(view.isLoading ? DIRECTORY_KEYS.loading : DIRECTORY_KEYS.loadMore)}
          </button>
        </footer>
      )}
    </>
  );
}
