/**
 * =============================================================================
 * Μόνιμη υποχρέωση του ακινήτου — πρόταση · απόφαση · απαίτηση (ADR-915 §35)
 * =============================================================================
 *
 * Μερικά έγγραφα δεν τα ζητά μια **πράξη** αλλά ο νόμος, **όσο ζει** το ακίνητο (η ΥΔΕ: τακτικός επανέλεγχος της
 * ηλεκτρικής εγκατάστασης, ΥΑ 101195/2021 άρθρο 4 παρ. 5). Η διαδικασία `property-upkeep` κάνει το μητρώο να μπορεί να
 * πει «λείπει» και «τι σταματά» και γι' αυτά — **αλλά μόνο αφού το επιβεβαιώσει άνθρωπος**:
 *
 *  1. **Πρόταση** (`upkeepProposalOf`) — η εφαρμογή διαβάζει κλάση + φάση του ακινήτου και **προτείνει**, πάντα με λόγο.
 *     Ποτέ απαίτηση μόνη της: ο νόμος λέει «για εγκαταστάσεις», ότι **αυτό** το ακίνητο έχει δική του παροχή δεν το
 *     ξέρει ο τύπος του (αποθήκη χωρίς παροχή = `commercial`).
 *  2. **Απόφαση** (`UpkeepDeclaration`) — ο άνθρωπος επιβεβαιώνει ή εξαιρεί **με λόγο**, και κρατιέται τι πρότεινε η
 *     εφαρμογή **τότε**: «δέχτηκε πρόταση» ≠ «παρέκαμψε πρόταση» (Arthur Online: «mark as completed» χωρίς τίποτα).
 *  3. **Απαίτηση** (`upkeepRequirementsOf`) — μόνο η επιβεβαίωση γίνεται `DocumentRequirement`. Το «λείπει», το «τι
 *     σταματά» και τα φίλτρα τα κάνει ο **ΙΔΙΟΣ** πυρήνας (`documentRegistry`) — καμία δεύτερη λογική.
 *
 * 🔑 Χωρίς απόφαση ⇒ **καμία** απαίτηση ⇒ κανένα «λείπει»: το έγγραφο παρακολουθείται όπως πριν (καμία ψευδής κόκκινη).
 * 🔑 Πολιτική `warn`: ο νόμος βάζει υποχρέωση στον ιδιοκτήτη, δεν σταματά καμία διαδικασία της εφαρμογής (δόγμα Α1).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 *
 * @module lib/document-validity/property-upkeep
 */

import {
  documentKindSpec,
  STANDING_OBLIGATION_KINDS,
  type DocumentKind,
} from '@/config/document-validity/document-validity';
import { normalizeOperationalStatus, type OperationalStatus } from '@/constants/operational-statuses';
import type { PropertyClass } from '@/constants/property-types';
import type { DocumentRequirement } from './document-requirement';

// =============================================================================
// 1. Η ΠΡΟΤΑΣΗ — κλάση + φάση
// =============================================================================

/**
 * Τι λέει η φάση για την εγκατάσταση. **Εξαντλητικό** `Record`: νέα λειτουργική κατάσταση δεν μεταγλωττίζεται μέχρι
 * κάποιος να απαντήσει.
 * - `in-use`         — κτίσμα που λειτουργεί (έτοιμο · υπό συντήρηση): η εγκατάσταση υπάρχει.
 * - `pre-completion` — υπό κατασκευή · σε επιθεώρηση: η πρώτη ΥΔΕ έρχεται με τη **σύνδεση**, όχι ως επανέλεγχος.
 * - `undeclared`     — `draft` = η **προεπιλογή** κάθε νέας μονάδας (`DEFAULT_OPERATIONAL_STATUS`), όχι «άκτιστο».
 */
const PHASE_STANDING: Readonly<Record<OperationalStatus, 'in-use' | 'pre-completion' | 'undeclared'>> = {
  draft: 'undeclared',
  'under-construction': 'pre-completion',
  inspection: 'pre-completion',
  maintenance: 'in-use',
  ready: 'in-use',
};

export const UPKEEP_PROPOSAL_VERDICTS = ['proposed', 'not-proposed', 'undetermined'] as const;
export type UpkeepProposalVerdict = (typeof UPKEEP_PROPOSAL_VERDICTS)[number];

