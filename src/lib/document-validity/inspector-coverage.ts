/**
 * @fileoverview ADR-915 §40.7 Φ3 — **ΚΑΛΥΠΤΕΙ Η ΤΑΞΗ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ ΑΥΤΟ ΤΟ ΑΚΙΝΗΤΟ;** — καθαρός κριτής.
 * @related config/professional-licences.ts (`gradeScheme.entitlements` — τα όρια, η ΜΟΝΗ ρίζα) ·
 *   config/document-validity/document-issuers.ts (`licenceGradeScope` — ποια κατηγορία κρίνει ποιο έγγραφο) ·
 *   lib/properties/property-display-area.ts (`resolveGrossBasisArea` — «με τι συγκρίνω») ·
 *   lib/professional/registry-check-judgment.ts (`licenceStandingOf` — αρχή πάνω από δήλωση)
 * @module lib/document-validity/inspector-coverage
 *
 * 🔑 **Προειδοποίηση, ποτέ μπλοκ**: η νομική ευθύνη είναι του επιθεωρητή, και το εμβαδόν της βάσης μπορεί να είναι λάθος.
 * 🔑 **Η άγνοια λέγεται άγνοια**: άγνωστη τάξη ή άγνωστο εμβαδόν ⇒ ονομασμένο «δεν κρίνεται», **ποτέ** «ακατάλληλος».
 * 🔑 **Μικτό ως βάση** (ADR-777 §8.100): ο νόμος λέει «συνολική επιφάνεια» χωρίς να ορίζει μικτή/ωφέλιμη (έρευνα
 *    2026-11-15 — ανοιχτό, ADR-915 §40.7 Φ3). Το μικτό είναι ≥ καθαρό ⇒ «καλύπτει» με μικτό είναι **βέβαιο**· «ξεπερνά»
 *    με μικτό είναι **προειδοποίηση**. Ένα **καθαρό** πάνω από το όριο ξεπερνά με **κάθε** ανάγνωση ⇒ κρίνεται πρώτο.
 * 🔑 Τάξη χωρίς όριο εμβαδού (Β΄) καλύπτει **και** με άγνωστο εμβαδόν — η πληροφορία δεν χρειάζεται.
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import { ISSUER_QUALIFICATION_SPECS } from '@/config/document-validity/document-issuers';
import { documentKindSpec, type DocumentKind } from '@/config/document-validity/document-validity';
import {
  PROFESSIONAL_LICENCE_SPECS,
  REGISTRY_CHECK_FRESH_DAYS,
  type LicenceGrade,
  type LicenceGradeEntitlement,
  type LicenceGradeScope,
  type ProfessionalLicence,
} from '@/config/professional-licences';
import { daysSinceOrNull } from '@/lib/date-local';
import type { GrossBasisArea, GrossBasisAreaKind } from '@/lib/properties/property-display-area';
import type { LicenceStanding, RegistryScopeAnswer } from '@/types/professional-registry-check';

/** Ποια άδεια και ποια κατηγορία της κρίνουν την έκδοση ενός είδους εγγράφου. */
export interface IssuanceGradeRequirement {
  readonly licence: ProfessionalLicence;
  readonly scope: LicenceGradeScope;
}

/**
 * Η απαίτηση τάξης ενός είδους — από τα **δεδομένα** του εκδότη: η πρώτη άδεια-προσόν που έχει όρια στην κατηγορία
 * `licenceGradeScope`. `null` = καμία τάξη δεν περιορίζει την έκδοση ⇒ η οθόνη δεν λέει τίποτα.
 */
export function issuanceGradeRequirementOf(kind: DocumentKind): IssuanceGradeRequirement | null {
  const { issuer } = documentKindSpec(kind);
  if (issuer.kind !== 'professional' || issuer.licenceGradeScope === null) return null;
  const scope = issuer.licenceGradeScope;
  for (const qualification of issuer.qualifications) {
    const spec = ISSUER_QUALIFICATION_SPECS[qualification];
    if (spec.kind === 'licence' && PROFESSIONAL_LICENCE_SPECS[spec.licence].gradeScheme?.entitlements[scope] !== undefined) {
      return { licence: spec.licence, scope };
    }
  }
  return null;
}

/** Ό,τι ξέρουμε για το εμβαδόν του ακινήτου: η βάση σύγκρισης (μικτό · παλιό) και, χωριστά, το καθαρό. */
export interface PropertyAreaEvidence {
  readonly gross: GrossBasisArea | null;
  readonly netSqm: number | null;
}

export const NO_AREA_EVIDENCE: PropertyAreaEvidence = { gross: null, netSqm: null };

