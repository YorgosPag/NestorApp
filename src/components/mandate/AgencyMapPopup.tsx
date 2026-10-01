'use client';

/**
 * @fileoverview **Η ΦΟΥΣΚΑ ΤΟΥ ΕΠΙΛΕΓΜΕΝΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ** στον χάρτη του καταλόγου (ADR-896).
 * @related components/owner-property/OwnerPropertyMapPopup (το ίδιο σχήμα για ακίνητα) · ShowcaseMarkView
 * @module components/mandate/AgencyMapPopup
 *
 * 🔑 **Ό,τι αναγνωρίζει ο άνθρωπος από την κάρτα, τίποτα παραπάνω**: σήμα (λογότυπο ή αρχικά —
 * η **ίδια** συνάρτηση με κάρτα και σελίδα προφίλ), επωνυμία, και η **μία** πράξη: η βιτρίνα.
 * Τηλέφωνα και διευθύνσεις ζουν στη βιτρίνα, πίσω από το όριο ρυθμού (ADR-841 Α21) — μια φούσκα
 * που τα έδειχνε θα ήταν δεύτερη, απροστάτευτη πόρτα προς τα ίδια δεδομένα.
 *
 * ⚠️ Δεμένη στο `selected`, **ΠΟΤΕ** στο `peeked` (ίδιο με `ListingMapPopup`): μια φούσκα που
 * ανοιγοκλείνει κάτω από τον δείκτη θα έκρυβε ακριβώς το σχήμα της εμβέλειας που ήρθε να δει.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Link } from '@/lib/workspace/navigation';
import type { PublicShowcase } from '@/types/agency-profile';
import type { GeoPoint } from '@/types/geo/coordinates';
import { ListingMapPopupFrame } from '@/components/search-results/ListingMapPopupFrame';

import { AGENCY_PUBLIC_NS, DIRECTORY_KEYS } from './agency-directory-labels';
import { agencyProfileRoute } from './agency-directory-route';
import { ShowcaseMarkView, showcaseMarkSubjectOf } from './ShowcaseMarkView';

interface AgencyMapPopupProps {
  readonly profile: PublicShowcase;
  readonly point: GeoPoint;
  readonly onClose: () => void;
}

export function AgencyMapPopup({ profile, point, onClose }: AgencyMapPopupProps): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);

  return (
    <ListingMapPopupFrame point={point} onClose={onClose}>
      <article className="flex w-52 flex-col items-start gap-1.5">
        <ShowcaseMarkView mark={showcaseMarkSubjectOf(profile)} size="card" />
        {/* `popover-foreground`: το ζεύγος της αιωρούμενης επιφάνειας (ADR-770 · CHECK 3.39). */}
        <h3 className="m-0 line-clamp-2 text-sm font-medium text-popover-foreground">{profile.displayName}</h3>
        <Link
          href={agencyProfileRoute(profile.alias)}
          className="text-xs font-medium text-popover-foreground underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t(DIRECTORY_KEYS.open)}
        </Link>
      </article>
    </ListingMapPopupFrame>
  );
}