/**
 * **Γιατί** (ποτέ σιωπηλό):
 * - `in-use` · `phase-undeclared` — προτείνεται (κτίσμα σε χρήση · κτίσμα χωρίς δηλωμένη φάση)
 * - `class` · `phase`             — δεν προτείνεται (οικόπεδο · πριν τη σύνδεση)
 * - `class-unknown`               — άγνωστο είδος ακινήτου: η εφαρμογή **δεν ξέρει**, και το λέει
 */
export const UPKEEP_PROPOSAL_REASONS = ['in-use', 'phase-undeclared', 'class', 'phase', 'class-unknown'] as const;
export type UpkeepProposalReason = (typeof UPKEEP_PROPOSAL_REASONS)[number];

export interface UpkeepProposal {
  readonly verdict: UpkeepProposalVerdict;
  readonly reason: UpkeepProposalReason;
  /** Τα γεγονότα που διαβάστηκαν — μένουν στο ίχνος της απόφασης («τι ήξερε η εφαρμογή τότε»). */
  readonly propertyClass: PropertyClass | null;
  readonly phase: OperationalStatus | null;
}

export interface UpkeepSubjectFacts {
  readonly propertyClass: PropertyClass | null;
  /** Ωμή τιμή (`operationalStatus`)· κανονικοποιείται **εδώ**, ποτέ από τον καλούντα. */
  readonly phase: unknown;
}

/** **Η πρόταση** για αυτό το είδος σε αυτό το ακίνητο. Είδος χωρίς μόνιμη υποχρέωση ⇒ `not-proposed:class`. */
export function upkeepProposalOf(kind: DocumentKind, facts: UpkeepSubjectFacts): UpkeepProposal {
  const phase = normalizeOperationalStatus(facts.phase);
  const { propertyClass } = facts;
  const obligation = documentKindSpec(kind).standingObligation;
  const of = (verdict: UpkeepProposalVerdict, reason: UpkeepProposalReason): UpkeepProposal =>
    ({ verdict, reason, propertyClass, phase });
  if (propertyClass === null) return of('undetermined', 'class-unknown');
  if (obligation === null || !obligation.proposedFor.includes(propertyClass)) return of('not-proposed', 'class');
  const standing = phase === null ? 'undeclared' : PHASE_STANDING[phase];
  if (standing === 'pre-completion') return of('not-proposed', 'phase');
  return of('proposed', standing === 'in-use' ? 'in-use' : 'phase-undeclared');
}

// =============================================================================
// 2. Η ΑΠΟΦΑΣΗ — ο άνθρωπος, με ίχνος
// =============================================================================

export const UPKEEP_DECISIONS = ['required', 'not-required'] as const;
export type UpkeepDecision = (typeof UPKEEP_DECISIONS)[number];

/**
 * **Γιατί δεν ισχύει** — κλειστό λεξιλόγιο, ποτέ σιωπηλή παράκαμψη:
 * - `no-own-supply` — χωρίς δική του παροχή (αποθήκη · θέση στάθμευσης στον κοινόχρηστο πίνακα)
 * - `not-connected` — καμία ενεργή σύνδεση στο δίκτυο (η εγκατάσταση δεν λειτουργεί)
 * - `other`         — άλλος λόγος· το ίχνος κρατά ποιος και πότε
 */
export const UPKEEP_EXEMPTION_REASONS = ['no-own-supply', 'not-connected', 'other'] as const;
export type UpkeepExemptionReason = (typeof UPKEEP_EXEMPTION_REASONS)[number];

/** Η απόφαση για (ακίνητο, είδος) — ό,τι χρειάζεται ο πυρήνας. Το αποθηκευμένο έγγραφο την επεκτείνει. */
export interface UpkeepDeclaration {
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
  readonly decision: UpkeepDecision;
  /** Μόνο όταν `not-required`· αλλιώς `null`. */
  readonly exemptionReason: UpkeepExemptionReason | null;
  /** Τι πρότεινε η εφαρμογή **τη στιγμή** της απόφασης — το υπολογίζει ο διακομιστής, ποτέ ο πελάτης. */
  readonly proposalAtDecision: UpkeepProposal;
  readonly declaredByUid: string;
  /** ISO στιγμή. */
  readonly declaredAt: string;
}

