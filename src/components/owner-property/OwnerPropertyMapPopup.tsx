'use client';

/**
 * **Η φούσκα του χάρτη χαρτοφυλακίου** — «αυτό είναι, και έτσι το βλέπει ο κόσμος» (ADR-777 §8.71).
 *
 * 🔑 Πρότυπο Zillow/Airbnb/Idealista: κλικ σε σημάδι ⇒ **προεπισκόπηση**, όχι πλοήγηση. Σε
 * γειτονικά σημάδια ένα λάθος κλικ δεν πρέπει να σε βγάζει από τον χάρτη. Η πλοήγηση είναι
 * ρητή πράξη: ο σύνδεσμος «Άνοιγμα» προς την κάρτα του κατόχου.
 *
 * ⚠️ **Θέση + μύτη + κλείσιμο από το ΚΟΙΝΟ πλαίσιο** (`ListingMapPopupFrame`), με άγκυρα το
 * σημείο του **σημαδιού**: την ίδια συντεταγμένη που ζωγράφισε ο ζωγράφος. Ποτέ το `place`.
 *
 * 🔑 **Η τιμή είναι όπως τη βλέπει ο κόσμος**: `projectableFromOwnerProperty` (ο ίδιος
 * μετασχηματισμός που τρέφει τη δημόσια προβολή) → `resolveDisplayPrice` → `displayPriceLabel`.
 * Κανένας δεύτερος αναγνώστης τιμής.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nowISO } from '@/lib/date-local';
import type { ListingMapMark } from '@/lib/listings/listing-map-mark';
import { displayPriceLabel } from '@/lib/listings/listing-price-label';
import { publicationThumbnailOf } from '@/lib/owner-property/owner-listing-thumbnail';
import { projectableFromOwnerProperty } from '@/lib/owner-property/owner-property-projection';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import { resolveDisplayPrice } from '@/lib/properties/price-resolver';
import { Link } from '@/lib/workspace/navigation';
import type { OwnerProperty } from '@/types/owner-property';
import { ListingMapPopupFrame } from '@/components/search-results/ListingMapPopupFrame';

import { OwnerPropertyPhoto } from './OwnerPropertyCardCover';

/** Το πλάτος της φούσκας (`w-44` = 176px): η φωτογραφία ζητά ακριβώς αυτό. */
const POPUP_IMAGE_SIZES = '176px';

interface OwnerPropertyMapPopupProps {
  readonly property: OwnerProperty;
  readonly mark: ListingMapMark;
  readonly onClose: () => void;
}

export function OwnerPropertyMapPopup({ property, mark, onClose }: OwnerPropertyMapPopupProps) {
  const { t } = useTranslation(['property-market', 'search-results', 'common']);
  const thumbnail = publicationThumbnailOf(property);
  const price = resolveDisplayPrice(projectableFromOwnerProperty(property, nowISO()));
  const href = offerDetailHref(property.id);

  return (
    <ListingMapPopupFrame point={mark.point} onClose={onClose}>
      <article className="relative w-44">
        {/* Χωρίς φωτογραφία ⇒ τίποτα: ο χάρτης είναι ήδη η εικόνα της θέσης. */}
        {thumbnail !== null && (
          <figure className="m-0 mb-1.5 aspect-[4/3] overflow-hidden rounded">
            <OwnerPropertyPhoto thumbnail={thumbnail} title={property.title} sizes={POPUP_IMAGE_SIZES} />
          </figure>
        )}
        {/* `popover-foreground`: το ζεύγος της αιωρούμενης επιφάνειας (ADR-770 · CHECK 3.39). */}
        <h3 className="truncate text-sm font-medium text-popover-foreground">{property.title}</h3>
        <p className="mt-0.5 text-sm font-semibold text-popover-foreground">{displayPriceLabel(t, price)}</p>
        <Link
          href={href}
          className="mt-1.5 inline-block text-xs font-medium text-popover-foreground underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('property-market:offer.list.open')}
        </Link>
      </article>
    </ListingMapPopupFrame>
  );
}
