'use client';

/**
 * @fileoverview **«Έλεγχος στο μητρώο»** μέσα στο μπλοκ της άδειας της επαφής (ADR-915 §40.7 Φ2).
 * @module components/contacts/ContactLicenceRegistryCheck
 *
 * 🏆 Πρακτική Angi/Houzz: «Verified license» **με ημερομηνία**, από την πρωτογενή πηγή. Πιο έξυπνα εδώ:
 *    - οι τάξεις της **αρχής** δείχνονται ανά κατηγορία, και σημαίνεται ρητά όπου **διαφέρουν από τη δήλωση**·
 *    - η **ηλικία** του ελέγχου φαίνεται όταν περάσει το `REGISTRY_CHECK_FRESH_DAYS` (ποτέ αυτόματος επανέλεγχος)·
 *    - κάθε αποτυχία λέει **τι** απέτυχε (δεν βρέθηκε · άλλο επώνυμο · άλλαξε η σελίδα · δεν απάντησε) — ποτέ σιωπή.
 * 🔑 Κλειστός ο αυτόματος έλεγχος (διακόπτης) ⇒ **κανένα** κουμπί· μένει ο σύνδεσμος χειροκίνητης αναζήτησης από πάνω.
 * 🔑 Μόνο για **αποθηκευμένη** άδεια **αποθηκευμένης** επαφής: ο server ελέγχει τον αριθμό που κρατά η βάση, όχι τη φόρμα.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import {
  LICENCE_GRADE_PRESENTATION,
  LICENCE_GRADE_SCOPE_PRESENTATION,
  REGISTRY_CHECK_FRESH_DAYS,
  REGISTRY_SCOPE_NONE_PRESENTATION,
} from '@/config/professional-licences';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { daysSinceOrNull } from '@/lib/date-local';
import { formatDate } from '@/lib/intl-formatting';
import { licenceGradeScopes } from '@/lib/professional/licence-grades';
import type { ContactLicence } from '@/types/contacts/contact-licences';
import type {
  RegistryCheckAttempt,
  RegistryCheckJudgment,
  RegistryGrades,
  RegistryScopeAnswer,
} from '@/types/professional-registry-check';

import { CONTACT_LICENCE_REGISTRY_ATTEMPT_KEYS, CONTACT_LICENCE_REGISTRY_KEYS as KEYS } from './contact-licence-labels';
import { useLicenceRegistryCheck } from './useLicenceRegistryCheck';

const NAMESPACES = ['contacts-form', 'property-market'];

type Translate = ReturnType<typeof useTranslation>['t'];

/** Η λέξη της απάντησης — `t(TABLE[x].nameKey)`, ώστε ο εξαγωγέας του slice να τη λύνει στατικά (CHECK 3.34). */
function answerWord(answer: RegistryScopeAnswer, t: Translate): string {
  return answer === 'none' ? t(REGISTRY_SCOPE_NONE_PRESENTATION.nameKey) : t(LICENCE_GRADE_PRESENTATION[answer].nameKey);
}

/** «Κτίρια: Α΄ τάξη · Συστήματα θέρμανσης: Όχι · …» — με τη σειρά της ρίζας. */
function gradesLine(held: ContactLicence, grades: RegistryGrades, t: Translate): string {
  return licenceGradeScopes(held.licence)
    .map((scope) => t(KEYS.gradeEntry, { scope: t(LICENCE_GRADE_SCOPE_PRESENTATION[scope].nameKey), grade: answerWord(grades[scope], t) }))
    .join(' · ');
}

/** Η δήλωση λέει άλλη τάξη από την αρχή; Μόνο οι **δηλωμένες** κατηγορίες μετρούν (η σιωπή δεν διαφωνεί). */
function differsFromDeclared(held: ContactLicence, grades: RegistryGrades): boolean {
  return licenceGradeScopes(held.licence).some((scope) => held.grades?.[scope] !== undefined && held.grades[scope] !== grades[scope]);
}

type AttemptLine = keyof typeof CONTACT_LICENCE_REGISTRY_ATTEMPT_KEYS;

/** Η γραμμή της τελευταίας ερώτησης — `null` όταν έφερε γνώση ή δεν έγινε. */
function attemptLineOf(attempt: RegistryCheckAttempt): AttemptLine | null {
  if (attempt.kind === 'not-asked' || attempt.kind === 'asked') return null;
  return attempt.kind === 'unavailable' ? `unavailable-${attempt.reason}` : attempt.kind;
}

function VerifiedLines({ held, judgment, t }: { readonly held: ContactLicence; readonly judgment: Extract<RegistryCheckJudgment, { state: 'verified' }>; readonly t: Translate }) {
  const age = daysSinceOrNull(judgment.checkedAt);
  return (
    <>
      <p className="m-0 text-xs font-medium text-foreground">{t(KEYS.verified, { date: formatDate(judgment.checkedAt) })}</p>
      <p className="m-0 text-xs text-foreground">{gradesLine(held, judgment.grades, t)}</p>
      {differsFromDeclared(held, judgment.grades) && <p className="m-0 text-xs text-muted-foreground">{t(KEYS.differsFromDeclared)}</p>}
      {age !== null && age > REGISTRY_CHECK_FRESH_DAYS && <p className="m-0 text-xs text-muted-foreground">{t(KEYS.aged, { days: age })}</p>}
    </>
  );
}

function JudgmentLines({ held, judgment, t }: { readonly held: ContactLicence; readonly judgment: RegistryCheckJudgment; readonly t: Translate }) {
  switch (judgment.state) {
    case 'verified':
      return <VerifiedLines held={held} judgment={judgment} t={t} />;
    case 'name-mismatch':
      return <p className="m-0 text-xs text-foreground">{t(KEYS.nameMismatch, { date: formatDate(judgment.checkedAt) })}</p>;
    case 'stale-number':
      return <p className="m-0 text-xs text-muted-foreground">{t(KEYS.staleNumber)}</p>;
    case 'not-checked':
      return <p className="m-0 text-xs text-muted-foreground">{t(KEYS.notChecked)}</p>;
  }
}

export function ContactLicenceRegistryCheck({ contactId, held }: { readonly contactId: string; readonly held: ContactLicence }) {
  const { t } = useTranslation(NAMESPACES);
  const { state, checking, check } = useLicenceRegistryCheck(contactId, held.licence, held.attestation.registration.number);
  if (state.kind === 'loading') return null;
  if (state.kind === 'failed') return <p className="m-0 text-xs text-muted-foreground" role="status">{t(KEYS.failed)}</p>;
  const { report } = state;
  // Κλειστός ο αυτόματος έλεγχος και τίποτα αποθηκευμένο ⇒ σιωπή: ο σύνδεσμος του μητρώου είναι ήδη από πάνω.
  if (!report.lookupEnabled && report.judgment.state === 'not-checked') return null;
  const attempt = attemptLineOf(report.attempt);
  return (
    <section className="flex flex-col gap-1" aria-label={t(KEYS.region)}>
      <JudgmentLines held={held} judgment={report.judgment} t={t} />
      {attempt !== null && (
        <p className="m-0 text-xs text-foreground" role="status">{t(CONTACT_LICENCE_REGISTRY_ATTEMPT_KEYS[attempt])}</p>
      )}
      {report.lookupEnabled && (
        <Button type="button" variant="outline" size="sm" className="self-start" disabled={checking} onClick={() => void check()}>
          {checking ? t(KEYS.checking) : report.judgment.state === 'not-checked' ? t(KEYS.check) : t(KEYS.recheck)}
        </Button>
      )}
    </section>
  );
}
