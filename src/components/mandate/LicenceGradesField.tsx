'use client';

/**
 * @fileoverview **Οι τάξεις μιας άδειας, ανά κατηγορία** (ADR-915 §40.7) — μία γραμμή ανά κατηγορία του `gradeScheme`,
 * με «Δεν δηλώθηκε» ως πρώτη επιλογή.
 * @related config/professional-licences.ts (η ρίζα: κατηγορίες · τάξεις · λέξεις) · ShowcaseLicenceField.tsx (ο γονέας)
 * @module components/mandate/LicenceGradesField
 *
 * 🔑 **Οι γραμμές ΠΑΡΑΓΟΝΤΑΙ από το `gradeScheme`** — νέα κατηγορία ή άδεια με τάξεις = καμία αλλαγή εδώ.
 * 🔑 **«Δεν δηλώθηκε» ≠ «Όχι»** (ADR-798 §7): η κενή επιλογή σβήνει τη δήλωση, δεν ισχυρίζεται ότι λείπει η τάξη.
 * 🔑 `ClearableSelect` (SSoT, ADR-001) — το `''` του Radix είναι δομικά αδύνατο (CHECK 3.48).
 */

import React from 'react';

import { ClearableSelect } from '@/components/ui/clearable-select';
import { SelectItem } from '@/components/ui/select';
import {
  LICENCE_GRADES,
  LICENCE_GRADE_PRESENTATION,
  LICENCE_GRADE_SCOPES,
  LICENCE_GRADE_SCOPE_PRESENTATION,
  isLicenceGrade,
  type LicenceGrade,
  type LicenceGradeScope,
  type LicenceGrades,
  type ProfessionalLicence,
} from '@/config/professional-licences';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { licenceGradeScopes } from '@/lib/professional/licence-grades';

/** ⚠️ Δηλωμένος τύπος, ΟΧΙ `as const satisfies`: ο εξαγωγέας του slice (`key-tables.js`) δεν διαβάζει το δεύτερο. */
const LICENCE_GRADE_FIELD_KEYS: Readonly<Record<'legend' | 'hint' | 'notDeclared', string>> = {
  legend: 'property-market:licences.grades.legend',
  hint: 'property-market:licences.grades.hint',
  notDeclared: 'property-market:licences.grades.notDeclared',
};

const FIELD_NAMESPACES = ['property-market'];

export interface LicenceGradesFieldProps {
  readonly licence: ProfessionalLicence;
  /** Απόν = καμία δήλωση. */
  readonly value: LicenceGrades | undefined;
  readonly onChange: (next: LicenceGrades) => void;
}

/** Νέα τιμή μίας κατηγορίας — η κενή επιλογή **αφαιρεί** το κλειδί (ποτέ `undefined` μέσα στο αντικείμενο). */
function withScopeGrade(grades: LicenceGrades | undefined, scope: LicenceGradeScope, next: string): LicenceGrades {
  const result: Partial<Record<LicenceGradeScope, LicenceGrade>> = {};
  for (const other of LICENCE_GRADE_SCOPES) {
    const grade = grades?.[other];
    if (other !== scope && grade !== undefined) result[other] = grade;
  }
  if (isLicenceGrade(next)) result[scope] = next;
  return result;
}

/** Τίποτα για άδεια χωρίς τάξεις — ο καλών δεν χρειάζεται να ρωτήσει. */
export function LicenceGradesField({ licence, value, onChange }: LicenceGradesFieldProps): React.ReactElement | null {
  const { t } = useTranslation(FIELD_NAMESPACES);
  const scopes = licenceGradeScopes(licence);
  if (scopes.length === 0) return null;
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="text-sm font-medium text-foreground">{t(LICENCE_GRADE_FIELD_KEYS.legend)}</legend>
      <p className="m-0 text-xs text-muted-foreground">{t(LICENCE_GRADE_FIELD_KEYS.hint)}</p>
      <dl className="m-0 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)] sm:items-center">
        {scopes.map((scope) => {
          const id = `licence-${licence}-grade-${scope}`;
          return (
            <React.Fragment key={scope}>
              <dt className="text-sm text-foreground">
                <label htmlFor={id}>{t(LICENCE_GRADE_SCOPE_PRESENTATION[scope].nameKey)}</label>
              </dt>
              <dd className="m-0">
                <ClearableSelect
                  id={id}
                  value={value?.[scope] ?? ''}
                  onValueChange={(next) => onChange(withScopeGrade(value, scope, next))}
                  placeholder={t(LICENCE_GRADE_FIELD_KEYS.notDeclared)}
                  clearLabel={t(LICENCE_GRADE_FIELD_KEYS.notDeclared)}
                  triggerClassName="w-full"
                >
                  {LICENCE_GRADES.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {t(LICENCE_GRADE_PRESENTATION[grade].nameKey)}
                    </SelectItem>
                  ))}
                </ClearableSelect>
              </dd>
            </React.Fragment>
          );
        })}
      </dl>
    </fieldset>
  );
}
