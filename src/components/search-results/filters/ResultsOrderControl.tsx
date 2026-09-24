'use client';

/**
 * **Η ΣΕΙΡΑ ΤΩΝ ΑΠΟΤΕΛΕΣΜΑΤΩΝ, ΣΤΗΝ ΚΟΡΥΦΗ ΤΗΣ ΛΙΣΤΑΣ** — επιλογέας + η δήλωση του κανόνα βύθισης.
 *
 * @related ADR-777 §8.61 · §8.80 · ResultsOrderSelect · ResultsListHeader
 * @module components/search-results/filters/ResultsOrderControl
 *
 * 🔑 **§8.80: μετακομίζει από τη γραμμή φίλτρων στην κεφαλίδα της λίστας** — εκεί όπου η Zillow
 * γράφει «60,721 results · Sort: Homes for You». Η σειρά είναι ερώτηση **της λίστας** (ο χάρτης
 * δεν έχει σειρά, έχει θέσεις — §8.61), άρα ο επιλογέας της ζει **πάνω από τη λίστα**, όχι πάνω
 * από χάρτη και λίστα μαζί. Η υποχρέωση διαφάνειας (Καν. ΕΕ 2019/1150 · Οδηγία ΕΕ 2019/2161)
 * ικανοποιείται **καλύτερα**: ο κανόνας κατάταξης κάθεται δίπλα σε ό,τι κατατάσσει.
 *
 * 🔴 **Η ΣΙΩΠΗ ΤΗΣ ΒΥΘΙΣΗΣ ΘΑ ΗΤΑΝ ΑΔΗΛΩΤΗ ΚΑΤΑΤΑΞΗ.** Στη διάταξη «νεότερες», οι αγγελίες χωρίς
 * καταγεγραμμένη ημερομηνία πέφτουν στο τέλος — και αυτό **λέγεται** ({@link ResultsOrderNote}),
 * μία φορά, μόνο όταν υπάρχει τέτοια αγγελία *(μονίμως ορατή σημείωση που δεν αφορά τίποτα διδάσκει
 * να αγνοείται)*. ⚠️ Ζει **κάτω από τις λογιστικές, σε μία γραμμή** — μετρήθηκε ζωντανά ότι κάτω από
 * τον επιλογέα αναδιπλωνόταν σε τρεις γραμμές και έσπρωχνε τη λίστα κάτω.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ListingOrder } from '@/lib/listings/listing-results-order';
import type { PublicListing } from '@/types/public-listing';

import { ResultsOrderSelect } from './ResultsOrderSelect';

interface ResultsOrderControlProps {
  readonly order: ListingOrder;
  readonly onChange: (order: ListingOrder) => void;
}

export function ResultsOrderControl({ order, onChange }: ResultsOrderControlProps) {
  return <ResultsOrderSelect order={order} onChange={onChange} className="h-8 w-48 shrink-0" />;
}

interface ResultsOrderNoteProps {
  readonly order: ListingOrder;
  /** Ο κατάλογος εντός εμβέλειας — για να ξέρουμε αν υπάρχει αγγελία που βυθίζεται. */
  readonly listings: readonly PublicListing[];
}

export function ResultsOrderNote({ order, listings }: ResultsOrderNoteProps) {
  const { t } = useTranslation(['search-filters']);
  const sinks = order === 'newest' && listings.some((listing) => listing.listedAt.kind === 'unknown');
  if (!sinks) return null;
  return <p className="m-0 text-xs text-muted-foreground">{t('search-filters:filters.sort.unknownLast')}</p>;
}
