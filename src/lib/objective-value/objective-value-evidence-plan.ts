/**
 * @fileoverview ADR-949 Α-1 — **ποια έγγραφα, με ποια σειρά**, για ό,τι λείπει από τον υπολογιστή. Καθαρό, χωρίς React.
 * @related `config/objective-value/objective-value-evidence.ts` (τα δεδομένα) · `objective-value-draft.ts`
 *   (`missingOf` — τι λείπει, κατά τη μηχανή) · `components/objective-value/ObjectiveValueEvidenceGuide.tsx` (η οθόνη)
 * @module lib/objective-value/objective-value-evidence-plan
 *
 * 🏆 **Άπληστη κάλυψη συνόλου, όχι λίστα ανά πεδίο** (εκεί σταματούν οι οδηγοί «τι χρειάζεσαι» των φορολογικών και
 *    κτηματομεσιτικών εφαρμογών): πρώτο το έγγραφο που κλείνει τα **περισσότερα** κενά που μένουν· κάθε έγγραφο
 *    εμφανίζεται **μία** φορά, με «καλύπτει: επιφάνεια, όροφο». Ισοπαλία ⇒ πρώτα το έγγραφο όπου **δείξαμε πού**
 *    γράφεται η τιμή (δείγμα), μετά ό,τι ήδη έχετε, ό,τι εκδίδετε μόνοι σας, ό,τι αναζητάτε· τελικά η σειρά του μητρώου.
 * 🔑 **Η μηχανή κρίνει τι λείπει** (`missing`)· εδώ καμία δεύτερη λίστα «τι ρωτάμε».
 */

import {
  OBJECTIVE_VALUE_EVIDENCE,
  OBJECTIVE_VALUE_EVIDENCE_DOCUMENT_SPECS,
  type ObjectiveValueEvidenceDocument,
  type ObjectiveValueEvidenceObtain,
  type ObjectiveValueEvidenceWhereKey,
  type ObjectiveValueNoEvidenceReason,
} from '@/config/objective-value/objective-value-evidence';
import { AUTHORITY_SERVICE_SPECS } from '@/config/document-validity/document-issuers';

import type { ObjectiveValueMissing } from './objective-value-types';

/** Ένα πεδίο που καλύπτει ένα έγγραφο — με το «πού θα το δείτε» όταν το είδαμε σε δείγμα. */
export interface ObjectiveValueEvidenceCoverage {
  readonly field: ObjectiveValueMissing;
  readonly whereKey: ObjectiveValueEvidenceWhereKey | null;
}

export interface ObjectiveValueEvidenceStep {
  readonly document: ObjectiveValueEvidenceDocument;
  readonly obtain: ObjectiveValueEvidenceObtain;
  readonly covers: readonly ObjectiveValueEvidenceCoverage[];
}

export interface ObjectiveValueEvidencePlan {
  readonly steps: readonly ObjectiveValueEvidenceStep[];
  /** Ό,τι κανένα έγγραφο δεν γράφει — ο άνθρωπος το απαντά, και η οθόνη λέει γιατί. */
  readonly selfAnswered: readonly { readonly field: ObjectiveValueMissing; readonly reason: ObjectiveValueNoEvidenceReason }[];
}

/** Μικρότερο = πιο εύκολο: το έχετε ⇒ το εκδίδετε μόνοι σας ⇒ το αναζητάτε σε δημόσιο αρχείο. */
function effortOf(obtain: ObjectiveValueEvidenceObtain): number {
  if (obtain.kind === 'held') return 0;
  return AUTHORITY_SERVICE_SPECS[obtain.service].action === 'issue' ? 1 : 2;
}

/** Ποια έγγραφα καλύπτουν ποια ανοιχτά πεδία — με τη σειρά προτίμησης του μητρώου (πρώτη εμφάνιση). */
function coverageByDocument(
  fields: readonly ObjectiveValueMissing[],
): Map<ObjectiveValueEvidenceDocument, ObjectiveValueEvidenceCoverage[]> {
  const byDocument = new Map<ObjectiveValueEvidenceDocument, ObjectiveValueEvidenceCoverage[]>();
  for (const field of fields) {
    const evidence = OBJECTIVE_VALUE_EVIDENCE[field];
    if (evidence.kind !== 'documents') continue;
    for (const { document, whereKey } of evidence.sources) {
      byDocument.set(document, [...(byDocument.get(document) ?? []), { field, whereKey }]);
    }
  }
  return byDocument;
}

/** Πόσα από τα πεδία που καλύπτει έχουν **αποδεδειγμένη** θέση στο έγγραφο (είδαμε δείγμα). */
function locatedCount(step: ObjectiveValueEvidenceStep): number {
  return step.covers.filter(({ whereKey }) => whereKey !== null).length;
}

/** Λεξικογραφική σύγκριση: κάλυψη ⇒ αποδεδειγμένη θέση ⇒ ευκολία. Αυστηρά καλύτερο, αλλιώς κρατά τη σειρά του μητρώου. */
function isBetter(candidate: ObjectiveValueEvidenceStep, best: ObjectiveValueEvidenceStep | null): boolean {
  if (best === null) return true;
  if (candidate.covers.length !== best.covers.length) return candidate.covers.length > best.covers.length;
  if (locatedCount(candidate) !== locatedCount(best)) return locatedCount(candidate) > locatedCount(best);
  return effortOf(candidate.obtain) < effortOf(best.obtain);
}

/** Το καλύτερο επόμενο έγγραφο για τα πεδία που μένουν — `null` όταν κανένα δεν καλύπτει τίποτα. */
function bestNext(
  coverage: ReadonlyMap<ObjectiveValueEvidenceDocument, readonly ObjectiveValueEvidenceCoverage[]>,
  open: ReadonlySet<ObjectiveValueMissing>,
): ObjectiveValueEvidenceStep | null {
  let best: ObjectiveValueEvidenceStep | null = null;
  for (const [document, all] of coverage) {
    const covers = all.filter(({ field }) => open.has(field));
    if (covers.length === 0) continue;
    const candidate = { document, obtain: OBJECTIVE_VALUE_EVIDENCE_DOCUMENT_SPECS[document], covers };
    if (isBetter(candidate, best)) best = candidate;
  }
  return best;
}

/** Τα έγγραφα για ό,τι λείπει, με σειρά (άπληστη κάλυψη) — κενό `missing` ⇒ κενό πλάνο. */
export function objectiveValueEvidencePlan(missing: readonly ObjectiveValueMissing[]): ObjectiveValueEvidencePlan {
  const fields = [...new Set(missing)];
  const coverage = coverageByDocument(fields);
  const open = new Set(fields.filter((field) => OBJECTIVE_VALUE_EVIDENCE[field].kind === 'documents'));
  const steps: ObjectiveValueEvidenceStep[] = [];
  for (let next = bestNext(coverage, open); next !== null; next = bestNext(coverage, open)) {
    steps.push(next);
    for (const { field } of next.covers) open.delete(field);
  }
  const selfAnswered = fields.flatMap((field) => {
    const evidence = OBJECTIVE_VALUE_EVIDENCE[field];
    return evidence.kind === 'none' ? [{ field, reason: evidence.reason }] : [];
  });
  return { steps, selfAnswered };
}
