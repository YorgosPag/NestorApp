'use client';

/**
 * @fileoverview **Η μικρογραφία της κάρτας «Τα ακίνητά μου»** — ή η ΔΗΛΩΜΕΝΗ απουσία της.
 * @related ADR-777 §8.70 · lib/owner-property/owner-listing-thumbnail · lib/listings/listing-images
 * @module components/owner-property/OwnerPropertyCardCover
 *
 * 🔑 **Δείχνει ό,τι βλέπει ο κόσμος** (Idealista «Tus anuncios» · Airbnb Listings · Zillow Owner
 * Dashboard): την κεντρική εικόνα της δημοσιευμένης αγγελίας, από το αποτύπωμα που γράφει ο
 * **ένας** γραφέας. Καμία ανάγνωση εδώ, κανένα υπογεγραμμένο URL, κανένα πρωτότυπο 20 MB.
 *
 * ⛔ **Η ΑΠΟΥΣΙΑ ΔΕΝ ΓΕΜΙΖΕΙ** (ίδιο δόγμα με το `ListingCard`, §25.5.2): κανένα εικονίδιο σπιτιού,
 * καμία «ενδεικτική» εικόνα. Μόνο κείμενο που **λέει** την κατάσταση και η θεραπεία της ένα κλικ
 * μακριά — ο κάτοχος είναι ο μόνος που μπορεί να τη διορθώσει.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingImageSrcSet } from '@/lib/listings/listing-images';
import { publicationThumbnailOf } from '@/lib/owner-property/owner-listing-thumbnail';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import { Link } from '@/lib/workspace/navigation';
import type { OwnerProperty } from '@/types/owner-property';

const K = 'property-market:offer.card';

/** Η στήλη της μικρογραφίας: πλήρες πλάτος σε κινητό, σταθερή στήλη από `sm` και πάνω. */
const COVER_SIZES = '(min-width: 640px) 176px, 100vw';
const COVER_FRAME = 'aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md sm:w-44';

interface OwnerPropertyCardCoverProps {
  readonly property: Pick<OwnerProperty, 'id' | 'title' | 'publication'>;
  /** Μόνο η **πρώτη** κάρτα της λίστας — πολλές εικόνες υψηλής προτεραιότητας ακυρώνουν η μία την άλλη. */
  readonly priority?: boolean;
}

export function OwnerPropertyCardCover({
  property,
  priority = false,
}: OwnerPropertyCardCoverProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const thumbnail = publicationThumbnailOf(property);

  if (thumbnail === null) {
    return (
      <figure className={`${COVER_FRAME} m-0 flex flex-col items-center justify-center gap-2 border border-dashed border-border p-3 text-center`}>
        <figcaption className="text-xs text-muted-foreground">{t(`${K}.noCover`)}</figcaption>
        <Link href={offerDetailHref(property.id)} className="text-xs font-medium text-foreground underline">
          {t(`${K}.addPhotos`)}
        </Link>
      </figure>
    );
  }

  return (
    <figure className={`${COVER_FRAME} m-0 border border-border`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- δημόσιο ράφι με δικό του srcset (listingImageSrcSet), όπως το ListingCardGallery */}
      <img
        src={thumbnail.url}
        srcSet={listingImageSrcSet(thumbnail)}
        sizes={COVER_SIZES}
        width={thumbnail.width}
        height={thumbnail.height}
        alt={t(`${K}.coverAlt`, { title: property.title })}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className="h-full w-full object-cover"
      />
    </figure>
  );
}
