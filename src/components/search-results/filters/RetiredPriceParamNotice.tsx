'use client';

/**
 * @fileoverview **Ο ΠΑΛΙΟΣ ΣΥΝΔΕΣΜΟΣ ΖΗΤΟΥΣΕ ΤΙΜΗ ΧΩΡΙΣ ΜΟΝΑΔΑ** — και δεν τον πετάμε.
 * @related ADR-777 §8.60.14 (Φάση 2) · lib/criteria/listing-criteria-url.ts
 * @module components/search-results/filters/RetiredPriceParamNotice
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΛΥΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως το §8.60.14 η διεύθυνση είχε **έναν** άξονα τιμής (`pmin`/`pmax`) που σήμαινε
 * *«ποσό, όποιου ρόλου»* — ερώτηση που πλέον ξέρουμε ότι **δεν απαντιέται**: «έως
 * 1.000 €» δέχεται ενοίκιο 900 €/μήνα **και** διανυκτέρευση 50 €/νύχτα.
 *
 * Ένας σύνδεσμος που μοιράστηκε τότε έχει **τρεις** πιθανές μοίρες:
 *
 * | Δρόμος | Τι συμβαίνει |
 * |---|---|
 * | ψευδώνυμο σε έναν ρόλο | **εικασία με στολή συμβατότητας** — ο άνθρωπος μπορεί να εννοούσε ενοίκιο |
 * | αγνόηση | το φίλτρο **χάνεται σιωπηλά** — αναγνωρισμένο ελάττωμα: *«the URL implies a filter that is silently ignored»* |
 * | ✅ **ερώτηση** | οι αριθμοί **κρατιούνται** και ο άνθρωπος λέει σε ποια μονάδα |
 *
 * 🏆 **Τα portal απλώς τους πετούν.** Εδώ ο παλιός σύνδεσμος **αναγνωρίζεται** και
 * απαντιέται με **ένα κλικ** — χωρίς να μαντέψουμε τίποτα.
 *
 * ⚠️ **Δεν γράφει ΠΟΤΕ το `pmin`/`pmax` πίσω στη διεύθυνση.** Μόλις ο άνθρωπος διαλέξει
 * μονάδα, ο κανονικός άξονας γράφεται και η αποσυρμένη παράμετρος **φεύγει** — αλλιώς
 * δύο ονόματα θα ζούσαν στην ίδια γραμμή για την ίδια ερώτηση.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import type { CriterionRange } from '@/lib/criteria/criterion-vocabulary';
import { PRICE_CRITERION_KEYS, type PriceCriterionKey } from './criteria-filter-groups';
import { criterionLabel } from '@/lib/criteria/listing-criterion-labels';

interface RetiredPriceParamNoticeProps {
  /** Οι αριθμοί του παλιού συνδέσμου. `null` ⇒ δεν εμφανίζεται τίποτα. */
  readonly range: CriterionRange | null;
  /** Γράφει το εύρος στον άξονα που διάλεξε ο άνθρωπος, **και μόνο τότε**. */
  readonly onChoose: (key: PriceCriterionKey, range: CriterionRange) => void;
}

/** Το άκρο ως κείμενο· η **απουσία** άκρου δεν γράφεται ως «0». */
function edgeText(value: number | null): string {
  return value === null ? '—' : formatCurrency(value);
}

export function RetiredPriceParamNotice({ range, onChoose }: RetiredPriceParamNoticeProps) {
  const { t } = useTranslation(['search-filters']);

  if (range === null) return null;

  return (
    <aside
      role="status"
      className="w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground"
    >
      <p>
        {t('search-filters:filters.price.retired', {
          min: edgeText(range.min),
          max: edgeText(range.max),
        })}
      </p>
      {/*
        🔑 **Κουμπιά, όχι μενού**: είναι **τρεις** επιλογές και η ερώτηση είναι
        στιγμιαία. Ένα `Select` θα έκρυβε τις απαντήσεις πίσω από ένα κλικ παραπάνω —
        για ερώτηση που ο άνθρωπος δεν ζήτησε να του γίνει.
      */}
      <ul className="mt-2 flex flex-wrap gap-2">
        {PRICE_CRITERION_KEYS.map((key) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => onChoose(key, range)}
              className="rounded-md border border-input bg-background px-2 py-1 hover:bg-accent"
            >
              {criterionLabel(t, key)}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
