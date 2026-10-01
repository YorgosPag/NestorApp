'use client';

/**
 * **Η ΠΕΡΙΗΓΗΣΗ ΦΩΤΟΓΡΑΦΙΩΝ ΜΕΣΑ ΣΤΗΝ ΚΑΡΤΑ ΑΓΓΕΛΙΑΣ** — ADR-777 §8.57
 *
 * Λεπτό περιτύλιγμα πάνω στο **κέλυφος** `components/shared/gallery/SnapGallery` (ADR-899 §4): εδώ
 * μένει μόνο ό,τι είναι **της αγγελίας** — η εικόνα του δημόσιου ραφιού (`srcset` από το manifest,
 * ADR-841 Α2.2), το σημείο εστίασης (ADR-880), η προτεραιότητα LCP (Α2.4) και ο σύνδεσμος ανά slide.
 * Η μηχανή κύλισης, τα βελάκια, η βαθμίδωση και οι τελείες —και το ιστορικό τους— ζουν στο κέλυφος.
 *
 * @module components/search-results/ListingCardGallery
 */

import React from 'react';

import { SnapGallery } from '@/components/shared/gallery/SnapGallery';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingImageSrcSet } from '@/lib/listings/listing-images';
import type { ListingImage } from '@/types/public-listing';

import { LISTING_CARD_ASPECT, LISTING_CARD_ASPECT_CLASS } from './listing-card-frame';
import { listingPhotoPositionClass } from './listing-photo-position-class';

interface ListingCardGalleryProps {
  /** Οι εικόνες **με τη σειρά τους** — από το `listingGalleryImages`, ποτέ χειρόγραφα. */
  readonly images: readonly ListingImage[];
  /** Το `sizes` της κάρτας — η γκαλερί δεν αποφασίζει διαστάσεις, τις **δέχεται**. */
  readonly sizes: string;
  /**
   * Μόνο η **πρώτη κάρτα της πρώτης οθόνης**, και μόνο για την **πρώτη** φωτογραφία της.
   *
   * ⚠️ Οι υπόλοιπες μένουν `lazy` **επίτηδες**: πολλές εικόνες υψηλής προτεραιότητας
   * ακυρώνουν η μία την άλλη (ADR-841 §7 Α2.4). Και επειδή ο κύλινδρος είναι κανονικός
   * scroll container, το `loading="lazy"` του περιηγητή **δεν κατεβάζει** τη 2η και την
   * 3η μέχρι να πλησιάσουν — δηλαδή η «προφόρτωση της επόμενης» γίνεται **από τον
   * περιηγητή, τη σωστή στιγμή**, χωρίς δικό μας χρονοδιακόπτη να τη μαντέψει.
   */
  readonly priority?: boolean;
  /** Κλάσεις του **δοχείου** — η κάρτα κρατά τον έλεγχο του περιθωρίου της. */
  readonly className?: string;
  /**
   * Ο σύνδεσμος που τυλίγει **κάθε** φωτογραφία, ώστε το κλικ πάνω της να ανοίγει την
   * αγγελία όπως παντού αλλού. Δες {@link ListingCardGalleryProps.renderSlideLink}.
   */
  readonly renderSlideLink?: (child: React.ReactNode, index: number) => React.ReactNode;
  /**
   * **ΓΡΑΦΕΑΣ** — *«δήλωσε ποια φωτογραφία βλέπεις, με αυτό το κλειδί»* (ADR-777 §8.58.7).
   *
   * 🔑 Το δηλώνει **μόνο η κάρτα της λίστας**, και το κλειδί είναι η ταυτότητα της
   * αγγελίας. Είναι ο **ένας** γραφέας του {@link module:lib/listings/listing-photo-position}.
   *
   * ⛔ **ΜΗΝ το δώσεις και στη φούσκα του χάρτη.** Δύο γραφείς στο ίδιο κλειδί είναι
   * ακριβώς ο συγχρονισμός που το §8.58.7 απέρριψε — και ο βρόχος ανάδρασης που τον
   * κάνει αδύνατο. Η φούσκα **διαβάζει** ({@link ListingCardGalleryProps.initialIndex}).
   */
  readonly reportPositionAs?: string;
  /**
   * **ΑΝΑΓΝΩΣΤΗΣ** — *«ξεκίνα από εδώ»*. Διαβάζεται **μία φορά, στην προσάρτηση**.
   *
   * 🔴 **ΔΕΝ είναι ελεγχόμενη τιμή**, και η διαφορά είναι όλη η απόφαση: μια αλλαγή του
   * **μετά** την προσάρτηση **δεν κάνει τίποτα**. Αν την ακολουθούσε, η γκαλερί θα είχε
   * **δύο γραφείς** *(τον παρατηρητή της και τον γονέα)* — και το ίδιο το σχόλιο του
   * `index` παρακάτω προβλέπει τι θα γινόταν: *«δύο αλήθειες, που αποκλίνουν στην πρώτη
   * διακοπτόμενη κύλιση»*.
   */
  readonly initialIndex?: number;
}

export function ListingCardGallery({
  images,
  sizes,
  priority = false,
  className = '',
  renderSlideLink,
  reportPositionAs,
  initialIndex = 0,
}: ListingCardGalleryProps) {
  const { t } = useTranslation(['common-photos', 'search-results']);
  const total = images.length;

  const renderSlide = (position: number) => {
    const image = images[position];
    const picture = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image.url}
        srcSet={listingImageSrcSet(image)}
        sizes={sizes}
        width={image.width}
        height={image.height}
        alt={t(image.altKey, { index: position + 1, total })}
        loading={priority && position === 0 ? 'eager' : 'lazy'}
        fetchPriority={priority && position === 0 ? 'high' : 'auto'}
        decoding="async"
        draggable={false}
        className={`${LISTING_CARD_ASPECT_CLASS} w-full object-cover ${listingPhotoPositionClass(image, LISTING_CARD_ASPECT)}`}
      />
    );

    return renderSlideLink ? renderSlideLink(picture, position) : picture;
  };

  return (
    <SnapGallery
      count={total}
      slideKey={(position) => images[position].url}
      renderSlide={renderSlide}
      className={className}
      reportPositionAs={reportPositionAs}
      initialIndex={initialIndex}
    />
  );
}
