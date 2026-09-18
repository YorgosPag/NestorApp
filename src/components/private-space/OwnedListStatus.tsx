'use client';

/**
 * @fileoverview **Οι τέσσερις καταστάσεις μιας λίστας «τα δικά μου»** — γραμμένες μία φορά.
 * @related ADR-866 Φ1.2 (N.18 · CHECK 3.28) · services/realtime/hooks/useOwnedDocuments.ts · ADR-777 Α9/Α14
 * @module components/private-space/OwnedListStatus
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΤΟ ΖΗΤΗΣΕ Η ΠΥΛΗ, ΜΕΤΡΗΜΕΝΑ.** Οι λίστες του προσωπικού χώρου (ζητήσεις · αγγελίες · φάκελοι)
 * διαβάζουν όλες από τη **μία** μηχανή `useOwnedList`, άρα έχουν τις **ίδιες** τέσσερις καταστάσεις — και η καθεμία
 * τις απέδιδε με **δικό της** `switch`. Η τρίτη (φάκελοι, ADR-866 Φ1.2) έγινε **δίδυμο 11 γραμμών / 88 συμβόλων** της
 * δεύτερης και η CHECK 3.28 την μπλόκαρε μέσα στο ίδιο diff. Μηχανή μία ⇒ απόδοση καταστάσεων μία.
 *
 * 🔑 **Κοινό μόνο ό,τι είναι κοινό**: «συνδέσου» (ίδιο κλειδί και στις τρεις — ο `(me)` απαιτεί ταυτότητα) και το
 * σχήμα. Τα κείμενα φόρτωσης/σφάλματος **δίνονται** (κάθε λίστα λέει τι φορτώνει), και η έτοιμη λίστα είναι **της
 * λίστας** — εδώ δεν μπαίνει κανένα λεξιλόγιο τομέα.
 */

import React from 'react';
import '@/lib/design-system';

import { useTranslation } from '@/i18n/hooks/useTranslation';

/** Ό,τι έχει τις τέσσερις καταστάσεις της μηχανής — με το έτοιμο σκέλος **όπως το ονομάζει** η κάθε λίστα. */
type OwnedListLike = { readonly state: 'anonymous' | 'loading' | 'error' | 'ready' };

type Ready<S extends OwnedListLike> = Extract<S, { readonly state: 'ready' }>;

function isReady<S extends OwnedListLike>(value: S): value is Ready<S> {
  return value.state === 'ready';
}

interface OwnedListStatusProps<S extends OwnedListLike> {
  readonly state: S;
  /**
   * «Φορτώνουμε τα …» — **ήδη μεταφρασμένο** από τον καλούντα. ⚠️ Κείμενο, όχι κλειδί: ένα `t(prop)` εδώ θα ήταν
   * ανεπίλυτη δυναμική κλήση για τον γεννήτορα των route slices (ADR-744) — η στατική `t('…')` μένει εκεί που ξέρει
   * **ποια** λίστα φορτώνει.
   */
  readonly loadingText: string;
  /** «Τα … δεν φορτώθηκαν» — ήδη μεταφρασμένο, για τον ίδιο λόγο. */
  readonly errorText: string;
  /** Η έτοιμη λίστα — με την κατάσταση **ήδη στενεμένη** στο `ready` της συγκεκριμένης λίστας. */
  readonly renderReady: (ready: Ready<S>) => React.ReactElement;
}

export function OwnedListStatus<S extends OwnedListLike>({
  state,
  loadingText,
  errorText,
  renderReady,
}: OwnedListStatusProps<S>): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  if (isReady(state)) return renderReady(state);
  switch (state.state) {
    case 'anonymous':
      return <p className="text-foreground">{t('property-market:demand.space.signInNeeded')}</p>;
    case 'loading':
      return <p className="text-muted-foreground">{loadingText}</p>;
    default:
      return <p className="text-foreground">{errorText}</p>;
  }
}
