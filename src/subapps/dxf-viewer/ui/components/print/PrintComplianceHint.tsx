'use client';

/**
 * ADR-651 Φάση Ε (Απόφαση #4) — «τι λείπει για την κατάθεση», μέσα στον **υπάρχοντα** διάλογο
 * εκτύπωσης.
 *
 * **Προειδοποίηση, όχι φράγμα**: το κουμπί «Εκτύπωση» δεν απενεργοποιείται ποτέ — ένα πρόχειρο
 * τυπώνεται ελεύθερα. Ο μηχανικός απλώς δεν καταθέτει πια ελλιπές σχέδιο **χωρίς να το ξέρει**
 * (στην Ελλάδα = απόρριψη από την πολεοδομία).
 *
 * Ο έλεγχος τρέχει με **ακριβώς** ό,τι θα τυπωθεί: το ενεργό preset, τα πραγματικά δεδομένα
 * έργου/μελετητή και την κλίμακα που ΟΝΤΩΣ τυπώνεται (fit-to-page ⇒ `—` ⇒ «λείπει κλίμακα»),
 * μέσω των **ίδιων** SSoT που χρησιμοποιεί το `print-service` (`resolveAppliedScaleDenominator`
 * / `formatScaleText`) — καμία δεύτερη αλήθεια.
 *
 * @see ../../../text-engine/title-block/title-block-compliance.ts — ο κανόνας (καθαρή συνάρτηση)
 * @see ../../../print/print-service.ts — ο ίδιος υπολογισμός κλίμακας
 */

import * as React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  formatScaleText,
  resolveAppliedScaleDenominator,
} from '../../../print/config/paper-math';
import type { PrintFitMode } from '../../../print/config/paper-types';
import { validateActiveTitleBlock } from '../../../text-engine/title-block/active-title-block';
import { issueLabelKeys } from '../../../text-engine/title-block/title-block-compliance';
import { toTitleBlockLocale } from '../../../text-engine/title-block/title-block-presets';

export interface PrintComplianceHintProps {
  /** Χωρίς πινακίδα στο φύλλο δεν υπάρχει τίποτα να ελεγχθεί. */
  readonly includeTitleBlock: boolean;
  readonly fitMode: PrintFitMode;
  readonly scaleDenominator: number;
}

export function PrintComplianceHint({
  includeTitleBlock,
  fitMode,
  scaleDenominator,
}: PrintComplianceHintProps): React.JSX.Element | null {
  const { t, i18n } = useTranslation('dxf-viewer-shell');

  const issues = React.useMemo(() => {
    if (!includeTitleBlock) return [];
    const scaleName = formatScaleText(
      resolveAppliedScaleDenominator(fitMode, scaleDenominator),
    );
    return validateActiveTitleBlock(toTitleBlockLocale(i18n.language), { scaleName });
  }, [includeTitleBlock, fitMode, scaleDenominator, i18n.language]);

  if (issues.length === 0) return null;

  const emptyValues = issueLabelKeys(issues, 'empty-value').map((key) => t(key));
  const absentFields = issueLabelKeys(issues, 'absent-field').map((key) => t(key));
  const noStampImage = issues.some((issue) => issue.kind === 'no-stamp-image');

  return (
    <section aria-live="polite" className="rounded-md border border-warning-border bg-warning-bg p-3">
      <h4 className="text-sm font-medium">{t('print.titleBlock.compliance.title')}</h4>
      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {emptyValues.length > 0 && (
          <li>{t('print.titleBlock.compliance.emptyValues', { fields: emptyValues.join(', ') })}</li>
        )}
        {absentFields.length > 0 && (
          <li>
            {t('print.titleBlock.compliance.absentFields', { fields: absentFields.join(', ') })}
          </li>
        )}
        {noStampImage && <li>{t('print.titleBlock.compliance.noStampImage')}</li>}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        {t('print.titleBlock.compliance.footer')}
      </p>
    </section>
  );
}
