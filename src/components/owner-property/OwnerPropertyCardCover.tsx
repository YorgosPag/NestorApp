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
 *
 * 🗺️ **Φάση 2 (§8.70): χωρίς φωτογραφία, ο ΧΑΡΤΗΣ ΘΕΣΗΣ — ό,τι δείχνει ο δημόσιος χάρτης.** Δεν
 * είναι «ενδεικτική εικόνα»: είναι **πραγματική** πληροφορία της αγγελίας, με το ίδιο σχήμα
 * ακρίβειας (πινέζα · δακτύλιος · σκιασμένη περιοχή) που βλέπει ο επισκέπτης, από το σημάδι
 * `publication.mapMark` — ποτέ από το ιδιωτικό `place`. Η θεραπεία «Πρόσθεσε φωτογραφίες» μένει
 * ορατή πάνω του, και χωρίς σημάδι (ή σε αποτυχία) η κάρτα πέφτει στη δηλωμένη απουσία.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingImageSrcSet } from '@/lib/listings/listing-images';
import { parseListingMapMark } from '@/lib/listings/listing-map-mark';
import { publicationThumbnailOf } from '@/lib/owner-property/owner-listing-thumbnail';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import { Link } from '@/lib/workspace/navigation';
import type { OwnerListingThumbnail, OwnerProperty } from '@/types/owner-property';
import { MapOrAbsenceCover } from '@/components/listing-map-snapshot/MapOrAbsenceCover';
import { LISTING_CARD_ASPECT, LISTING_CARD_ASPECT_CLASS } from '@/components/search-results/listing-card-frame';
import { listingPhotoPositionClass } from '@/components/search-results/listing-photo-position-class';

import cardStyles from './owner-property-card.module.css';

const K = 'property-market:offer.card';

/**
 * Το πλάτος της μικρογραφίας το αποφασίζει η **κάρτα** (container query, `owner-property-card.module.css`):
 * 14rem δίπλα στο κείμενο, ή όλο το πλάτος από πάνω — έως 34,75rem (556px), το κατώφλι της σειράς.
 * Το `auto` (HTML, lazy εικόνες) αφήνει τον browser να διαλέξει από το **πραγματικό** πλάτος· η υπόλοιπη λίστα
 * είναι η εφεδρεία (eager εικόνα ή browser χωρίς `auto`) και καλύπτει τη **μεγαλύτερη** περίπτωση, όχι την 224px:
 * αλλιώς η στοιβαγμένη κάρτα στον υπολογιστή θα έπαιρνε θολή εικόνα.
 */
const COVER_SIZES = 'auto, (min-width: 640px) 556px, 100vw';
/** Γεωμετρία πλάτους/στοίχισης: `cardStyles.cover` (ADR-777 §8.70 `self-start` · ADR-946 §3.2 container query). */
const COVER_FRAME = `${LISTING_CARD_ASPECT_CLASS} ${cardStyles.cover} shrink-0 overflow-hidden rounded-md`;

interface OwnerPropertyCardCoverProps {
  readonly property: Pick<OwnerProperty, 'id' | 'title' | 'publication'>;
  /** Μόνο η **πρώτη** κάρτα της λίστας — πολλές εικόνες υψηλής προτεραιότητας ακυρώνουν η μία την άλλη. */
  readonly priority?: boolean;
  /**
   * Η θεραπεία «Πρόσθεσε φωτογραφίες» **επί τόπου** — όταν η κάρτα στέκεται ήδη στη σελίδα του
   * ακινήτου (§8.70.9). Χωρίς αυτό, σύνδεσμος προς εκείνη τη σελίδα (λίστα).
   */
  readonly onAddPhotos?: () => void;
}

/**
 * Χωρίς δημοσιευμένη φωτογραφία: ο **χάρτης θέσης** όταν υπάρχει σημάδι, αλλιώς η δηλωμένη απουσία.
 * Η απουσία είναι και η **εφεδρεία** του χάρτη (χωρίς provider, λήξη χρόνου, σφάλμα απόδοσης).
 */
function NoPhotoCover({ property, onAddPhotos }: Pick<OwnerPropertyCardCoverProps, 'property' | 'onAddPhotos'>): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  // 🔴 Στη σελίδα του ακινήτου ο σύνδεσμος θα έδειχνε **στον εαυτό του** — εκεί είναι κουμπί.
  const addPhotos = (className: string) =>
    onAddPhotos === undefined ? (
      <Link href={offerDetailHref(property.id)} className={className}>
        {t(`${K}.addPhotos`)}
      </Link>
    ) : (
      <button type="button" onClick={onAddPhotos} className={className}>
        {t(`${K}.addPhotos`)}
      </button>
    );
  return (
    <MapOrAbsenceCover
      mark={parseListingMapMark(property.publication?.mapMark)}
      frameClassName={COVER_FRAME}
      mapAlt={t(`${K}.mapAlt`, { title: property.title })}
      mapLoadingLabel={t(`${K}.mapLoading`)}
      absenceLabel={t(`${K}.noCover`)}
      absenceAction={addPhotos('text-xs font-medium text-foreground underline')}
      mapOverlay={addPhotos(
        'absolute left-1 top-1 rounded bg-card px-1.5 py-0.5 text-xs font-medium text-card-foreground underline',
      )}
    />
  );
}

interface OwnerPropertyPhotoProps {
  readonly thumbnail: OwnerListingThumbnail;
  readonly title: string;
  /** Το `sizes` του **πλαισίου** που τη φιλοξενεί (στήλη κάρτας · φούσκα χάρτη). */
  readonly sizes: string;
  readonly priority?: boolean;
}

/**
 * **Η φωτογραφία που είδε ο κόσμος**: μία απόδοση για την κάρτα και για τη φούσκα του χάρτη
 * χαρτοφυλακίου (ADR-777 §8.71). Ίδιο `srcset`, ίδιο alt με τον τίτλο.
 */
export function OwnerPropertyPhoto({
  thumbnail,
  title,
  sizes,
  priority = false,
}: OwnerPropertyPhotoProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- δημόσιο ράφι με δικό του srcset (listingImageSrcSet), όπως το ListingCardGallery
    <img
      src={thumbnail.url}
      srcSet={listingImageSrcSet(thumbnail)}
      sizes={sizes}
      width={thumbnail.width}
      height={thumbnail.height}
      alt={t(`${K}.coverAlt`, { title })}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={`h-full w-full object-cover ${listingPhotoPositionClass(thumbnail, LISTING_CARD_ASPECT)}`}
    />
  );
}

export function OwnerPropertyCardCover({
  property,
  priority = false,
  onAddPhotos,
}: OwnerPropertyCardCoverProps): React.ReactElement {
  const thumbnail = publicationThumbnailOf(property);

  if (thumbnail === null) return <NoPhotoCover property={property} onAddPhotos={onAddPhotos} />;

  return (
    <figure className={`${COVER_FRAME} m-0 border border-border`}>
      <OwnerPropertyPhoto thumbnail={thumbnail} title={property.title} sizes={COVER_SIZES} priority={priority} />
    </figure>
  );
}
