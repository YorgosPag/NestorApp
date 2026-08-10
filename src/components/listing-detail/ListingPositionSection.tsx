'use client';

/**
 * **Πού είναι το ακίνητο — και τι ακριβώς σημαίνει αυτό που βλέπεις.**
 *
 * @related ADR-777 §7 (Α5 · Α7 · κανόνας 18) · lib/listings/listing-map-shape · CHECK 3.41
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΣΧΗΜΑ ΤΟ ΛΕΕΙ ΣΤΟΝ ΧΑΡΤΗ· ΕΔΩ ΤΟ ΛΕΜΕ ΚΑΙ ΜΕ ΛΕΞΕΙΣ — ΚΑΙ ΤΑ ΔΥΟ ΧΡΕΙΑΖΟΝΤΑΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Στην οθόνη 2 η ακρίβεια εκφράζεται **γεωμετρικά** (πινέζα · δακτύλιος · σκιασμένη
 * ζώνη · πόλη), γιατί εκεί συγκρίνονται δεκάδες αγγελίες μεταξύ τους. Σε **μία**
 * αγγελία δεν υπάρχει σύγκριση: ένας σκιασμένος κύκλος **μόνος του** δεν διδάσκει
 * τίποτα — ο επισκέπτης δεν ξέρει ότι θα μπορούσε να είναι πινέζα.
 *
 * Είναι η **CHECK 3.41** στη σωστή της γενίκευση: ένα κανάλι που ξεχωρίζει μόνο **σε
 * αντιπαράθεση** δεν είναι κανάλι όταν το αντικείμενο είναι ένα. Άρα εδώ προστίθεται
 * **δεύτερο, γλωσσικό** κανάλι — και τα δύο διαβάζουν το **ίδιο** `listingMapShape`,
 * οπότε δεν μπορούν να διαφωνήσουν.
 *
 * 🔑 **Και η ΠΡΟΕΛΕΥΣΗ**, κανόνας 18: ένα ζεύγος συντεταγμένων χωρίς πηγή είναι
 * ισχυρισμός. «Μετρημένο τοπογραφικό» και «συμπέρασμα από τη διεύθυνση» δίνουν το
 * ίδιο σημείο στην οθόνη και **εντελώς** διαφορετική βεβαιότητα.
 *
 * ⚠️ **Καμία νέα μηχανή χάρτη**: ο ίδιος `ResultsMap`, με **μία** αγγελία και χωρίς
 * καταναλωτή επιλογής. Ένας δεύτερος ζωγράφος θα ήταν δεύτερο κριτήριο σχήματος για
 * την ίδια ερώτηση (ADR-749), και η μέρα που θα διαφωνούσαν με την οθόνη 2 είναι
 * ερώτημα **πότε**, όχι **αν**.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingMapShape } from '@/lib/listings/listing-map-shape';
import { SHAPE_LABEL_KEY, shapeMeaningKey } from '@/lib/listings/listing-shape-keys';
import { ResultsMap } from '@/components/search-results/ResultsMap';
import type { PublicListing, UnknownPositionReason } from '@/types/public-listing';

interface ListingPositionSectionProps {
  readonly listing: PublicListing;
}

/** Ίδιο λεξιλόγιο με την `UnmappedListingsRow` — η αιτία δεν ξαναγράφεται. */
const REASON_KEY: Readonly<Record<UnknownPositionReason, string>> = {
  'never-asked': 'search-results:unmapped.reason.neverAsked',
  'owner-declined': 'search-results:unmapped.reason.ownerDeclined',
};

/** Χωρίς θέση: **καμία προσποίηση χάρτη**, μόνο η αιτία — και η αιτία είναι δική μας ή δική του. */
function UnknownPosition({ reason }: { readonly reason: UnknownPositionReason }) {
  const { t } = useTranslation(['search-results']);

  return (
    <div className="p-4">
      <p className="text-sm text-foreground">{t('search-results:detail.position.unknown')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t(REASON_KEY[reason])}</p>
    </div>
  );
}

export function ListingPositionSection({ listing }: ListingPositionSectionProps) {
  const { t } = useTranslation(['search-results']);
  const shape = listingMapShape(listing.position);
  const meaningKey = shapeMeaningKey(shape);

  return (
    <section
      aria-labelledby="listing-position-heading"
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="p-4 pb-0">
        <h2 id="listing-position-heading" className="text-sm font-medium text-muted-foreground">
          {t('search-results:detail.position.heading')}
        </h2>
      </div>

      {listing.position.kind === 'unknown' ? (
        <UnknownPosition reason={listing.position.reason} />
      ) : (
        <>
          <dl className="p-4 pt-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('search-results:detail.position.precision')}
            </dt>
            {/* Η ίδια ετικέτα με το υπόμνημα της οθόνης 2, και από κάτω τι σημαίνει. */}
            <dd className="mt-1 text-sm font-medium text-foreground">{t(SHAPE_LABEL_KEY[shape])}</dd>
            {meaningKey !== null && (
              <dd className="mt-1 text-sm text-muted-foreground">{t(meaningKey)}</dd>
            )}

            <dt className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
              {t('search-results:detail.position.source')}
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {t(`search-results:detail.position.provenance.${listing.position.provenance}`)}
            </dd>
          </dl>

          {/*
            🔴 Ο χάρτης μπαίνει **μόνο** όταν υπάρχει σχήμα να ζωγραφιστεί. Αλλιώς το
            `fitBounds` δεν έχει όρια, ο χάρτης δείχνει την προεπιλογή του — δηλαδή
            **άλλο μέρος** — και ο επισκέπτης το διαβάζει ως θέση του ακινήτου.
            Μετρημένο ζωντανά στην οθόνη 2 (10/08).
          */}
          <div className="h-72 w-full border-t border-border sm:h-96">
            <ResultsMap listings={[listing]} highlightedId={null} />
          </div>
        </>
      )}
    </section>
  );
}
