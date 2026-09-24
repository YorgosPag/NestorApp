'use client';

/**
 * **Η ΚΑΤΩ ΓΡΑΜΜΗ ΤΗΣ ΦΟΥΣΚΑΣ — «Άνοιγμα» + σύνδεσμος της επιλογής** (ADR-777 §8.78).
 *
 * 🏆 Google Maps: η κάρτα του μέρους έχει «Share → Copy link», και ο σύνδεσμος ανοίγει **τον χάρτη
 * με την κάρτα** — ακριβώς ό,τι κάνει εδώ το `?selected=` (§8.77). Zillow/Idealista βάζουν την
 * κοινοποίηση στη σελίδα αγγελίας· αυτή ζει ήδη εκεί (`UnifiedShareDialog`). Η φούσκα μοιράζεται
 * κάτι **άλλο**: την αγγελία **μέσα στην αναζήτηση** (κριτήρια + κάδρο), που δεν έχει άλλη διαδρομή.
 *
 * 🔑 **Καμία μετατόπιση**: η απάντηση («Ο σύνδεσμος αντιγράφηκε») παίρνει τη θέση του «Άνοιγμα»
 * στην **ίδια** γραμμή, στο ίδιο ύψος — CLS 0 — και είναι `role="status"`, άρα ο αναγνώστης οθόνης
 * την ακούει χωρίς να μετακινηθεί η εστίαση από το κουμπί.
 *
 * ⚠️ **`relative z-10` στο κουμπί, ΥΠΟΧΡΕΩΤΙΚΟ**: ο σύνδεσμος του τίτλου απλώνει `::after inset-0`
 * πάνω σε **όλη** τη φούσκα (§8.58) — χωρίς στρώση, το κλικ στο κουμπί θα άνοιγε την αγγελία.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { listingSelectionHref } from '@/lib/listings/listing-focus';
import { shareOrCopyLink, type LinkShareOutcome } from '@/lib/share-utils';

/** Πόσο μένει ορατή η απάντηση — ίδια διάρκεια με το `useCopyToClipboard`. */
const OUTCOME_VISIBLE_MS = 2000;

/**
 * Τι λέει η γραμμή μετά την πράξη· `shared`/`cancelled` ⇒ το «Άνοιγμα» (το φύλλο του λειτουργικού
 * απάντησε ήδη· η ακύρωση δεν χρειάζεται σχόλιο).
 * ⚠️ **Ρητά κλειδιά, όχι πίνακας**: η πύλη ADR-744 διαβάζει στατικά ποια κλειδιά ζητά η σελίδα.
 */
function footerStatus(t: (key: string) => string, outcome: LinkShareOutcome | null): string {
  if (outcome === 'copied') return t('search-focus:popup.linkCopied');
  if (outcome === 'failed') return t('search-focus:popup.linkCopyFailed');
  return t('search-focus:popup.open');
}

interface ListingMapPopupFooterProps {
  readonly listingId: string;
  readonly title: string;
}

export function ListingMapPopupFooter({ listingId, title }: ListingMapPopupFooterProps) {
  const { t } = useTranslation(['search-focus']);
  const iconSizes = useIconSizes();
  const [outcome, setOutcome] = useState<LinkShareOutcome | null>(null);

  useEffect(() => {
    if (outcome === null) return undefined;
    const timer = setTimeout(() => setOutcome(null), OUTCOME_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [outcome]);

  // Η διεύθυνση διαβάζεται τη στιγμή του κλικ (κανόνας 2 του ADR-040): κριτήρια/κάδρο αλλάζουν όσο η φούσκα είναι ανοιχτή.
  const share = useCallback(async () => {
    setOutcome(await shareOrCopyLink({ title, url: listingSelectionHref(window.location.href, listingId) }));
  }, [listingId, title]);

  const Icon = outcome === 'copied' ? Check : Link2;

  return (
    <footer className="mt-1 flex items-center justify-between gap-2">
      <p role="status" className="min-w-0 truncate text-xs text-muted-foreground">
        {footerStatus(t, outcome)}
      </p>
      <button
        type="button"
        onClick={share}
        aria-label={t('search-focus:popup.link')}
        className="relative z-10 shrink-0 rounded p-1 text-popover-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className={iconSizes.sm} aria-hidden="true" />
      </button>
    </footer>
  );
}
