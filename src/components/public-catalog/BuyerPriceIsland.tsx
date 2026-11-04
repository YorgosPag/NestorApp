'use client';

/**
 * **Η νησίδα «η τιμή σας»** (ADR-923 §5.13 Σ6 · Δ2): η σελίδα μένει ISR, και η τιμή του συνδεδεμένου αγοραστή έρχεται **μόνο**
 * από εδώ, από route `private, no-store`. Προσωποποιημένη τιμή δεν μπαίνει ποτέ σε αποθηκευμένο HTML.
 *
 * 🔑 Ανώνυμος ⇒ καμία κλήση. Κάθε αποτυχία (χωρίς δικαίωμα, δίκτυο, άρνηση) ⇒ τίποτα: η δημόσια τιμή μένει όπως είναι.
 * 🔑 Αλλαγή χρήστη ή μοντέλου ⇒ η παλιά απάντηση πετιέται (`active`), ποτέ τιμή άλλου λογαριασμού στην οθόνη.
 * ⚠️ Δεν αποφασίζει τίποτα: το κοινό το κρίνει ο διακομιστής από τη σύνδεση και τη σχέση.
 *
 * @module components/public-catalog/BuyerPriceIsland
 */

import React, { useEffect, useState } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { fetchBuyerShowcasePrices } from '@/services/public-catalog/public-catalog-prices.client';
import type { PublicCatalogModel } from '@/subapps/catalog/public/public-catalog-schema';
import type { ShowcaseModelPrices } from '@/subapps/catalog/public/showcase-price';

import { usePublicCatalogText } from './public-catalog-text';
import { BuyerPrice } from './ShowcasePriceView';

/** Οι τιμές **μαζί με το για ποιον και για τι** ζητήθηκαν: δείχνονται μόνο αν το κλειδί ταιριάζει με το τρέχον. */
interface KeyedPrices {
  readonly key: string;
  readonly prices: ShowcaseModelPrices;
}

const pricesKeyOf = (uid: string, model: PublicCatalogModel): string => `${uid}|${model.companyId}|${model.modelId}`;

/**
 * Οι τιμές του αγοραστή για το μοντέλο· `null` όσο δεν υπάρχουν (ανώνυμος, φόρτωση, αποτυχία). Το κλειδί κρίνεται **στην
 * απόδοση**, όχι στο effect: η τιμή του προηγούμενου λογαριασμού ή μοντέλου δεν φαίνεται ούτε για ένα frame πριν τρέξει το
 * effect (3ος γύρος ανασκόπησης). Το `active` πετά την απάντηση που φτάνει μετά την αλλαγή.
 */
function useBuyerPrices(model: PublicCatalogModel): ShowcaseModelPrices | null {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [loaded, setLoaded] = useState<KeyedPrices | null>(null);
  const key = uid === null ? null : pricesKeyOf(uid, model);
  useEffect(() => {
    if (key === null) return undefined;
    let active = true;
    fetchBuyerShowcasePrices(model.companyId, model.modelId)
      .then((wire) => { if (active) setLoaded({ key, prices: wire.prices }); })
      .catch(() => { if (active) setLoaded(null); });
    return () => { active = false; };
  }, [key, model.companyId, model.modelId]);
  return loaded !== null && loaded.key === key ? loaded.prices : null;
}

export function BuyerPriceIsland({ model }: { readonly model: PublicCatalogModel }): React.JSX.Element | null {
  const { t } = usePublicCatalogText();
  const prices = useBuyerPrices(model);
  if (prices === null) return null;
  const single = model.variants.length === 1;
  const rows = model.variants.flatMap((variant) => {
    const price = prices[variant.variantId];
    // Μόνο τιμή κριμένη για αγοραστή (`audience`): η νησίδα δεν ζωγραφίζει ποτέ άλλο σχήμα τιμής.
    if (price?.kind !== 'priced' || price.audience !== 'buyer') return [];
    const label = single ? t('price.yours') : t('price.yoursFor', { sku: variant.label ?? variant.code ?? variant.variantId });
    return [<li key={variant.variantId}><BuyerPrice label={label} price={price} /></li>];
  });
  if (rows.length === 0) return null;
  return (
    <section aria-label={t('price.yours')} className="rounded-md border p-3">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">{rows}</ul>
    </section>
  );
}