/**
 * **Η κρίση.**
 * - `covers` — η τάξη επιτρέπει την έκδοση (χωρίς όριο, ή εμβαδόν-βάση έως και το όριο).
 * - `exceeds` — το εμβαδόν ξεπερνά το όριο της τάξης· `basis` λέει **ποιο** εμβαδόν (καθαρό ⇒ βέβαιο).
 * - `area-unknown` — η τάξη έχει όριο, αλλά το μικτό του ακινήτου δεν είναι γνωστό.
 * - `not-graded` — η **αρχή** απάντησε «Όχι» για αυτή την κατηγορία.
 * - `grade-unknown` — καμία τάξη γνωστή (δεν δηλώθηκε, δεν ελέγχθηκε, ή η επαφή δεν έχει την άδεια).
 * - `not-judged` — το όριο της τάξης δεν κρίνεται με εμβαδόν (π.χ. ισχύς kW).
 */
export type GradeCoverage =
  | { readonly kind: 'covers'; readonly grade: LicenceGrade }
  | {
      readonly kind: 'exceeds';
      readonly grade: LicenceGrade;
      readonly maxAreaSqm: number;
      readonly areaSqm: number;
      readonly basis: GrossBasisAreaKind | 'net';
    }
  | { readonly kind: 'area-unknown'; readonly grade: LicenceGrade; readonly maxAreaSqm: number }
  | { readonly kind: 'not-graded' }
  | { readonly kind: 'grade-unknown' }
  | { readonly kind: 'not-judged'; readonly grade: LicenceGrade };

function areaCapCoverage(grade: LicenceGrade, maxAreaSqm: number, area: PropertyAreaEvidence): GradeCoverage {
  if (area.netSqm !== null && area.netSqm > maxAreaSqm) {
    return { kind: 'exceeds', grade, maxAreaSqm, areaSqm: area.netSqm, basis: 'net' };
  }
  if (area.gross === null) return { kind: 'area-unknown', grade, maxAreaSqm };
  if (area.gross.value <= maxAreaSqm) return { kind: 'covers', grade };
  return { kind: 'exceeds', grade, maxAreaSqm, areaSqm: area.gross.value, basis: area.gross.kind };
}

/** Η κρίση **μίας** απάντησης (τάξη · «Όχι» · άγνωστη) απέναντι στα όρια της κατηγορίας. */
export function gradeCoverage(
  entitlements: Readonly<Record<LicenceGrade, LicenceGradeEntitlement>>,
  answer: RegistryScopeAnswer | undefined,
  area: PropertyAreaEvidence,
): GradeCoverage {
  if (answer === undefined) return { kind: 'grade-unknown' };
  if (answer === 'none') return { kind: 'not-graded' };
  const entitlement = entitlements[answer];
  switch (entitlement.kind) {
    case 'unrestricted':
      return { kind: 'covers', grade: answer };
    case 'area-cap':
      return areaCapCoverage(answer, entitlement.maxAreaSqm, area);
    case 'residential-power-cap':
      return { kind: 'not-judged', grade: answer };
  }
}

/** Η κρίση **μαζί** με το ποιος λέει την τάξη και αν η απάντηση της αρχής θέλει επανέλεγχο. */
export interface InspectorFit {
  readonly coverage: GradeCoverage;
  /** `null` = η επαφή δεν κρατά την άδεια (καμία δήλωση, κανένας έλεγχος). */
  readonly source: LicenceStanding['source'] | null;
  readonly checkedAt: string | null;
  /** Η απάντηση της αρχής είναι παλαιότερη από `REGISTRY_CHECK_FRESH_DAYS` ⇒ προτείνεται επανέλεγχος πριν την ανάθεση. */
  readonly recheckSuggested: boolean;
}

/**
 * **Ταιριάζει αυτός ο επαγγελματίας σε αυτό το ακίνητο;** — `nowMs` = το **ένα** ρολόι του μητρώου (ποτέ `Date.now()`
 * μέσα στον κριτή: η ίδια απόκριση κρίνεται ίδια σε κάθε απόδοση).
 */
export function inspectorFitOf(
  requirement: IssuanceGradeRequirement,
  standing: LicenceStanding | null,
  area: PropertyAreaEvidence,
  nowMs: number,
): InspectorFit {
  const entitlements = PROFESSIONAL_LICENCE_SPECS[requirement.licence].gradeScheme?.entitlements[requirement.scope];
  const answer = standing?.grades[requirement.scope];
  const coverage = entitlements === undefined ? { kind: 'grade-unknown' as const } : gradeCoverage(entitlements, answer, area);
  const age = standing === null || standing.checkedAt === null ? null : daysSinceOrNull(standing.checkedAt, nowMs);
  return {
    coverage,
    source: standing?.source ?? null,
    checkedAt: standing?.checkedAt ?? null,
    recheckSuggested: standing?.source === 'registry' && age !== null && age > REGISTRY_CHECK_FRESH_DAYS,
  };
}
