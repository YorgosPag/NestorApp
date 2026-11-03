/**
 * @fileoverview **Διακυβέρνηση της βιβλιοθήκης ρητρών** — καθαρή μηχανή καταστάσεων (ADR-928 §5.2.1 · §5.2.2).
 * @module subapps/procurement/subcontracts/clauses/clause-governance
 *
 * ```
 * proposed ──approve──▶ approved ──(νεότερη έγκριση)──▶ superseded
 *    │                     │
 *    ├──reject──▶ rejected └──markReviewed (λογιστής/νομικός, ανεξάρτητος κύκλος)
 *    └──withdraw─▶ rejected (μόνο ο προτείνων)
 * ```
 *
 * 🔑 **Διάκριση καθηκόντων** (Ironclad · DocuSign CLM): ο προτείνων **δεν** εγκρίνει τη δική του πρόταση ή μετάφραση.
 * Το **δικαίωμα** (`manage` / `propose`) το κρίνει το σύνορο της διαδρομής (μητρώο εξουσιοδότησης, CHECK 3.68)· εδώ
 * κρίνεται μόνο ό,τι εξαρτάται από τα **δεδομένα** — κατάσταση και ταυτότητα — ώστε ο ίδιος κριτής να ισχύει παντού.
 */

import type { ClauseTranslation, SubcontractClauseVersion } from '../types/clause';
import type { ClauseLanguage } from '../types/clause-parameter';

/** Γιατί αρνείται μια πράξη — κλειστό σύνολο, ένα HTTP status ανά είδος στον γραφέα. */
export type ClauseGovernanceRefusal = 'invalidTransition' | 'selfApproval' | 'notProposer' | 'translationStale';

type VersionFacts = Pick<SubcontractClauseVersion, 'state' | 'proposedBy' | 'professionalReview' | 'sourceHash'>;

/**
 * Η **μία** διάκριση καθηκόντων: όποιος ζήτησε δεν αποφασίζει. Την ρωτούν η έγκριση έκδοσης, η έγκριση μετάφρασης
 * και η απόφαση απόκλισης συμφωνητικού (Φ2) — ένας κανόνας, όχι τρία αντίγραφα.
 */
export function refuseOwnRequest(requestedBy: string, actorUid: string): 'selfApproval' | null {
  return requestedBy === actorUid ? 'selfApproval' : null;
}

export function refuseApproval(version: VersionFacts, actorUid: string): ClauseGovernanceRefusal | null {
  if (version.state !== 'proposed') return 'invalidTransition';
  return refuseOwnRequest(version.proposedBy, actorUid);
}

export function refuseRejection(version: VersionFacts): ClauseGovernanceRefusal | null {
  return version.state === 'proposed' ? null : 'invalidTransition';
}

/** Απόσυρση: ο **ίδιος** ο προτείνων κλείνει την πρότασή του (ίδια τελική κατάσταση με την απόρριψη). */
export function refuseWithdrawal(version: VersionFacts, actorUid: string): ClauseGovernanceRefusal | null {
  if (version.state !== 'proposed') return 'invalidTransition';
  return version.proposedBy === actorUid ? null : 'notProposer';
}

/** Ο επαγγελματικός έλεγχος σημειώνεται σε **εγκεκριμένη** (ή αντικατεστημένη, για το ιστορικό) έκδοση, μία φορά. */
export function refuseReviewMark(version: VersionFacts): ClauseGovernanceRefusal | null {
  const decided = version.state === 'approved' || version.state === 'superseded';
  return decided && version.professionalReview === 'needs_professional_review' ? null : 'invalidTransition';
}

/** Νέα μετάφραση μόνο σε ζωντανή έκδοση (πρόταση ή εγκεκριμένη) — όχι σε απορριφθείσα ή αντικατεστημένη. */
export function refuseTranslationProposal(version: VersionFacts): ClauseGovernanceRefusal | null {
  return version.state === 'proposed' || version.state === 'approved' ? null : 'invalidTransition';
}

/**
 * Έγκριση μετάφρασης: πρόχειρη, γραμμένη πάνω στο **τρέχον** ελληνικό (`sourceHash`), από άλλον άνθρωπο. Ένα
 * `machine_draft` δεν έχει άνθρωπο-προτείνοντα που να εγκρίνει τον εαυτό του — το εγκρίνει πάντα άνθρωπος.
 */
export function refuseTranslationApproval(
  version: VersionFacts,
  translation: Pick<ClauseTranslation, 'status' | 'sourceHash' | 'proposedBy'>,
  actorUid: string,
): ClauseGovernanceRefusal | null {
  if (refuseTranslationProposal(version) !== null || translation.status !== 'draft') return 'invalidTransition';
  if (translation.sourceHash !== version.sourceHash) return 'translationStale';
  return refuseOwnRequest(translation.proposedBy, actorUid);
}

/**
 * Οι μεταφράσεις που **κληρονομεί** μια νέα έκδοση. Αν το ελληνικό σώμα δεν άλλαξε (π.χ. άλλαξαν μόνο ζώνες),
 * μένουν όπως ήταν. Αν άλλαξε, η εγκεκριμένη μετάφραση **υποβιβάζεται σε πρόχειρο** και κρατά το παλιό `sourceHash`,
 * άρα δεν εγκρίνεται ξανά χωρίς νέα μετάφραση. Η δουλειά δεν χάνεται, και το δίγλωσσο έγγραφο μπλοκάρεται.
 */
export function carriedTranslations(
  previous: Readonly<Record<ClauseLanguage, ClauseTranslation>>,
  nextSourceHash: string,
): Readonly<Record<ClauseLanguage, ClauseTranslation>> {
  const carried: Record<ClauseLanguage, ClauseTranslation> = {};
  for (const [language, translation] of Object.entries(previous)) {
    carried[language] = translation.sourceHash === nextSourceHash
      ? translation
      : { ...translation, status: 'draft', approvedBy: null, approvedAt: null };
  }
  return carried;
}
