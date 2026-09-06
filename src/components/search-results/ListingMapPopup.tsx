'use client';

/**
 * **Η ΑΠΑΝΤΗΣΗ ΕΚΕΙ ΠΟΥ ΚΟΙΤΑΖΕΙ** — η μίνι κάρτα πάνω από την επιλεγμένη πινέζα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΓΙΑΤΙ ΥΠΑΡΧΕΙ, ΚΑΙ ΓΙΑΤΙ ΜΟΝΟ ΣΤΟ ΚΛΙΚ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Σε φαρδιά οθόνη ο χάρτης πιάνει ~1.200px και η λίστα κάθεται **αριστερά**. Ένα κλικ
 * στη Θεσσαλονίκη που απαντά **μόνο** στη στήλη υποχρεώνει το βλέμμα να ταξιδέψει όλο
 * το πλάτος της οθόνης για να μάθει τι πάτησε. Είναι το ίδιο κόστος που το NN/g ονομάζει
 * **interaction cost** — *«switching attention between windows»* — και είναι ο λόγος που
 * **Zillow, Redfin και Airbnb** ζωγραφίζουν κάρτα **πάνω στον χάρτη**.
 *
 * ⛔ **ΠΟΤΕ ΣΤΟ HOVER.** Ένα popup που ανοίγει με το πέρασμα του δείκτη είναι το
 * κλασικό *hide-and-hover* anti-pattern: αναβοσβήνει σε κάθε διαδρομή του ποντικιού
 * και **σκεπάζει τις γειτονικές πινέζες** — δηλαδή κρύβει ακριβώς αυτό που ο άνθρωπος
 * πήγαινε να δει. Το κλικ είναι **σκόπιμο**, άρα το κάλυμμα είναι **ζητούμενο**.
 *
 * 🔑 **Η ΙΔΙΑ ΑΛΗΘΕΙΑ ΜΕ ΤΗΝ ΚΑΡΤΑ ΤΗΣ ΛΙΣΤΑΣ, ΟΧΙ ΑΝΤΙΓΡΑΦΟ ΤΗΣ.** Τιμή από τον
 * `price-resolver`, εικόνα από το `listingLeadImage`, σύνδεσμος από το `listingDetailHref`
 * — οι **ίδιες τρεις αρχές** που ρωτά το `ListingCard`. Δεν είναι μικρογραφία της κάρτας:
 * είναι **λιγότερα πεδία**, γιατί εδώ ο άνθρωπος ρωτά *«ποιο είναι αυτό;»*, όχι
 * *«ταιριάζει;»*.
 */

import React from 'react';
import { Popup } from '@/lib/maps/maplibre';

import { Link } from '@/lib/workspace/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { resolveDisplayPrice } from '@/lib/properties/price-resolver';
import { MISSING_PRICE_KEY } from '@/lib/listings/listing-price-keys';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import { listingLeadImage } from '@/lib/listings/listing-images';
import type { PublicListing } from '@/types/public-listing';

interface ListingMapPopupProps {
  readonly listing: PublicListing;
  readonly filterQuery: string;
  readonly onClose: () => void;
}

export function ListingMapPopup({ listing, filterQuery, onClose }: ListingMapPopupProps) {
  const { t } = useTranslation(['search-results', 'search-focus']);

  // Ο φρουρός είναι για τον μεταγλωττιστή, όχι για την οθόνη: ο καλών ζωγραφίζει popup
  // μόνο για αγγελία που ήδη πέρασε από το `mapped` — δηλαδή έχει θέση εξ ορισμού.
  if (listing.position.kind !== 'known') return null;

  const price = resolveDisplayPrice(listing);
  const image = listingLeadImage(listing);
  const { point } = listing.position;

  return (
    <Popup
      longitude={point.lng}
      latitude={point.lat}
      anchor="bottom"
      /*
        ⚠️ **Το `offset` ΔΕΝ είναι αισθητική απόσταση**: χωρίς αυτό η μύτη του popup
        κάθεται πάνω στο κέντρο της πινέζας και **σκεπάζει το ίδιο το σχήμα** που μόλις
        πατήθηκε — ο άνθρωπος χάνει την οπτική επιβεβαίωση του τι διάλεξε. Η τιμή είναι
        η μεγαλύτερη ακτίνα σχήματος-σημείου (`RADIUS.pin + δακτύλιος επιλογής`).
      */
      offset={[0, -18]}
      onClose={onClose}
      /*
        🔴 **`closeOnClick={false}` — ΥΠΟΧΡΕΩΤΙΚΟ.** Με την προεπιλογή (`true`), το ίδιο
        το κλικ που **άνοιξε** το popup το κλείνει στον ίδιο κύκλο συμβάντων: το popup
        αναβοσβήνει και ο άνθρωπος δεν καταλαβαίνει ποτέ γιατί. Το κλείσιμο ζει στο `×`,
        στο `Escape` και στο κλικ σε **κενό** σημείο του χάρτη — τρεις ρητές διαδρομές.
      */
      closeOnClick={false}
      className="listing-map-popup"
      maxWidth="15rem"
    >
      <Link
        href={listingDetailHref(listing.id, filterQuery)}
        className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <article className="w-44">
          {image !== null && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              width={image.width}
              height={image.height}
              alt={t(image.altKey, { index: 1, total: listing.gallery.length })}
              /*
                `loading="lazy"` **και** `decoding="async"`: το popup γεννιέται από κλικ,
                δηλαδή **μετά** το LCP της οθόνης. Μια εικόνα υψηλής προτεραιότητας εδώ
                θα ανταγωνιζόταν την πρώτη κάρτα της λίστας — που είναι το πραγματικό LCP
                (ADR-841 §7 Α2.4: «πολλές εικόνες υψηλής προτεραιότητας ακυρώνουν η μία
                την άλλη»).
              */
              loading="lazy"
              decoding="async"
              className="mb-1.5 aspect-[4/3] w-full rounded object-cover"
            />
          )}

          <h3 className="truncate text-sm font-medium text-foreground">{listing.title}</h3>

          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {price.kind === 'priced'
              ? formatCurrency(price.headline.amount)
              : t(MISSING_PRICE_KEY[price.reason])}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {t('search-focus:popup.open')}
          </p>
        </article>
      </Link>
    </Popup>
  );
}
