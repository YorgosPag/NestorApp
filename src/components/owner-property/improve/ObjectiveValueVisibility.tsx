'use client';

/**
 * **Εμφάνιση ή απόκρυψη της αντικειμενικής στην αγγελία** (ADR-898 Φ3β-2 · απόφαση §11.1), με προεπισκόπηση **ακριβώς**
 * όπως τη βλέπει ο αγοραστής.
 *
 * 🔑 **Το ίδιο δικαίωμα για κάθε αγγελιοδότη** (ADR-898 §12.1 — το μάθημα της αγωγής κατά της Zillow): ένα πεδίο,
 *   ένας διακόπτης, κανένα επίπεδο συνδρομής.
 * 🔑 **Η προεπισκόπηση ΕΙΝΑΙ το component της αγγελίας** (`ListingObjectiveValue`) πάνω στην ίδια προβολή —
 *   όχι αναπαράσταση που θα μπορούσε να αποκλίνει. Κρυμμένη ⇒ η ενότητα δεν υπάρχει (πρότυπο NAR IDX).
 */

import React, { useId } from 'react';

import { ListingObjectiveValue } from '@/components/listing-detail/ListingObjectiveValue';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ListingObjectiveValue as BuyerView } from '@/lib/objective-value/listing-objective-value';
import type {
  ObjectiveValueDeclarationsPatch,
  ObjectiveValueDisplay,
} from '@/lib/objective-value/objective-value-declarations';
import type { ObjectiveValueReturn } from '@/lib/objective-value/objective-value-return';

const NS = 'objective-value';
const I = `${NS}:improve.visibility`;

interface VisibilityProps {
  readonly display: ObjectiveValueDisplay;
  readonly buyerView: BuyerView;
  readonly onAnswer: (patch: ObjectiveValueDeclarationsPatch) => void;
  /** Ο δρόμος επιστροφής από τον υπολογιστή (ADR-947 Φ1β) — ίδιος με τον σύνδεσμο της ενότητας. */
  readonly back: ObjectiveValueReturn | null;
  /**
   * `false` ⇒ μόνο ο διακόπτης: η προεπισκόπηση ζει ήδη αλλού στην ίδια οθόνη (το πλαϊνό της «Βελτίωσε», ADR-946) —
   * **ένα** αντίτυπο, ποτέ δύο. Προεπιλογή `true` (η καρτέλα ακινήτου του γραφείου δεν έχει πλαϊνό).
   */
  readonly preview?: boolean;
}

/** **Η αντικειμενική όπως τη βλέπει ο αγοραστής** — κρυμμένη ⇒ η εξήγηση, αλλιώς το ΙΔΙΟ component της αγγελίας. */
export function ObjectiveValueBuyerPreview({ buyerView, back }: Pick<VisibilityProps, 'buyerView' | 'back'>) {
  const { t } = useTranslation([NS]);
  return buyerView.kind === 'hidden' ? (
    <p className="m-0 text-sm text-muted-foreground">{t(`${I}.hiddenPreview`)}</p>
  ) : (
    <ListingObjectiveValue value={buyerView} back={back} />
  );
}

export function ObjectiveValueVisibility({ display, buyerView, onAnswer, back, preview = true }: VisibilityProps) {
  const { t } = useTranslation([NS]);
  const switchId = useId();
  const helpId = useId();
  const previewId = useId();
  const labelId = useId();
  return (
    <Card asChild className="flex flex-col gap-3 p-4">
      <section aria-labelledby={preview ? previewId : labelId}>
        <p className="m-0 flex items-center justify-between gap-3">
          <Label id={labelId} htmlFor={switchId}>{t(`${I}.label`)}</Label>
          <Switch
            id={switchId}
            aria-describedby={helpId}
            checked={display === 'shown'}
            onCheckedChange={(checked) => onAnswer({ display: checked ? 'shown' : 'hidden' })}
          />
        </p>
        <p id={helpId} className="m-0 text-xs text-muted-foreground">
          {t(`${I}.help`)} {t(`${I}.frontageStays`)}
        </p>
        {preview && (
          <>
            <h3 id={previewId} className="m-0 text-sm font-semibold text-foreground">{t(`${I}.previewTitle`)}</h3>
            <ObjectiveValueBuyerPreview buyerView={buyerView} back={back} />
          </>
        )}
      </section>
    </Card>
  );
}
