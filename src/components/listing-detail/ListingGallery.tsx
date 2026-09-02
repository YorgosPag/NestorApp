'use client';

/**
 * @fileoverview **Η ΣΥΛΛΟΓΗ ΤΗΣ ΑΓΓΕΛΙΑΣ** — ή η **ονομασμένη απουσία** της (ADR-841 §7 Α2).
 * @related ADR-841 §7 (Α2.4 · Α2.5 · Α2.6) · §6.6 · lib/listings/listing-images
 * @module components/listing-detail/ListingGallery
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΚΑΝΟΝΕΣ, ΚΑΙ ΚΑΝΕΝΑΣ ΤΟΥΣ ΔΕΝ ΕΙΝΑΙ ΥΦΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **1. ΤΟ ΠΡΩΤΟ ΚΑΡΕ ΠΟΤΕ `lazy`** *(§6.6 · Α2.4)*. Είναι το στοιχείο **LCP** αυτής της
 * σελίδας: μετρημένο ότι το `fetchpriority="high"` έριξε το LCP της Google Flights από
 * **2,6s σε 1,9s**, και ότι σελίδες με προτεραιοποιημένη εικόνα LCP έχουν **81%** «good»
 * έναντι **64%**. ⚠️ Και **μόνο ΜΙΑ** εικόνα το παίρνει — πολλές «υψηλής» ακυρώνουν η
 * μία την άλλη, οπότε όλες οι υπόλοιπες είναι ρητά `lazy`.
 *
 * **2. `width`/`height` ΠΑΝΤΑ**, από το σχήμα. Χωρίς αυτά ο περιηγητής δεν κρατά τον
 * χώρο και η σελίδα «πηδά» — το **CLS < 0,1** που η Α19 δεσμεύτηκε **αριθμητικά**. Το
 * `aspect-[4/3]` της θήκης δίνει το **σχήμα**· τα χαρακτηριστικά δίνουν τον **λόγο**.
 *
 * **3. ΤΟ `alt` ΔΕΝ ΕΙΝΑΙ ΚΕΝΟ, ΚΑΙ ΔΕΝ ΜΑΝΤΕΥΕΙ.** Το WCAG 1.1.1 ρωτά *«τι θα έχανε ο
 * βλέπων;»* — για φωτογραφία ακινήτου η απάντηση δεν είναι «τίποτα», άρα `alt=""` θα
 * έκρυβε γεγονός. Λέει **θέση + προέλευση**, που είναι ό,τι πραγματικά ξέρουμε *(Α2.5)*.
 *
 * ⚠️ **ΚΑΙ ΤΟ «ΠΡΟΕΛΕΥΣΗ» ΕΙΝΑΙ ΔΥΟ ΠΡΟΤΑΣΕΙΣ, ΟΧΙ ΜΙΑ** *(Α15)*: το `alt` **και** η
 * ορατή σημείωση από κάτω λένε **τίνος** υλικό είναι. Μέχρι την **Α14** έλεγαν και οι
 * δύο *«του κατόχου»* ως **σταθερές** — αληθές όσο ο ιδιώτης ήταν ο μόνος παραγωγός
 * συλλογής, **ψευδές σε 6 στις 7** μόλις το γραφείο απέκτησε. Πλέον διαλέγονται από την
 * `authorship` του **ίδιου** εγγράφου που δίνει και τις εικόνες, άρα **δεν μπορούν** να
 * διαφωνήσουν μεταξύ τους.
 *
 * ⚠️ **Η ΑΠΟΥΣΙΑ ΟΝΟΜΑΖΕΤΑΙ, ΠΟΤΕ ΞΕΝΟ PLACEHOLDER** (§25.5.2): μια κάρτα με εικόνα-θέσης
 * διαβάζεται ως **αληθινή φωτογραφία που δεν δείχνει αυτό το ακίνητο** — χειρότερο από
 * την απουσία, γιατί λέει ψέματα αντί να σιωπά.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { LISTING_MATERIAL_KEYS } from '@/lib/listings/listing-authorship';
import { listingImageSrcSet, listingLeadImage } from '@/lib/listings/listing-images';
import type { ListingImage, PublicListing } from '@/types/public-listing';

/** Τα `sizes` της **κορυφαίας** εικόνας — μία στήλη σε κινητό, ~2/3 της διάταξης σε οθόνη. */
const LEAD_SIZES = '(min-width: 1024px) 62vw, 100vw';

