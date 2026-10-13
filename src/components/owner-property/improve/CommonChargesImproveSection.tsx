'use client';

/**
 * **Η ενότητα «Κοινόχρηστα»** της οθόνης «Βελτίωσε την αγγελία σου» (ADR-777 §8.93 · ADR-842 Φ4).
 * @related `improve-sections.ts` (ο καταχωρητής που την κρεμά) · `DeclaredBlockImproveSection.tsx` (το κοινό κέλυφος:
 *   ουρά, αισιόδοξη επικάλυψη, ένδειξη αποθήκευσης) · `components/shared/common-charges/CommonChargesFields.tsx`
 *   (τα πεδία — τα ίδια με τη φόρμα του γραφείου)
 */

import React from 'react';

import { CommonChargesFields } from '@/components/shared/common-charges/CommonChargesFields';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { applyCommonChargesPatch, readCommonCharges } from '@/lib/common-charges/common-charges';
import type { CommonChargesImproveSubject } from '@/lib/common-charges/common-charges-improve-subject';

import { DeclaredBlockImproveSection } from './DeclaredBlockImproveSection';

const NS = 'objective-value';

export function CommonChargesImproveSection({ subject }: { readonly subject: CommonChargesImproveSubject }) {
  const { t } = useTranslation([NS]);

  return (
    <DeclaredBlockImproveSection
      lead={t(`${NS}:improve.sections.commonCharges.lead`)}
      stored={subject.charges}
      revision={subject.revision}
      write={subject.write}
      read={readCommonCharges}
      apply={applyCommonChargesPatch}
      renderFields={(charges, onChange) => (
        <CommonChargesFields value={charges} onChange={onChange} disabled={false} idPrefix="improve" />
      )}
    />
  );
}
