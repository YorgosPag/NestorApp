'use client';

/**
 * @fileoverview **«Η ΔΗΜΟΣΙΑ ΑΓΓΕΛΙΑ ΔΙΑΦΕΡΕΙ ΑΠΟ ΤΟ ΤΡΕΧΟΝ ΥΛΙΚΟ»** — η ένδειξη της καρτέλας (ADR-845 §7.17 Α5β).
 * @related hooks/listings/usePublishedMediaAgreement · components/listings/PublishedModelFreshness (ο αδελφός)
 * @module components/listings/PublishedMediaAgreement
 *
 * Κάθεται **δίπλα** στο `PublishedModelFreshness` και μιλά το ίδιο ιδίωμα *(διαφέρει · δεν ξέρω ·
 * συμφωνεί)*, από το **ίδιο** namespace. Εκείνο ρωτά *«ισχύει το μοντέλο ως προς το σχέδιο;»*· αυτό
 * *«έφτασε στην αγγελία ό,τι άλλαξε στα αρχεία;»*.
 *
 * ⛔ **ΚΑΜΙΑ ΚΡΙΣΗ ΕΔΩ.** Την ετυμηγορία — και το αν ο άνθρωπος **μπορεί** να ζητήσει ενημέρωση — τα
 * φέρνει ο διακομιστής. Αυτό το αρχείο **διαλέγει λέξεις**.
 *
 * ⚠️ **ΔΕΝ φτάνει ΠΟΤΕ στον επισκέπτη** — εργαλείο κηδεμονίας, lazy namespace.
 */

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePublishedMediaAgreement } from '@/hooks/listings/usePublishedMediaAgreement';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  needsListingRefresh,
  type ListingMediaVerdict,
} from '@/lib/listings/listing-media-fingerprint';

export interface PublishedMediaAgreementProps {
  readonly propertyId: string | null | undefined;
}

type SpokenVerdict = Exclude<ListingMediaVerdict, 'unlisted'>;

/**
 * 🔑 **Ο τόνος ΕΙΝΑΙ η ιεραρχία**: ό,τι βλέπει ο κόσμος και **δεν** ισχύει μιλά δυνατά· το «δεν
 * ξέρω» χαμηλότερα· το «συμφωνεί» ψιθυριστά. Πίνακας και όχι κλάδοι, ώστε νέα ετυμηγορία χωρίς
 * τόνο να μην περνά *(το `satisfies` τη ζητά)*.
 */
const TONE = {
  stale: 'destructive',
  missing: 'destructive',
  unknown: 'secondary',
  current: 'outline',
} as const satisfies Record<SpokenVerdict, 'destructive' | 'secondary' | 'outline'>;

const BADGE_KEY = {
  stale: 'media.stale.badge',
  missing: 'media.missing.badge',
  unknown: 'media.unknown.badge',
  current: 'media.current.badge',
} as const satisfies Record<SpokenVerdict, string>;

/**
 * ⚠️ **Σιωπά όταν δεν έχει να πει κάτι**: όσο φορτώνει, και όταν το ακίνητο **δεν διατίθεται** στο
 * κοινό *(δεν υπάρχει αγγελία να συγκριθεί)*.
 */
export function PublishedMediaAgreement({
  propertyId,
}: PublishedMediaAgreementProps): React.JSX.Element | null {
  const { t } = useTranslation('model-freshness');
  const { agreement, mayRefresh, refreshing, refresh } = usePublishedMediaAgreement(propertyId);

  if (agreement === null || agreement === 'unlisted') return null;

  return (
    <>
      <Badge variant={TONE[agreement]}>{t(BADGE_KEY[agreement])}</Badge>
      {mayRefresh && needsListingRefresh(agreement) && (
        <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          {t(refreshing ? 'media.refresh.busy' : 'media.refresh.action')}
        </Button>
      )}
    </>
  );
}
