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
import { SectionFrame } from '@/components/ui/section-frame';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveDisplayPrice, type ResolvedPrice } from '@/lib/properties/price-resolver';
import { MISSING_PRICE_KEY, PRICE_ROLE_KEY } from '@/lib/listings/listing-price-keys';
import { pricePerAreaLabel, pricePerSqmAmount } from '@/lib/listings/listing-price-label';
import { formatCurrency } from '@/lib/intl-formatting';
import { ListingPriceReduction } from './ListingPriceReduction';
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

/**
 * **Η τιμή ανά m²** — παράγωγο της ΙΔΙΑΣ ετυμηγορίας, ποτέ δεύτερη ανάγνωση τιμής (ADR-777 §8.91).
 *
 * 🔑 Η μονάδα έρχεται από τον ρόλο («2.450 €/m²» · «9 €/m²/μήνα»), άρα δύο γραμμές με την ίδια ετικέτα
 * δεν μπερδεύονται. Χωρίς εμβαδόν ή σε ρόλο χωρίς τέτοια τιμή (διανυκτέρευση) η γραμμή **δεν υπάρχει**:
 * η απουσία του εμβαδού λέγεται ήδη, μία φορά, στα στοιχεία του ακινήτου.
 */
function PricePerAreaRow({ price, areaSqm }: { readonly price: ResolvedPrice; readonly areaSqm: number | null }) {
  const { t } = useTranslation(['listing-detail']);
  const perSqm = pricePerSqmAmount(price, areaSqm);
  if (perSqm === null) return null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      <dt className="text-sm text-muted-foreground">{t('listing-detail:price.perArea')}</dt>
      <dd className="text-sm font-medium text-foreground">
        {pricePerAreaLabel(t, { role: price.role, amount: perSqm })}
      </dd>
    </div>
  );
}

export function ListingPriceBlock({ listing }: ListingPriceBlockProps) {
  const { t } = useTranslation(['search-results']);
  const price = resolveDisplayPrice(listing);

  return (
    <SectionFrame headingId="listing-price-heading" title={t('search-results:detail.price.heading')} headingLevel="h2" titleSize="eyebrow">
      {price.kind === 'priced' ? (
        <>
          <dl className="mt-2 space-y-1">
            <PriceRow price={price.headline} emphasis />
            {/* Το δεύτερο ποσό υπάρχει **μόνο** όταν λέει κάτι νέο: ο SSoT πετά τη
                ζητούμενη όταν είναι ίδια με την τελική — «το ίδιο γεγονός δύο φορές». */}
            {price.secondary && <PriceRow price={price.secondary} emphasis={false} />}
            <PricePerAreaRow price={price.headline} areaSqm={listing.areaSqm} />
            {/* Δεύτερη τιμή ανά m² μόνο όταν είναι ΑΛΛΗ πλευρά της συναλλαγής (πώληση + ενοίκιο). Σε πωλημένο
                και τα δύο ποσά είναι πώληση: δύο αριθμοί κάτω από μία ετικέτα δεν διαβάζονται. */}
            {price.secondary && price.secondary.role !== price.headline.role && (
              <PricePerAreaRow price={price.secondary} areaSqm={listing.areaSqm} />
            )}
          </dl>
          {/* ADR-777 §8.69 — εδώ, στη «σκάβω» βαθμίδα, η μείωση λέει ΚΑΙ πότε ΚΑΙ σε σχέση με τι. */}
          <ListingPriceReduction reduction={listing.priceReduction} />
        </>
      ) : (
        /* Η απουσία είναι **κατάσταση με αιτία**, ποτέ «0 €» και ποτέ «επικοινωνήστε». */
        <p className="mt-2 text-lg text-muted-foreground">{t(MISSING_PRICE_KEY[price.reason])}</p>
      )}
    </SectionFrame>
  );
}
