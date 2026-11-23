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

/** Ένα έγγραφο και ό,τι καλύπτει από τα ανοιχτά πεδία. */
export interface ObjectiveValueEvidenceOption {
  readonly document: ObjectiveValueEvidenceDocument;
  readonly obtain: ObjectiveValueEvidenceObtain;
  readonly covers: readonly ObjectiveValueEvidenceCoverage[];
}

/**
 * Βήμα του οδηγού. `alternatives` (ADR-949 §11.8): έγγραφα που **δεν** έγιναν βήμα αλλά καλύπτουν **όλα** τα πεδία του
 * βήματος, με αποδεδειγμένη θέση για καθένα — «ή αλλιώς». Χωρίς αυτά, η άπληστη κάλυψη έκρυβε κάθε ισοδύναμο έγγραφο
 * (η πράξη ΕΝΦΙΑ, ίδια πεδία με το Ε9, δεν εμφανιζόταν ποτέ ⇒ ο αναγνώστης της ήταν απρόσιτος — ζωντανός έλεγχος Α-3).
 */
export interface ObjectiveValueEvidenceStep extends ObjectiveValueEvidenceOption {
  readonly alternatives: readonly ObjectiveValueEvidenceOption[];
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
function locatedCount(step: ObjectiveValueEvidenceOption): number {
  return step.covers.filter(({ whereKey }) => whereKey !== null).length;
}

/** Λεξικογραφική σύγκριση: κάλυψη ⇒ αποδεδειγμένη θέση ⇒ ευκολία. Αυστηρά καλύτερο, αλλιώς κρατά τη σειρά του μητρώου. */
function isBetter(candidate: ObjectiveValueEvidenceOption, best: ObjectiveValueEvidenceOption | null): boolean {
  if (best === null) return true;
  if (candidate.covers.length !== best.covers.length) return candidate.covers.length > best.covers.length;
  if (locatedCount(candidate) !== locatedCount(best)) return locatedCount(candidate) > locatedCount(best);
  return effortOf(candidate.obtain) < effortOf(best.obtain);
}

/** Το καλύτερο επόμενο έγγραφο για τα πεδία που μένουν — `null` όταν κανένα δεν καλύπτει τίποτα. */
function bestNext(
  coverage: ReadonlyMap<ObjectiveValueEvidenceDocument, readonly ObjectiveValueEvidenceCoverage[]>,
  open: ReadonlySet<ObjectiveValueMissing>,
): ObjectiveValueEvidenceOption | null {
  let best: ObjectiveValueEvidenceOption | null = null;
  for (const [document, all] of coverage) {
    const covers = all.filter(({ field }) => open.has(field));
    if (covers.length === 0) continue;
    const candidate = { document, obtain: OBJECTIVE_VALUE_EVIDENCE_DOCUMENT_SPECS[document], covers };
    if (isBetter(candidate, best)) best = candidate;
  }
  return best;
}

/**
 * Τα ισοδύναμα ενός βήματος: έγγραφα εκτός πλάνου που καλύπτουν **όλα** τα πεδία του, με αποδεδειγμένη θέση για καθένα
 * («μόνο ό,τι αποδείχθηκε» — ένα έγγραφο χωρίς `whereKey` δεν υπόσχεται πού). Σειρά = σειρά του μητρώου.
 */
function alternativesOf(
  step: ObjectiveValueEvidenceOption,
  coverage: ReadonlyMap<ObjectiveValueEvidenceDocument, readonly ObjectiveValueEvidenceCoverage[]>,
  planned: ReadonlySet<ObjectiveValueEvidenceDocument>,
): ObjectiveValueEvidenceOption[] {
  const stepFields = new Set(step.covers.map(({ field }) => field));
  const alternatives: ObjectiveValueEvidenceOption[] = [];
  for (const [document, all] of coverage) {
    if (planned.has(document)) continue;
    const covers = all.filter(({ field }) => stepFields.has(field));
    if (covers.length !== stepFields.size || covers.some(({ whereKey }) => whereKey === null)) continue;
    alternatives.push({ document, obtain: OBJECTIVE_VALUE_EVIDENCE_DOCUMENT_SPECS[document], covers });
  }
  return alternatives;
}

/** Τα έγγραφα για ό,τι λείπει, με σειρά (άπληστη κάλυψη) και τα ισοδύναμά τους — κενό `missing` ⇒ κενό πλάνο. */
export function objectiveValueEvidencePlan(missing: readonly ObjectiveValueMissing[]): ObjectiveValueEvidencePlan {
  const fields = [...new Set(missing)];
  const coverage = coverageByDocument(fields);
  const open = new Set(fields.filter((field) => OBJECTIVE_VALUE_EVIDENCE[field].kind === 'documents'));
  const chosen: ObjectiveValueEvidenceOption[] = [];
  for (let next = bestNext(coverage, open); next !== null; next = bestNext(coverage, open)) {
    chosen.push(next);
    for (const { field } of next.covers) open.delete(field);
  }
  const planned = new Set(chosen.map(({ document }) => document));
  const steps = chosen.map((option) => ({ ...option, alternatives: alternativesOf(option, coverage, planned) }));
  const selfAnswered = fields.flatMap((field) => {
    const evidence = OBJECTIVE_VALUE_EVIDENCE[field];
    return evidence.kind === 'none' ? [{ field, reason: evidence.reason }] : [];
  });
  return { steps, selfAnswered };
}
