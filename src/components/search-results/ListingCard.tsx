'use client';

/**
 * Η κάρτα της οθόνης 2 — **5 βασικά + 3 ειδικά πεδία, ΠΟΤΕ περισσότερα** (§25.6).
 *
 * ⚠️ Το «ποτέ περισσότερα» δεν είναι ύφος: μετρήθηκε (Baymard) ότι κάθε επιπλέον πεδίο
 * μειώνει τη σάρωση της λίστας. Τα υπόλοιπα ζουν στη **σελίδα ακινήτου** (οθόνη 3),
 * που είναι η προοδευτική αποκάλυψη της Α7.
 *
 * 🔴 **Η τιμή περνά ΠΑΝΤΑ από τον SSoT** (`price-resolver`): το `@deprecated` επίπεδο
 * `price` ήταν αυτό που διάβαζε η παλιά κάρτα ενώ το φίλτρο διάβαζε άλλο πεδίο. Και η
 * **απουσία τιμής είναι ΚΑΤΑΣΤΑΣΗ με αιτία**, ποτέ «0 €».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΚΛΙΚ ΠΑΕΙ ΣΤΗΝ ΟΘΟΝΗ 3· Η ΕΠΙΣΗΜΑΝΣΗ ΜΕΝΕΙ ΣΤΟ HOVER *(2026-08-10)*
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι σήμερα το κλικ **επισήμαινε** την κάρτα στον χάρτη — δηλαδή έκανε ό,τι κάνει
 * ήδη το hover, και η οθόνη 3 ήταν **απρόσιτη**. Ο δεσμός της Α3 δεν χάνεται: λίστα →
 * χάρτης εξακολουθεί να γίνεται με **hover**, χάρτης → λίστα με **κλικ στον χάρτη**.
 *
 * 🔴 **Και είναι απαίτηση κινητού, όχι προτίμηση.** Η Α3 δηλώνει *«οι περισσότεροι
 * μπαίνουν από κινητό»* — όπου **δεν υπάρχει hover**. Ένα κλικ που μόνο επισημαίνει
 * θα άφηνε τον κύριο χρήστη μας χωρίς **καμία** διαδρομή προς το ακίνητο.
 *
 * ⚠️ **Ο σύνδεσμος κουβαλά τα φίλτρα** (`listingDetailHref`): χωρίς αυτό, η επιστροφή
 * από ένα **κοινοποιημένο** σύνδεσμο θα έδειχνε άλλη λίστα από αυτήν που άφησε ο
 * επισκέπτης — η ίδια απώλεια που η Α3 μέτρησε στο **75%**.
 */

import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveDisplayPrice } from '@/lib/properties/price-resolver';
import { MISSING_PRICE_KEY } from '@/lib/listings/listing-price-keys';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import type { PublicListing } from '@/types/public-listing';
import { formatCurrency } from '@/lib/intl-formatting';
import { listingImageSrcSet, listingLeadImage } from '@/lib/listings/listing-images';
import { ListingAuthorshipLine } from '@/components/listings/ListingAuthorshipLine';

/**
 * Πόσο πλατιά αποδίδεται η εικόνα της κάρτας — **δήλωση διάταξης, όχι εικασία**.
 *
 * Η λίστα είναι μία στήλη ~22rem δίπλα στον χάρτη σε οθόνη, και πλήρους πλάτους σε
 * κινητό. Χωρίς `sizes` ο περιηγητής υποθέτει **100vw** και κατεβάζει το μεγαλύτερο
 * παράγωγο για μια εικόνα 350px — δηλαδή το `srcset` θα ήταν κόστος χωρίς όφελος.
 */
const CARD_IMAGE_SIZES = '(min-width: 1024px) 22rem, 100vw';

/**
 * ⚠️ **ΤΡΙΑ ΠΕΔΙΑ ΕΓΙΝΑΝ ΠΡΟΑΙΡΕΤΙΚΑ (2026-09-01, ADR-841 §7 Α6) — ΚΑΙ ΔΕΝ ΕΙΝΑΙ
 * ΧΑΛΑΡΩΣΗ.** Η κάρτα απέκτησε **δεύτερη** οθόνη *(η βιτρίνα `/pro/<ψευδώνυμο>`)* όπου
 * **δεν υπάρχει χάρτης να επισημανθεί και δεν υπάρχουν φίλτρα να ταξιδέψουν**. Οι
 * εναλλακτικές ήταν να περνά εκείνη ψεύτικες τιμές *(`() => {}`, `''`)* — δηλαδή να
 * λέει «χάρτης» εκεί που δεν υπάρχει — ή να γεννηθεί **δεύτερη κάρτα αγγελίας**, που
 * είναι ακριβώς το διπλότυπο που ο κανόνας N.0.2 απαγορεύει.
 *
 * 🔑 Ο **πυρήνας** είναι το `listing`. Τα υπόλοιπα είναι **συμφραζόμενα της οθόνης 2**,
 * και η οθόνη 2 εξακολουθεί να τα περνά **ρητά**.
 */
