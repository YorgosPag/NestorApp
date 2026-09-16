/**
 * @fileoverview **ΤΙ ΔΙΑΒΑΣΕ Ο ΑΝΘΡΩΠΟΣ** — έκδοση, δηλώσεις και τιμές, κριμένα πριν γραφτεί συναίνεση.
 * @related ADR-864 §7 Α8/Α8α/Α8β · ADR-861 §7 · lib/legal/legal-document-versions.ts
 * @module lib/mandate/private-marketing-consent-text
 *
 * 🔑 **CAS πάνω στο κείμενο, όχι «πάρε την τελευταία»**: η οθόνη στέλνει **ποια** έκδοση και
 * **ποιες** τιμές έδειξε· ο διακομιστής ξαναϋπολογίζει και αρνείται αν διαφέρουν. Χωρίς αυτό, μια
 * έκδοση που πάγωσε ανάμεσα στο «διάβασα» και στο «συμφωνώ» θα καταγραφόταν ως διαβασμένη.
 */

import type { LegalDocumentLocale } from '@/constants/legal-documents';
import { latestLegalDocumentVersion } from '@/lib/legal/legal-document-versions';
import { clauseIdsOf } from '@/lib/legal/legal-clauses';
import { formatTermDay } from '@/lib/mandate/mandate-term-window';
import {
  PRIVATE_MARKETING_DOCUMENT,
  type ConsentPlaceholderValues,
  type ConsentTextRef,
} from '@/types/private-marketing-consent';

/** Ό,τι στέλνει η οθόνη μαζί με το «συμφωνώ». */
export interface ConsentSubmission {
  readonly version: number;
  readonly acknowledged: readonly string[];
  readonly locale: LegalDocumentLocale;
  readonly values: ConsentPlaceholderValues;
}

type ConsentTextVerdict =
  | {
      readonly kind: 'accepted';
      readonly text: ConsentTextRef;
      /** Οι δηλώσεις **της έκδοσης** — ό,τι καταγράφεται, ποτέ άγνωστα ids από το δίκτυο. */
      readonly acknowledged: readonly string[];
    }
  | { readonly kind: 'refused'; readonly reason: 'consent-text-superseded' | 'consent-incomplete' };

/** Οι τιμές θέσεων για **αυτή** την εντολή — μία διατύπωση για οθόνη και διακομιστή. */
export function consentValuesFor(agencyName: string, mandateExpiresAt: string): ConsentPlaceholderValues {
  return { agency: agencyName, expiresOn: formatTermDay(mandateExpiresAt) };
}

function sameValues(a: ConsentPlaceholderValues, b: ConsentPlaceholderValues): boolean {
  return a.agency === b.agency && a.expiresOn === b.expiresOn;
}

/**
 * **Δέχεται το κείμενο;**
 *
 * - άλλη έκδοση **ή** άλλες τιμές από αυτές που ισχύουν τώρα ⇒ `consent-text-superseded` (Α8α)
 * - λείπει έστω μία δήλωση ⇒ `consent-incomplete` (Α8β) — άγνωστα ids **δεν** αναπληρώνουν
 */
export function consentTextVerdict(
  submission: ConsentSubmission,
  expectedValues: ConsentPlaceholderValues,
): ConsentTextVerdict {
  const latest = latestLegalDocumentVersion(PRIVATE_MARKETING_DOCUMENT);
  if (latest.kind === 'absent') return { kind: 'refused', reason: 'consent-text-superseded' };

  const { frozen, digest } = latest.version;
  if (submission.version !== frozen.version || !sameValues(submission.values, expectedValues)) {
    return { kind: 'refused', reason: 'consent-text-superseded' };
  }

  const acknowledged = new Set(submission.acknowledged);
  const required = clauseIdsOf(frozen);
  if (!required.every((id) => acknowledged.has(id))) {
    return { kind: 'refused', reason: 'consent-incomplete' };
  }

  return {
    kind: 'accepted',
    text: { document: PRIVATE_MARKETING_DOCUMENT, version: frozen.version, digest },
    acknowledged: required,
  };
}