/** «Η απόφαση ακολούθησε την πρόταση;» — για την οθόνη και το ίχνος· `undetermined` δεν «παρακάμπτεται». */
export function followsProposal(declaration: UpkeepDeclaration): boolean | null {
  const { verdict } = declaration.proposalAtDecision;
  if (verdict === 'undetermined') return null;
  return (verdict === 'proposed') === (declaration.decision === 'required');
}

// =============================================================================
// 3. Η ΑΠΑΙΤΗΣΗ — μόνο η επιβεβαίωση
// =============================================================================

function requirementOf(declaration: UpkeepDeclaration): DocumentRequirement | null {
  const obligation = documentKindSpec(declaration.documentKind).standingObligation;
  // Είδος που έπαψε να είναι μόνιμη υποχρέωση στον κατάλογο ⇒ η παλιά δήλωση δεν γεννά απαίτηση (ο νόμος αποφασίζει).
  if (declaration.decision !== 'required' || obligation === null) return null;
  return {
    documentKind: declaration.documentKind,
    subject: { propertyId: declaration.propertyId, party: null },
    process: { kind: 'property-upkeep', propertyId: declaration.propertyId },
    neededOn: { kind: 'continuous' },
    policy: 'warn',
    // «Λήγει» = «ώρα να ξεκινήσει ο επανέλεγχος» — ο ίδιος χρόνος με τις ειδοποιήσεις (Φ5).
    warnWindowDays: documentKindSpec(declaration.documentKind).renewalLeadDays ?? 0,
    basis: {
      kind: 'standing-obligation',
      statute: obligation.statute,
      declaredAt: declaration.declaredAt,
      declaredByUid: declaration.declaredByUid,
    },
    presence: 'required',
    // Καμία έγκριση επαγγελματία: το έγγραφο το βρίσκει μόνο το ακίνητο (αρχείο ή δήλωση στοιχείων, §33).
    attestation: null,
  };
}

/** Οι απαιτήσεις της μόνιμης υποχρέωσης — **μία** ανά επιβεβαιωμένη δήλωση· εξαίρεση ή καμία απόφαση ⇒ τίποτα. */
export function upkeepRequirementsOf(declarations: readonly UpkeepDeclaration[]): readonly DocumentRequirement[] {
  return declarations.flatMap((declaration) => {
    const requirement = requirementOf(declaration);
    return requirement === null ? [] : [requirement];
  });
}

// =============================================================================
// 4. Η ΟΨΗ — τι δείχνει η ενότητα «Μόνιμες υποχρεώσεις»
// =============================================================================

export interface UpkeepSubject extends UpkeepSubjectFacts {
  readonly propertyId: string;
}

/** Ένα (ακίνητο, είδος) που ζητά ή έχει απόφαση. */
export interface UpkeepItem {
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
  /** Η πρόταση **σήμερα** (μπορεί να διαφέρει από το `declaration.proposalAtDecision` αν άλλαξε η φάση). */
  readonly proposal: UpkeepProposal;
  readonly declaration: UpkeepDeclaration | null;
}

const declarationKeyOf = (propertyId: string, kind: DocumentKind): string => `${propertyId}:${kind}`;

/**
 * Για κάθε ακίνητο × είδος μόνιμης υποχρέωσης: όσα έχουν **απόφαση**, και όσα **περιμένουν** μία (προτείνεται ή η
 * εφαρμογή δεν ξέρει). Το «δεν προτείνεται» χωρίς απόφαση σιωπά — οικόπεδο χωρίς ΥΔΕ δεν είναι εκκρεμότητα.
 */
export function upkeepItemsOf(
  subjects: readonly UpkeepSubject[],
  declarations: readonly UpkeepDeclaration[],
): readonly UpkeepItem[] {
  const decided = new Map(declarations.map((d) => [declarationKeyOf(d.propertyId, d.documentKind), d]));
  return subjects.flatMap((subject) => STANDING_OBLIGATION_KINDS.flatMap((documentKind): UpkeepItem[] => {
    const declaration = decided.get(declarationKeyOf(subject.propertyId, documentKind)) ?? null;
    const proposal = upkeepProposalOf(documentKind, subject);
    if (declaration === null && proposal.verdict === 'not-proposed') return [];
    return [{ propertyId: subject.propertyId, documentKind, proposal, declaration }];
  }));
}
