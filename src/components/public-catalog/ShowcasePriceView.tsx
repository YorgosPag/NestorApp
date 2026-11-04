'use client';

/**
 * **Η τιμή στη δημόσια βιτρίνα** (ADR-923 §5.13 Σ6): η ανώνυμη τελική τιμή, η τιμή «από» της κάρτας και η τιμή του αγοραστή.
 *
 * 🔑 Φορτώνεται **μόνο** πίσω από το `defineLazySurfaces` (`public-catalog-surfaces.tsx`), άρα τα κλειδιά του δεν μπαίνουν στη σφραγισμένη
 *    στατική κλειστότητα των σελίδων (CHECK 3.34), και με κλειστό διακόπτη δεν φτάνει καν στον browser.
 * 🔑 Ανώνυμος: η **τελική** τιμή με ΦΠΑ πρώτη (Οδηγία 98/6/ΕΚ άρθ. 2(α)), ο συντελεστής, και η τιμή μονάδας όταν η τιμή αφορά
 *    περισσότερες μονάδες (άρθ. 3). Καμία διαγραμμένη τιμή ή «−x%»: δεν ανακοινώνεται μείωση (άρθ. 6α, Omnibus).
 * 🔑 Αγοραστής: η καθαρή τιμή, ρητά «χωρίς ΦΠΑ», όπως στους B2B καταλόγους (Würth «Ihr Preis», Amazon Business «excl. VAT»).
 *
 * @module components/public-catalog/ShowcasePriceView
 */

import React from 'react';

import { useUomLabel } from '@/hooks/useUomLabel';
import { formatMinor, type MinorAmount } from '@/lib/money/money';
import type { ShowcaseBuyerPrice, ShowcasePricedAmounts } from '@/subapps/catalog/public/showcase-price';

import { usePublicCatalogText } from './public-catalog-text';

/** «12,40 € ανά 100 μ» ή «12,40 € ανά μ»: το ποσό με τη μονάδα που αφορά. */
function useAmountPer() {
  const { t } = usePublicCatalogText();
  const uomLabel = useUomLabel();
  return (amount: MinorAmount, quantity: number, unitCode: string): string => {
    const price = formatMinor(amount);
    const unit = uomLabel(unitCode);
    return quantity === 1 ? t('price.amountPerUnit', { price, unit }) : t('price.amountPer', { price, quantity, unit });
  };
}

/** Η τελική τιμή με τη μονάδα της και η γραμμή του ΦΠΑ· `null` αν η τιμή δεν έχει τελική (ποτέ προς τον ανώνυμο, από το σχήμα). */
function useFinalPrice(price: ShowcasePricedAmounts): { readonly amount: string; readonly vat: string; readonly unit: string | null } | null {
  const { t } = usePublicCatalogText();
  const amountPer = useAmountPer();
  if (price.gross === null || price.vatRate === null) return null;
  const unit = price.unitGross === null ? null : t('price.unitPrice', { price: amountPer(price.unitGross, 1, price.unitCode) });
  return { amount: amountPer(price.gross, price.priceQuantity, price.unitCode), vat: t('price.vatIncluded', { rate: price.vatRate }), unit };
}

/** Η τελική τιμή προς τον ανώνυμο, πρώτη· μετά ο συντελεστής και η τιμή μονάδας. */
export function PublicPrice({ price }: { readonly price: ShowcasePricedAmounts }): React.JSX.Element | null {
  const final = useFinalPrice(price);
  if (final === null) return null;
  return (
    <p className="m-0 flex flex-col text-sm">
      <strong className="text-base font-semibold text-foreground">{final.amount}</strong>
      <span className="text-muted-foreground">{final.vat}</span>
      {final.unit !== null && <span className="text-muted-foreground">{final.unit}</span>}
    </p>
  );
}

/** Η τιμή «από» μιας κάρτας: η χαμηλότερη τελική, στη μονάδα που μοιράζονται τα SKU. */
export function PublicFromPrice({ price }: { readonly price: ShowcasePricedAmounts }): React.JSX.Element | null {
  const { t } = usePublicCatalogText();
  const final = useFinalPrice(price);
  if (final === null) return null;
  return <p className="m-0 text-sm text-foreground">{t('price.from', { price: final.amount })} <span className="text-muted-foreground">{final.vat}</span></p>;
}

/** Η τιμή του συνδεδεμένου αγοραστή: καθαρή, και η τελική μόνο όταν ο συντελεστής είναι δηλωμένος. */
export function BuyerPrice({ label, price }: { readonly label: string; readonly price: ShowcaseBuyerPrice }): React.JSX.Element {
  const { t } = usePublicCatalogText();
  const amountPer = useAmountPer();
  return (
    <p className="m-0 flex flex-col text-sm">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-base font-semibold text-foreground">{t('price.vatExcluded', { price: amountPer(price.net, price.priceQuantity, price.unitCode) })}</strong>
      {price.gross !== null && price.vatRate !== null && (
        <span className="text-muted-foreground">{t('price.withVat', { rate: price.vatRate, price: amountPer(price.gross, price.priceQuantity, price.unitCode) })}</span>
      )}
    </p>
  );
}