/** Τα `sizes` των **μικρογραφιών** — τρεις σε σειρά σε οθόνη, δύο σε κινητό. */
const THUMB_SIZES = '(min-width: 1024px) 20vw, 45vw';

export function ListingGallery({ listing }: { readonly listing: PublicListing }) {
  const { t } = useTranslation(['search-results']);
  const lead = listingLeadImage(listing);

  if (lead === null) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        {t('search-results:detail.media.absent')}
      </p>
    );
  }

  // 🔑 **Οι υπόλοιπες είναι «η συλλογή ΧΩΡΙΣ την κορυφαία»**, και ο κριτής της
  //    κορυφαίας είναι ο ίδιος με της κάρτας. Ένα `slice(1)` εδώ θα ήταν λάθος όταν
  //    κάποτε υπάρξει `coverImage`: τότε η κορυφαία **δεν** είναι η `gallery[0]`, και
  //    η πρώτη φωτογραφία του κατόχου θα εξαφανιζόταν σιωπηλά.
  const rest = listing.gallery.filter((image) => image.url !== lead.url);
  const total = listing.gallery.length;

  return (
    <section aria-label={t('search-results:detail.media.title')} className="flex flex-col gap-2">
      <GalleryImage image={lead} index={1} total={total} sizes={LEAD_SIZES} priority />

      {rest.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {rest.map((image, position) => (
            <li key={image.url}>
              <GalleryImage
                image={image}
                index={position + 2}
                total={total}
                sizes={THUMB_SIZES}
              />
            </li>
          ))}
        </ul>
      )}

      {/*
        🔑 **Δυναμικό κλειδί, και είναι το ΣΩΣΤΟ εδώ** *(αντίθετα από την
        `ListingAuthorshipLine`, όπου ο τριαδικός με κυριολεκτικά είναι ο κανόνας)*: η
        ίδια ερώτηση απαντιέται **και** στη στιγμή της προβολής, για το `altKey` που
        παγώνει μέσα στο έγγραφο. Δύο κυριολεκτικοί κλάδοι εδώ θα ήταν **δεύτερη
        χαρτογράφηση** authorship→πρόταση, ελεύθερη να αποκλίνει από εκείνη του γραφέα.
        Το πρόθεμα `search-results:detail.media` είναι **ήδη** δηλωμένο για αυτό το
        αρχείο στο `.i18n-shell-slice.json` — καμία νέα άδεια (CHECK 3.34).
      */}
      <p className="text-xs text-muted-foreground">
        {t(LISTING_MATERIAL_KEYS[listing.authorship].sourceNote)}
      </p>
    </section>
  );
}

/**
 * Μία εικόνα της συλλογής.
 *
 * ⚠️ **`priority` και όχι «είναι η πρώτη;»**: η εικόνα **δεν ξέρει τη θέση της** στη
 * σελίδα — τη λέει ο γονιός. Ένας υπολογισμός εδώ θα έδινε `fetchpriority="high"` σε
 * κάθε συλλογή που θα ξαναχρησιμοποιούσε αυτό το φύλλο *(Α2.4)*.
 */
function GalleryImage({
  image,
  index,
  total,
  sizes,
  priority = false,
}: {
  readonly image: ListingImage;
  readonly index: number;
  readonly total: number;
  readonly sizes: string;
  readonly priority?: boolean;
}) {
  const { t } = useTranslation(['search-results']);

  return (
    /*
      eslint-disable-next-line @next/next/no-img-element -- η πηγή είναι το δημόσιο
      ράφι (content-addressed, εκτός optimizer)· βλ. ADR-777 §8.11 και ADR-841 Α12.
    */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      srcSet={listingImageSrcSet(image)}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={t(image.altKey, { index, total })}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className="w-full rounded-lg border border-border object-cover"
    />
  );
}
