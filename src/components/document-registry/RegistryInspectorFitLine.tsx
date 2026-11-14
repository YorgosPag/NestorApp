'use client';

/**
 * @fileoverview ADR-915 §40.7 Φ3 — **«καλύπτει η τάξη του αυτό το ακίνητο;»** δίπλα στον επαγγελματία της ανάθεσης και σε
 *   κάθε υποψήφιο «Σε γνωστό».
 * @related lib/document-validity/inspector-coverage.ts (η κρίση) · registry-issuance.ts (`inspectorFit` της γραμμής) ·
 *   components/contacts/ContactLicenceRegistryCheck.tsx (ο έλεγχος στο μητρώο, στην κάρτα της επαφής)
 * @module components/document-registry/RegistryInspectorFitLine
 *
 * 🔑 **Προειδοποίηση, ποτέ μπλοκ**: καμία επιλογή δεν κλειδώνει — η κάρτα λέει **τι** δεν ταιριάζει και **με ποιο** εμβαδόν.
 * 🔑 **Ποιος το λέει**: «κατά το μητρώο (έλεγχος …)» ή «κατά δήλωση» — ποτέ υπαινιγμός επαλήθευσης που δεν έγινε.
 * 🔑 Η προειδοποίηση φέρει **εικονίδιο και λέξεις**, όχι μόνο χρώμα (CHECK 3.41).
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

import type { DocumentKind } from '@/config/document-validity/document-validity';
import {
  LICENCE_GRADE_PRESENTATION,
  LICENCE_GRADE_SCOPE_PRESENTATION,
  REGISTRY_CHECK_FRESH_DAYS,
} from '@/config/professional-licences';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { issuanceGradeRequirementOf, type InspectorFit } from '@/lib/document-validity/inspector-coverage';
import { formatDate } from '@/lib/intl-formatting';
import { displayAreaLabel } from '@/lib/properties/display-area-label';
import { PROPERTY_MARKET_NS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { INSPECTOR_FIT_KEYS } from '@/components/document-registry/issuance-labels';

type Translate = ReturnType<typeof useTranslation>['t'];

/** Η φράση της κρίσης — `scope` = «Κτίρια», ήδη μεταφρασμένο. */
function coverageText(t: Translate, scope: string, coverage: InspectorFit['coverage']): string {
  const grade = (value: keyof typeof LICENCE_GRADE_PRESENTATION) => t(LICENCE_GRADE_PRESENTATION[value].nameKey);
  const sqm = (value: number, kind: 'gross' | 'net' | 'unspecified') => displayAreaLabel(t, { value, kind });
  switch (coverage.kind) {
    case 'covers':
      return t(INSPECTOR_FIT_KEYS.covers, { scope, grade: grade(coverage.grade) });
    case 'exceeds':
      return t(INSPECTOR_FIT_KEYS.exceeds, {
        scope, grade: grade(coverage.grade), max: sqm(coverage.maxAreaSqm, 'unspecified'), area: sqm(coverage.areaSqm, coverage.basis),
      });
    case 'area-unknown':
      return t(INSPECTOR_FIT_KEYS.areaUnknown, { scope, grade: grade(coverage.grade), max: sqm(coverage.maxAreaSqm, 'unspecified') });
    case 'not-graded':
      return t(INSPECTOR_FIT_KEYS.notGraded, { scope });
    case 'grade-unknown':
      return t(INSPECTOR_FIT_KEYS.gradeUnknown, { scope });
    case 'not-judged':
      return t(INSPECTOR_FIT_KEYS.gradeOnly, { scope, grade: grade(coverage.grade) });
  }
}

/** «Κατά το μητρώο (έλεγχος …)» · «Κατά δήλωση» · τίποτα όταν δεν υπάρχει καμία πηγή. */
function sourceText(t: Translate, fit: InspectorFit): string | null {
  if (fit.source === 'registry' && fit.checkedAt !== null) return t(INSPECTOR_FIT_KEYS.sourceRegistry, { date: formatDate(fit.checkedAt) });
  return fit.source === 'declared' ? t(INSPECTOR_FIT_KEYS.sourceDeclared) : null;
}

export interface InspectorFitLineProps {
  readonly kind: DocumentKind;
  /** `undefined` = η γραμμή δεν κρίνει αυτή την επαφή (κανένα όριο τάξης για το είδος · επαφή εκτός μισθωτή). */
  readonly fit: InspectorFit | undefined;
}

export function InspectorFitLine({ kind, fit }: InspectorFitLineProps): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS, PROPERTY_MARKET_NS, 'common']);
  const requirement = issuanceGradeRequirementOf(kind);
  if (fit === undefined || requirement === null) return null;
  const scope = t(LICENCE_GRADE_SCOPE_PRESENTATION[requirement.scope].nameKey);
  const warn = fit.coverage.kind === 'exceeds' || fit.coverage.kind === 'not-graded';
  const source = sourceText(t, fit);
  return (
    <span className="flex flex-col text-xs">
      <span className={warn ? 'inline-flex items-start gap-1 font-medium text-foreground' : 'text-muted-foreground'}>
        {warn ? <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" /> : null}
        <span>{coverageText(t, scope, fit.coverage)}</span>
      </span>
      {source === null ? null : <span className="text-muted-foreground">{source}</span>}
      {fit.recheckSuggested ? <span className="text-muted-foreground">{t(INSPECTOR_FIT_KEYS.recheck, { days: REGISTRY_CHECK_FRESH_DAYS })}</span> : null}
    </span>
  );
}
