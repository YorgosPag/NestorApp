'use client';

/**
 * @fileoverview Εξήγηση κάλυψης διανομής — «γιατί ο φόρος διανομής δεν υπολογίζεται / είναι μερικός»
 * @description Μετατρέπει τη `DistributionCoverage` (SSoT: `services/engines/helpers/entity-tax.ts`) σε
 *   πρόταση για τον άνθρωπο, με σύνδεσμο εκεί όπου διορθώνεται. Πλήρης κάλυψη ⇒ τίποτα (σιωπή = όλα καλά).
 *   Ίδιο δόγμα με την `PrepaymentBasisNote`: ένα ποσό χωρίς τη βάση του δεν είναι επαγγελματική αναφορά.
 * @see ADR-ACC-009 · ADR-ACC-012 · ADR-ACC-014 · ADR-ACC-016
 * @compliance CLAUDE.md — no inline styles, semantic HTML, zero `any`, i18n
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { DistributionCoverage, LegalEntityType } from '../../types/tax';
import { SetupLink } from './SetupLink';

interface DistributionCoverageNoteProps {
  readonly entityType: LegalEntityType;
  readonly coverage: DistributionCoverage;
}

/** Κλειδιά ανά μορφή — γραμμένα ολόκληρα (στατικά ορατά στις πύλες i18n). */
const NONE_KEYS: Readonly<Record<LegalEntityType, string>> = {
  oe: 'setup.distributionCoverage.noneOE',
  epe: 'setup.distributionCoverage.noneEPE',
  ae: 'setup.distributionCoverage.noneAE',
};

const ADD_HOLDERS_KEYS: Readonly<Record<LegalEntityType, string>> = {
  oe: 'setup.distributionCoverage.addPartners',
  epe: 'setup.distributionCoverage.addMembers',
  ae: 'setup.distributionCoverage.addShareholders',
};

export function DistributionCoverageNote({ entityType, coverage }: DistributionCoverageNoteProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  if (coverage.status === 'complete') return null;

  const isNone = coverage.status === 'none';
  const declared = formatNumber(coverage.declaredPercent, { maximumFractionDigits: 2 });

  return (
    <p className={cn('mt-2 text-xs', colors.text.muted)}>
      {isNone ? t(NONE_KEYS[entityType]) : t('setup.distributionCoverage.partial', { declared })}
      <SetupLink>{isNone ? t(ADD_HOLDERS_KEYS[entityType]) : t('setup.distributionCoverage.fixShares')}</SetupLink>
    </p>
  );
}
