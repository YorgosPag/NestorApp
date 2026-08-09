'use client';

/**
 * **Η ΣΥΜΠΤΥΓΜΕΝΗ ΓΡΑΜΜΗ** — «3 ακόμη: μπορεί να είναι εδώ, μπορεί και όχι».
 *
 * ADR-777 Α5 §4.1 — ⛔ **Ποτέ σιωπηλή εξαφάνιση.** Όταν ο χρήστης σέρνει τον χάρτη, οι
 * αγγελίες **χωρίς δηλωμένη θέση δεν φιλτράρονται**: δεν μπορούμε να τις αποκλείσουμε
 * από περιοχή που **δεν ξέρουμε** αν τους ανήκει. Το να τις κρύψουμε θα ήταν ισχυρισμός
 * γνώσης που δεν έχουμε.
 *
 * ⚠️ **Ανοίγει ΜΕΣΑ στο ίδιο πλαίσιο** — ποτέ δεύτερη επιφάνεια (Α5 §4.2, κανόνας 21:
 * NN/g *«never stack»*).
 *
 * 🔑 Η **αιτία** εμφανίζεται ανά αγγελία, γιατί οι δύο καταστάσεις **δεν είναι
 * εναλλάξιμες**: «δεν ρωτήθηκε ποτέ» είναι **δικό μας** χρέος με θεραπεία· «ο
 * ιδιοκτήτης δεν δήλωσε» είναι **επιλογή του** και δεν ζητάμε διόρθωση.
 */

import React, { useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PublicListing, UnknownPositionReason } from '@/types/public-listing';

interface UnmappedListingsRowProps {
  readonly listings: readonly PublicListing[];
}

const REASON_KEY: Record<UnknownPositionReason, string> = {
  'never-asked': 'unmapped.reason.neverAsked',
  'owner-declined': 'unmapped.reason.ownerDeclined',
};

function reasonOf(listing: PublicListing): UnknownPositionReason | null {
  return listing.position.kind === 'unknown' ? listing.position.reason : null;
}

export function UnmappedListingsRow({ listings }: UnmappedListingsRowProps) {
  const { t } = useTranslation(['search-results']);
  const [expanded, setExpanded] = useState(false);

  // ⚠️ Στο μηδέν ΔΕΝ εμφανίζεται — και αυτό δεν αναιρεί τον κανόνα 27: το «0» το λέει
  // ήδη ρητά η λογιστική (`ListingLedgerBar`), που τυπώνεται πάντα. Εδώ θα ήταν
  // κενή γραμμή που λέει «κανένα κρυμμένο», δηλαδή θόρυβος πάνω σε ήδη ειπωμένο.
  if (listings.length === 0) return null;

  return (
    <section className="border-t border-border bg-muted/40 p-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="text-left text-sm font-medium text-foreground underline-offset-2 hover:underline"
      >
        {t('search-results:unmapped.heading', { count: listings.length })}
      </button>

      <p className="mt-1 text-xs text-muted-foreground">{t('search-results:unmapped.hint')}</p>

      {expanded && (
        <ul className="mt-2 space-y-1">
          {listings.map((listing) => {
            const reason = reasonOf(listing);
            return (
              <li key={listing.id} className="text-sm text-foreground">
                <span className="font-medium">{listing.title}</span>
                {reason && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t(`search-results:${REASON_KEY[reason]}`)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
