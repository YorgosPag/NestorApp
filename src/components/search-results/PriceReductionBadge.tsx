'use client';

/**
 * **Η ΣΗΜΑΝΣΗ ΜΕΙΩΣΗΣ ΤΙΜΗΣ** — «~~3.490.000 €~~ ↓ 8,3%», μία για την κάρτα, τον χάρτη και τη σελίδα.
 *
 * @related ADR-777 §8.69 · lib/listings/price-history.ts · components/listing-detail/ListingPriceReduction.tsx
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΝΑ COMPONENT, ΤΡΕΙΣ ΘΕΣΕΙΣ — ΓΙΑ ΤΟΝ ΛΟΓΟ ΠΟΥ Η ΤΙΜΗ ΕΧΕΙ ΕΝΑΝ SSoT
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η κάρτα της λίστας, το αναδυόμενο του χάρτη και η σελίδα της αγγελίας ρωτούν ήδη τον
 * **ίδιο** `price-resolver`. Αν η σήμανση γραφόταν τρεις φορές, η πρώτη διόρθωση (π.χ. στο
 * κατώφλι φρεσκάδας) θα έφτανε σε **μία** — και ο επισκέπτης θα έβλεπε «↓8%» στον χάρτη και
 * τίποτα στη σελίδα της ίδιας αγγελίας.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΖΕΙ ΣΤΟ ΚΕΛΥΦΟΣ — ΚΑΙ ΓΙ' ΑΥΤΟ ΚΟΥΒΑΛΑ ΕΝΑ ΚΛΕΙΔΙ, ΟΧΙ ΤΕΣΣΕΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η `ListingCard` αποδίδεται και στη βιτρίνα της αρχικής, άρα στην **κλειστότητα του
 * κελύφους** — και ο γεννήτορας αποδίδει κλειδιά **ανά αρχείο**. Η πρώτη γραφή είχε εδώ και
 * τη λεπτομερή μορφή (ημερομηνία + αναφορά) και η CHECK 3.34 **αρνήθηκε** να γράψει:
 * `search-results: 15400 bytes > προϋπολογισμός 15200`, *«η θεραπεία είναι ΜΕΤΑΚΟΜΙΣΗ»* —
 * ακριβώς το περιστατικό του ADR-777 §8.51. ⇒ Η λεπτομερής μορφή μετακόμισε στο
 * `ListingPriceReduction` (namespace `listing-detail`, **μόνο** στη διαδρομή της αγγελίας), και
 * εδώ έμεινε **μία** λέξη για τον αναγνώστη οθόνης. Το «↓ 8,3%» δεν έχει λέξη: είναι σύμβολο
 * και αριθμός, μορφοποιημένος από το SSoT (`formatPercentage`) στη γλώσσα του επισκέπτη.
 *
 * ⚠️ **Και η μία λέξη ζει στο `common`, ΟΧΙ στο `search-results`** — μετρημένο: ακόμη και
 * μόνη της έβγαζε `search-results: 15223 > 15200` (το namespace είχε περιθώριο ~40 bytes).
 * «Προηγούμενη τιμή» είναι λέξη **χωρίς τομέα**, και το `common` είναι ήδη εγγυημένο στο
 * κέλυφος με περιθώριο χιλιάδων bytes — μετακόμιση στο **σωστό** namespace, όχι μεγαλύτερος αριθμός.
 *
 * ⛔ **Καμία κρίση εδώ.** Η μείωση έρχεται **έτοιμη** από την προβολή, και το «δείχνεται
 * ακόμη;» το απαντά το `isReductionFresh` — ο **ίδιος** κριτής με τον ειδοποιητή email.
 */

import React, { useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency, formatPercentage } from '@/lib/intl-formatting';
import { isReductionFresh } from '@/lib/listings/price-history';
import type { PriceReduction } from '@/types/price-history';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

/**
 * **Η μείωση, μόνο αν δείχνεται ακόμη** — ο ΕΝΑΣ τρόπος που ένα component ρωτά φρεσκάδα.
 *
 * ⚠️ **Το «τώρα» διαβάζεται ΜΙΑ φορά ανά mount** (αρχικοποιητής `useState`), ποτέ σε κάθε
 * απόδοση: η φρεσκάδα κρίνεται σε **ημέρες**, και μια κάρτα που άλλαζε απάντηση ανάμεσα σε
 * δύο αποδόσεις του ίδιου λεπτού θα ήταν ασταθής χωρίς κανένα όφελος.
 */
export function useFreshReduction(reduction: PriceReduction | null): PriceReduction | null {
  const [nowMs] = useState(() => Date.now());
  return reduction !== null && isReductionFresh(reduction, nowMs) ? reduction : null;
}

interface PriceReductionBadgeProps {
  readonly reduction: PriceReduction | null;
  /** Απόσταση από το γειτονικό ποσό — την αποφασίζει ο **γονέας**, όχι η σήμανση. */
  readonly className?: string;
}

export function PriceReductionBadge({ reduction, className = '' }: PriceReductionBadgeProps) {
  const { t } = useTranslation(['common']);
  const colors = useSemanticColors();
  const fresh = useFreshReduction(reduction);

  if (fresh === null) return null;

  return (
    <span className={`text-sm font-normal ${className}`.trim()}>
      {/* Ο αναγνώστης οθόνης δεν «βλέπει» τη διαγραφή — του λέμε τι είναι το ποσό. */}
      <span className="sr-only">{t('common:priceReduction.was')} </span>
      <del className="text-muted-foreground">{formatCurrency(fresh.from)}</del>{' '}
      <span className={`font-medium ${colors.text.success}`}>
        ↓ {formatPercentage(fresh.dropBasisPoints / 100)}
      </span>
    </span>
  );
}