interface ListingCardProps {
  readonly listing: PublicListing;
  /** Επισημασμένη από τον χάρτη; Χωρίς χάρτη, **ποτέ**. */
  readonly isHighlighted?: boolean;
  /** Ο δεσμός λίστα → χάρτης. Χωρίς χάρτη, **δεν υπάρχει τι να ειδοποιηθεί**. */
  readonly onHover?: (id: string | null) => void;
  /** Τα ενεργά φίλτρα ως ερώτημα — ταξιδεύουν μαζί με τον επισκέπτη στην οθόνη 3. */
  readonly filterQuery?: string;
  /**
   * **Λέει η κάρτα ποιος δημοσίευσε;**
   *
   * 🔴 **`false` ΜΟΝΟ όταν το λέει ήδη η ΙΔΙΑ Η ΣΕΛΙΔΑ.** Η γραμμή υπογραφής απαντά
   * *«με ποιον μιλάω;»* — στη βιτρίνα ενός γραφείου η απάντηση είναι ο **τίτλος** της
   * σελίδας, και επαναλαμβανόμενη σε κάθε κάρτα γίνεται θόρυβος που **μειώνει τη
   * σάρωση** (ίδιο μετρημένο σκεπτικό Baymard με το «5 βασικά + 3 ειδικά»).
   *
   * ⛔ **ΔΕΝ είναι διακόπτης ύφους και ΔΕΝ γίνεται `false` για να «καθαρίσει» η οθόνη.**
   * Η προέλευση είναι **συμμόρφωση**, όχι διακόσμηση *(ADR-841 §7 Α1.5: Οδηγία
   * 2005/29/ΕΚ άρθρο 7(4)(β) · ΔΕΕ C-146/16)*. Απόκρυψη χωρίς να την αναλαμβάνει
   * **άλλο ορατό στοιχείο της σελίδας** αφαιρεί πληροφορία που ο επισκέπτης δικαιούται.
   */
  readonly showAuthorship?: boolean;
  /**
   * **Είναι αυτή η κάρτα το στοιχείο LCP της οθόνης;** (ADR-841 §7 Α2.4)
   *
   * 🔴 **Η κάρτα ΔΕΝ ξέρει τη θέση της — τη λέει η λίστα.** Ένας υπολογισμός εδώ μέσα
   * θα ήταν αδύνατος: η ίδια κάρτα ζει σε **δύο** οθόνες *(αποτελέσματα · βιτρίνα)*,
   * και σε καμία από τις δύο δεν βλέπει τους αδελφούς της.
   *
   * ⚠️ **ΜΟΝΟ ΜΙΑ κάρτα ανά οθόνη το παίρνει.** Πολλές εικόνες «υψηλής
   * προτεραιότητας» **ακυρώνουν η μία την άλλη** — το μετρημένο όφελος
   * *(LCP 2,6s → 1,9s, Google Flights)* προϋποθέτει ότι είναι **μία**.
   */
  readonly priority?: boolean;
}

