'use client';

/**
 * @fileoverview Εξήγηση προκαταβολής — «γιατί αυτός ο συντελεστής»
 * @description Μετατρέπει τη `PrepaymentBasis` (SSoT: `services/tax/prepayment-policy.ts`) σε πρόταση για
 *   τον άνθρωπο: συντελεστής, αιτία, διάταξη. Χωρίς έναρξη εργασιών → σύνδεσμος στη ρύθμιση, γιατί μια νέα
 *   επιχείρηση μπορεί να δικαιούται μειωμένη προκαταβολή.
 * @see ADR-ACC-009 · ADR-ACC-023 §1 · ADR-ACC-024 §6.1 α
 * @compliance CLAUDE.md — no inline styles, semantic HTML, zero `any`, i18n
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Link } from '@/lib/workspace/navigation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { PrepaymentBasis, PrepaymentReason, PrepaymentReductionRule } from '../../types/tax';

interface PrepaymentBasisNoteProps {
  basis: PrepaymentBasis;
}

/** Κλειδιά i18n της εξήγησης — αιτία × κανόνας, γραμμένα ολόκληρα (στατικά ορατά στις πύλες i18n). */
const EXPLANATION_KEYS: Readonly<Record<PrepaymentReason, Readonly<Record<PrepaymentReductionRule, string>>>> = {
  reduced: {
    natural_person_first_year: 'setup.prepaymentBasis.reducedNaturalPerson',
    legal_entity_first_three_years: 'setup.prepaymentBasis.reducedLegalEntity',
  },
  outside_window: {
    natural_person_first_year: 'setup.prepaymentBasis.outsideWindowNaturalPerson',
    legal_entity_first_three_years: 'setup.prepaymentBasis.outsideWindowLegalEntity',
  },
  continuation: {
    natural_person_first_year: 'setup.prepaymentBasis.continuationNaturalPerson',
    legal_entity_first_three_years: 'setup.prepaymentBasis.continuationLegalEntity',
  },
  missing_start: {
    natural_person_first_year: 'setup.prepaymentBasis.missingStart',
    legal_entity_first_three_years: 'setup.prepaymentBasis.missingStart',
  },
};

export function PrepaymentBasisNote({ basis }: PrepaymentBasisNoteProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  const values = {
    rate: basis.rate,
    baseRate: basis.baseRate,
    startYear: basis.startYear ?? '',
    yearSinceStart: basis.yearSinceStart ?? '',
    windowYears: basis.windowYears,
  };

  return (
    <p className={cn('text-xs', colors.text.muted)}>
      {t(EXPLANATION_KEYS[basis.reason][basis.rule], values)}
      {basis.reason === 'missing_start' && (
        <>
          {' '}
          <Link href="/accounting/setup" className="underline underline-offset-2">
            {t('setup.prepaymentBasis.goToSetup')}
          </Link>
        </>
      )}
    </p>
  );
}
