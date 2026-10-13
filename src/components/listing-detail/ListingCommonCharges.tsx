'use client';

/**
 * **Τα κοινόχρηστα στο μπλοκ τιμής** (ADR-777 §8.93) — ποσό τον μήνα, τι περιλαμβάνουν, και στην ενοικίαση το
 * **σύνολο** που θα φεύγει κάθε μήνα.
 *
 * @related `lib/common-charges/common-charges.ts` (ο κριτής · το σύνολο) · `./ListingPriceBlock.tsx`
 *
 * 🔴 **ΠΕΝΤΕ ΚΑΤΑΣΤΑΣΕΙΣ, ΚΑΜΙΑ ΣΙΩΠΗΛΗ**
 *
 * | Κουτί | Τι γράφει |
 * |---|---|
 * | `null` | τίποτα — η ερώτηση **δεν τίθεται** (γη · μόνο βραχυχρόνια) |
 * | ποσό `null` | «Δεν έχουν δηλωθεί» — το κενό έχει όνομα (Rightmove: «ask agent») |
 * | `0` | «Χωρίς κοινόχρηστα» — **απάντηση**, ποτέ «0 €/μήνα» |
 * | `> 0` | το ποσό με τη μονάδα του · τι περιλαμβάνουν · «δήλωση του αγγελιοδότη, κατά προσέγγιση» |
 * | ενοίκιο και `> 0` | επιπλέον το σύνολο του μήνα |
 *
 * 🏆 Το σύνολο είναι η «Warmmiete» της ImmoScout24· Idealista και Spitogatos αφήνουν την πρόσθεση στον αναγνώστη.
 *
 * ⛔ **Καμία δεύτερη ανάγνωση τιμής**: το ενοίκιο έρχεται από την ετυμηγορία του `price-resolver` που ήδη κρατά ο
 * καλών· η μονάδα «/μήνα» από τον ΕΝΑΝ δρόμο (`resolvedPriceLabel`).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { monthlyOutlay, type CommonCharges } from '@/lib/common-charges/common-charges';
import { COMMON_CHARGE_INCLUSION_KEY } from '@/lib/common-charges/common-charges-keys';
import { formatList } from '@/lib/intl-formatting';
import { resolvedPriceLabel, type PriceLabelT } from '@/lib/listings/listing-price-label';

const NS = 'listing-detail';
const L = `${NS}:commonCharges`;
const ROW = 'flex flex-wrap items-baseline gap-x-3';
const TERM = 'text-sm text-muted-foreground';

interface ListingCommonChargesProps {
  readonly charges: CommonCharges | null;
  /** Το μηνιαίο ενοίκιο της αγγελίας, όταν διατίθεται προς μίσθωση — από την ετυμηγορία τιμής του καλούντος. */
  readonly rentAmount: number | null;
}

/** Το ποσό σε λέξεις: αδήλωτο · μηδενικό · με τη μονάδα του μήνα. */
function amountText(t: PriceLabelT, amount: number | null): string {
  if (amount === null) return t(`${L}.undeclared`);
  if (amount === 0) return t(`${L}.none`);
  return resolvedPriceLabel(t, { role: 'rent', amount });
}

/** «Περιλαμβάνουν: θέρμανση και ανελκυστήρας» — ή ρητά ότι δεν περιλαμβάνουν τίποτα. `null` ⇒ καμία γραμμή. */
function inclusionsText(t: PriceLabelT, includes: CommonCharges['includes']): string | null {
  if (includes === null) return null;
  if (includes.length === 0) return t(`${L}.includesNothing`);
  return t(`${L}.includes`, {
    items: formatList(includes.map((inclusion) => t(COMMON_CHARGE_INCLUSION_KEY[inclusion]))),
  });
}

export function ListingCommonCharges({ charges, rentAmount }: ListingCommonChargesProps) {
  // Τα ονόματα των παροχών ζουν στο λεξιλόγιο (`properties-enums`) — το ίδιο που διαβάζει η φόρμα.
  const { t } = useTranslation([NS, 'properties-enums']);
  if (charges === null) return null;

  const { monthlyAmount, includes } = charges;
  const declared = monthlyAmount !== null && monthlyAmount > 0;
  const inclusions = inclusionsText(t, includes);
  const total = rentAmount === null ? null : monthlyOutlay(rentAmount, charges);

  return (
    <div className="mt-3 border-t border-border pt-3">
      <dl className="space-y-1">
        <div className={ROW}>
          <dt className={TERM}>{t(`${L}.label`)}</dt>
          <dd className="text-sm font-medium text-foreground">{amountText(t, monthlyAmount)}</dd>
          {inclusions !== null && <dd className="basis-full text-sm text-foreground">{inclusions}</dd>}
        </div>
        {total !== null && (
          <div className={ROW}>
            <dt className={TERM}>{t(`${L}.total`)}</dt>
            <dd className="text-base font-semibold text-foreground">{resolvedPriceLabel(t, { role: 'rent', amount: total })}</dd>
            <dd className="basis-full text-xs text-muted-foreground">{t(`${L}.totalBasis`)}</dd>
          </div>
        )}
      </dl>
      {/* Κανόνας 18: αριθμός χωρίς προέλευση είναι ισχυρισμός. Μόνο δίπλα σε ποσό — το «δεν δηλώθηκε» δεν έχει τι να αποδώσει. */}
      {declared && <p className="m-0 mt-1 text-xs text-muted-foreground">{t(`${L}.provenance`)}</p>}
    </div>
  );
}