export function ListingCard({
  listing,
  isHighlighted = false,
  onHover,
  filterQuery = '',
  showAuthorship = true,
  priority = false,
}: ListingCardProps) {
  const { t } = useTranslation(['search-results']);
  const price = resolveDisplayPrice(listing);
  const image = listingLeadImage(listing);

  return (
    <li>
      <Link
        href={listingDetailHref(listing.id, filterQuery)}
        onMouseEnter={() => onHover?.(listing.id)}
        onMouseLeave={() => onHover?.(null)}
        onFocus={() => onHover?.(listing.id)}
        onBlur={() => onHover?.(null)}
        className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <article
          className={[
            'rounded-lg border bg-card p-3 transition-colors',
            isHighlighted ? 'border-ring bg-accent' : 'border-border',
          ].join(' ')}
        >
          {/*
            🔴 **Η ΚΑΡΤΑ ΑΠΕΚΤΗΣΕ ΕΙΚΟΝΑ** (ADR-841 §7 Α2) — μέχρι σήμερα η οθόνη
            αποτελεσμάτων ήταν **λίστα κειμένου**, με μηδέν `<img>`.

            ⚠️ **Η ΑΠΟΥΣΙΑ ΔΕΝ ΓΕΜΙΖΕΙ.** Καμία εικόνα-θέσης, κανένα εικονίδιο σπιτιού:
            μια κάρτα με ξένη εικόνα διαβάζεται ως **αληθινή φωτογραφία που δεν δείχνει
            αυτό το ακίνητο** (§25.5.2). Χωρίς εικόνα, η κάρτα μένει αυτό που ήταν.

            🔑 **`aspect-[4/3]` + `width`/`height` μαζί**: το πρώτο δίνει στη θήκη
            **σταθερό ύψος πριν φορτώσει τίποτα** *(το CLS της λίστας, όπου ο χρήστης
            σαρώνει και πατά)*· τα δεύτερα λένε στον περιηγητή τον **λόγο** των bytes.
            Το `object-cover` κόβει τη διαφορά — όπως ακριβώς κάνει η Zillow στα
            thumbnails των αποτελεσμάτων (~4:3).
          */}
          {image !== null && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              srcSet={listingImageSrcSet(image)}
              sizes={CARD_IMAGE_SIZES}
              width={image.width}
              height={image.height}
              alt={t(image.altKey, { index: 1, total: listing.gallery.length })}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              decoding="async"
              className="mb-2 aspect-[4/3] w-full rounded-md border border-border object-cover"
            />
          )}

          <h3 className="truncate text-sm font-medium text-foreground">{listing.title}</h3>

          <p className="mt-1 text-base font-semibold text-foreground">
            {price.kind === 'priced'
              ? formatCurrency(price.headline.amount)
              : t(MISSING_PRICE_KEY[price.reason])}
            {price.kind === 'priced' && price.secondary && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {formatCurrency(price.secondary.amount)}
              </span>
            )}
          </p>

          <dl className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {listing.areaSqm !== null && (
              <div><dd>{t('search-results:listing.areaSqm', { value: listing.areaSqm })}</dd></div>
            )}
            {listing.floor !== null && (
              <div>
                <dd>
                  {listing.floor === 0
                    ? t('search-results:listing.groundFloor')
                    : t('search-results:listing.floor', { value: listing.floor })}
                </dd>
              </div>
            )}
            {listing.bedrooms !== null && (
              <div><dd>{t('search-results:listing.bedrooms', { count: listing.bedrooms })}</dd></div>
            )}
          </dl>

          {/* Οι ΔΙΑΘΕΣΕΙΣ, ποτέ το lossy `commercialStatus` — αλλιώς η αντιπαροχή σιωπά. */}
          <ul className="mt-2 flex flex-wrap gap-1">
            {listing.offerKinds.map((kind) => (
              <li
                key={kind}
                className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
              >
                {t(`search-results:listing.offer.${kind}`)}
              </li>
            ))}
          </ul>

          {/*
            🔴 **Η ΥΠΟΓΡΑΦΗ (§8.33)** — «με ποιον μιλάω;», απαντημένο πριν κλικάρει.
            Απόφαση Giorgio (2026-08-20): η αγγελία γραφείου φέρει την **επωνυμία**.

            ⚠️ **Τρεις καταστάσεις, όχι δύο.** Το «γραφείο με επωνυμία» και το
            «γραφείο **χωρίς** επωνυμία» δεν συμπτύσσονται, και ένα κενό
            «Από γραφείο: » θα διαβαζόταν ως σπασμένη οθόνη.

            ✅ **Ο ΤΡΙΤΟΣ ΚΛΑΔΟΣ ΑΛΛΑΞΕ ΝΟΗΜΑ** (ADR-841 §7 Α1, 2026-09-01). Εδώ έγραφε
            ότι ο `agencyAnonymous` *«συμβαίνει για τις αγγελίες **έργων** (δηλωμένο
            κενό)»* — **δεν συμβαίνει πια**: ο γραφέας των έργων διαβάζει πλέον την
            επωνυμία. Ο κλάδος **μένει**, γιατί απαντά σε πραγματική κατάσταση που
            **δεν** είναι δικό μας κενό: εταιρεία που **δεν έχει δηλώσει** επωνυμία, ή
            ανάγνωση που **απέτυχε**. Η οθόνη **δεν αναπληρώνει** — το λέει.

            🔑 **Η οθόνη δεν άλλαξε γραμμή για να συμβεί αυτό**, και αυτό ήταν το
            εύρημα: δεν έλειπε μηχανή, έλειπε **μία κλήση** στον διακομιστή.

            ✅ **Ο ΤΡΙΑΔΙΚΟΣ ΕΦΥΓΕ ΑΠΟ ΕΔΩ** (ADR-841 Α13.2, 2026-09-01) — **όχι για
            τάξη**: η **σελίδα** της αγγελίας χρειάστηκε την ίδια πρόταση *(Ο-9, νομικό)*,
            και αντιγραφή του κλάδου θα ήταν **δεύτερη αλήθεια στη ΛΟΓΙΚΗ**. Τα διπλά
            κλειδιά τα πιάνει το CHECK 3.8· τον διπλό κλάδο **τίποτα**. Η απόφαση ζει
            πλέον στο `lib/listings/listing-authorship.ts`, η ζωγραφική στη γραμμή από
            κάτω — και **η τυπογραφία μένει εδώ**, γιατί εδώ είναι υποσημείωση.
          */}
          {showAuthorship ? (
            <ListingAuthorshipLine
              listing={listing}
              className="mt-2 text-xs text-muted-foreground"
            />
          ) : null}
        </article>
      </Link>
    </li>
  );
}
