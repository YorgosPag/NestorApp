'use client';

/**
 * **Η ΑΠΑΝΤΗΣΗ — και η πόρτα προς τον ακριβή αριθμό.**
 *
 * @related ADR-900 · components/demand/PlaceInterestPanel · lib/owner-property/owner-property-prospect-prefill
 * @module components/demand/interest-check/InterestCheckResult
 *
 * 🔑 **Το πάνελ είναι το ΙΔΙΟ με του κατόχου** (`PlaceInterestPanel`): ίδιες καταστάσεις, ίδιες λέξεις,
 * ίδια σιωπή κάτω από το κατώφλι. Η μόνη διαφορά — «τουλάχιστον N» — τη λέει η **πολιτική** του
 * ακροατηρίου (βήμα 5), όχι αυτό το αρχείο.
 *
 * 🔴 **Η ΚΑΡΤΑ ΚΑΤΑΧΩΡΙΣΗΣ ΕΜΦΑΝΙΖΕΤΑΙ ΠΑΝΤΑ — ΑΝΕΞΑΡΤΗΤΑ ΑΠΟ ΤΟΝ ΑΡΙΘΜΟ.** Αν εμφανιζόταν μόνο όταν
 * «υπάρχει κάτι να δεις», η **ίδια η εμφάνισή της** θα έλεγε σε όποιον δείχνει το σπίτι του γείτονα ότι
 * κάποιος το ζητά — δηλαδή το κατώφλι 1 του `place-owner` θα διέρρεε από το πλάι, μέσω του UI.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Link } from '@/lib/workspace/navigation';
import { PlaceInterestPanel } from '@/components/demand/PlaceInterestPanel';
import { useProspectInterest } from '@/hooks/demand/usePlaceInterest';
import type { ProspectQuery } from '@/lib/demand/prospect-interest';
import { newOfferFromProspectHref } from '@/lib/owner-property/owner-property-prospect-prefill';

const NS = 'property-market';
const K = `${NS}:interestCheck`;

export function InterestCheckResult({ query }: { query: ProspectQuery }): React.ReactElement {
  const interest = useProspectInterest(query);
  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      {/* `public`: το ακίνητο δεν έχει διάθεση, άρα δεν υπάρχει «κλειστό κοινό» να ειπωθεί. */}
      <PlaceInterestPanel interest={interest} audience="public" />
      <ClaimCard query={query} />
    </section>
  );
}

/** «Είναι δικό σας; Δείτε τον ακριβή αριθμό» — **πάντα**, βλ. την κεφαλίδα. */
function ClaimCard({ query }: { query: ProspectQuery }): React.ReactElement {
  const { t } = useTranslation([NS]);
  return (
    <aside className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
      <h2 className="text-base font-semibold text-foreground">{t(`${K}.claim.title`)}</h2>
      <p className="text-sm text-muted-foreground">{t(`${K}.claim.body`)}</p>
      <Link
        href={newOfferFromProspectHref(query)}
        className="self-start rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground"
      >
        {t(`${K}.claim.cta`)}
      </Link>
    </aside>
  );
}
