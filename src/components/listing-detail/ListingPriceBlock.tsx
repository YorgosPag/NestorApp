'use client';

/**
 * **Η τιμή της οθόνης 3 — με τον ΡΟΛΟ κάθε ποσού γραμμένο δίπλα του.**
 *
 * @related ADR-777 §7 (Α6 · Α7 · Α21) · lib/properties/price-resolver · lib/listings/listing-price-keys
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΔΙΑΦΟΡΑ ΑΠΟ ΤΗΝ ΚΑΡΤΑ ΔΕΝ ΕΙΝΑΙ ΤΟ ΜΕΓΕΘΟΣ — ΕΙΝΑΙ ΟΤΙ ΕΔΩ ΤΑ ΠΟΣΑ ΕΧΟΥΝ ΟΝΟΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η κάρτα δείχνει δύο αριθμούς χωρίς ετικέτα, γιατί εκεί μετράει η σάρωση. Και οι
 * **δύο** νόμιμες περιπτώσεις του `price-resolver` παράγουν δύο αριθμούς:
 *
 * - **πωλημένο** → τελική **και** ζητούμενη (Α21)
 * - **προς πώληση και ενοικίαση** → τιμή **και** ενοίκιο
 *
 * «185.000 και 200.000» **δεν λέει από μόνο του** ποια από τις δύο είναι. Στη σελίδα
 * του ακινήτου — τη «σκάβω» βαθμίδα της **Α7** — η σιωπή αυτή γίνεται σφάλμα: ο
 * επισκέπτης εδώ παίρνει απόφαση, όχι εντύπωση.
 *
 * ⛔ **Καμία ωμή ανάγνωση `price`**, καμία δεύτερη μηχανή τιμής. Ο ρόλος διαβάζεται
 * από το `source` που **ήδη** επιστρέφει ο SSoT — δεν συμπεραίνεται από την κατάσταση.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveDisplayPrice, type ResolvedPrice } from '@/lib/properties/price-resolver';
import { MISSING_PRICE_KEY, PRICE_ROLE_KEY } from '@/lib/listings/listing-price-keys';
import { formatCurrency } from '@/lib/intl-formatting';
import type { PublicListing } from '@/types/public-listing';

interface ListingPriceBlockProps {
  readonly listing: PublicListing;
}

/** Ένα ποσό: **τι είναι** (ρόλος) και **πόσο**. Ποτέ το ένα χωρίς το άλλο. */
function PriceRow({ price, emphasis }: { readonly price: ResolvedPrice; readonly emphasis: boolean }) {
  const { t } = useTranslation(['search-results']);

  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      <dt className="text-sm text-muted-foreground">{t(PRICE_ROLE_KEY[price.source])}</dt>
      <dd
        className={
          emphasis
            ? 'text-2xl font-semibold text-foreground'
            : 'text-lg font-medium text-foreground'
        }
      >
        {formatCurrency(price.amount)}
      </dd>
    </div>
  );
}

export function ListingPriceBlock({ listing }: ListingPriceBlockProps) {
  const { t } = useTranslation(['search-results']);
  const price = resolveDisplayPrice(listing);

  return (
    <section aria-labelledby="listing-price-heading" className="rounded-lg border border-border bg-card p-4">
      <h2 id="listing-price-heading" className="text-sm font-medium text-muted-foreground">
        {t('search-results:detail.price.heading')}
      </h2>

      {price.kind === 'priced' ? (
        <dl className="mt-2 space-y-1">
          <PriceRow price={price.headline} emphasis />
          {/* Το δεύτερο ποσό υπάρχει **μόνο** όταν λέει κάτι νέο: ο SSoT πετά τη
              ζητούμενη όταν είναι ίδια με την τελική — «το ίδιο γεγονός δύο φορές». */}
          {price.secondary && <PriceRow price={price.secondary} emphasis={false} />}
        </dl>
      ) : (
        /* Η απουσία είναι **κατάσταση με αιτία**, ποτέ «0 €» και ποτέ «επικοινωνήστε». */
        <p className="mt-2 text-lg text-muted-foreground">{t(MISSING_PRICE_KEY[price.reason])}</p>
      )}
    </section>
  );
}
