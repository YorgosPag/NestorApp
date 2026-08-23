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

interface ListingCardProps {
  readonly listing: PublicListing;
  readonly isHighlighted: boolean;
  readonly onHover: (id: string | null) => void;
  /** Τα ενεργά φίλτρα ως ερώτημα — ταξιδεύουν μαζί με τον επισκέπτη στην οθόνη 3. */
  readonly filterQuery: string;
}

export function ListingCard({ listing, isHighlighted, onHover, filterQuery }: ListingCardProps) {
  const { t } = useTranslation(['search-results']);
  const price = resolveDisplayPrice(listing);

  return (
    <li>
      <Link
        href={listingDetailHref(listing.id, filterQuery)}
        onMouseEnter={() => onHover(listing.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(listing.id)}
        onBlur={() => onHover(null)}
        className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <article
          className={[
            'rounded-lg border bg-card p-3 transition-colors',
            isHighlighted ? 'border-ring bg-accent' : 'border-border',
          ].join(' ')}
        >
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
              <div><dd>{t('search-results:card.areaSqm', { value: listing.areaSqm })}</dd></div>
            )}
            {listing.floor !== null && (
              <div>
                <dd>
                  {listing.floor === 0
                    ? t('search-results:card.groundFloor')
                    : t('search-results:card.floor', { value: listing.floor })}
                </dd>
              </div>
            )}
            {listing.bedrooms !== null && (
              <div><dd>{t('search-results:card.bedrooms', { count: listing.bedrooms })}</dd></div>
            )}
          </dl>

          {/* Οι ΔΙΑΘΕΣΕΙΣ, ποτέ το lossy `commercialStatus` — αλλιώς η αντιπαροχή σιωπά. */}
          <ul className="mt-2 flex flex-wrap gap-1">
            {listing.offerKinds.map((kind) => (
              <li
                key={kind}
                className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
              >
                {t(`search-results:card.offer.${kind}`)}
              </li>
            ))}
          </ul>

          {/*
            🔴 **Η ΥΠΟΓΡΑΦΗ (§8.33)** — «με ποιον μιλάω;», απαντημένο πριν κλικάρει.
            Απόφαση Giorgio (2026-08-20): η αγγελία γραφείου φέρει την **επωνυμία**.

            ⚠️ **Τρεις καταστάσεις, όχι δύο.** Το «γραφείο με επωνυμία» και το
            «γραφείο **χωρίς** επωνυμία» δεν συμπτύσσονται: το δεύτερο συμβαίνει για
            τις αγγελίες **έργων** (δηλωμένο κενό στο `PublicListing.agencyName`), και
            ένα κενό «Από γραφείο: » θα διαβαζόταν ως σπασμένη οθόνη.
          */}
          <p className="mt-2 text-xs text-muted-foreground">
            {listing.authorship === 'owner-declared'
              ? t('search-results:card.authorship.ownerDeclared')
              : listing.agencyName === null
                ? t('search-results:card.authorship.agencyAnonymous')
                : t('search-results:card.authorship.agency', { name: listing.agencyName })}
          </p>
        </article>
      </Link>
    </li>
  );
}
