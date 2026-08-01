/**
 * Shared internals for the deletion guard family (entity guard + link guard).
 *
 * Kept small and dependency-free so both `deletion-guard.ts` and
 * `deletion-link-guard.ts` can import without cycles.
 *
 * @module lib/firestore/deletion-common
 * @enterprise ADR-226 — Deletion Guard
 */

import 'server-only';

import { DEPENDENCY_REMEDIATIONS, type DependencyCheckResult } from '@/config/deletion-registry';

/** Maximum document IDs returned per dependency (for UI preview) */
export const MAX_PREVIEW_IDS = 10;

/** One dependency's outcome, exactly as the two guards report it. */
type DependencyOutcome = DependencyCheckResult['dependencies'][number];

/** Ό,τι χρειάζεται μια αναφορά εξάρτησης από τη δήλωσή της. */
interface DependencyIdentity {
  readonly label: string;
  readonly collection: string;
  readonly remediation?: string;
}

/** Το ελάχιστο του Firestore snapshot που διαβάζουν και οι δύο φύλακες. */
interface CountedSnapshot {
  readonly size: number;
  readonly docs: ReadonlyArray<{ readonly id: string }>;
}

/**
 * Η αναφορά μιας εξάρτησης που **μετρήθηκε**.
 *
 * Το `MAX_PREVIEW_IDS` όριο ζει εδώ, μία φορά: ο φύλακας ζητά πάντα ένα
 * παραπάνω (`limit(MAX_PREVIEW_IDS + 1)`) για να ξέρει αν υπάρχουν κι άλλα,
 * αλλά **δείχνει** το πολύ τόσα.
 */
export function toDependencyOutcome(
  dep: DependencyIdentity,
  snapshot: CountedSnapshot,
): DependencyOutcome {
  return {
    label: dep.label,
    collection: dep.collection,
    count: snapshot.size,
    remediation: dep.remediation ?? getDefaultRemediation(dep.collection),
    documentIds: snapshot.docs.slice(0, MAX_PREVIEW_IDS).map((doc) => doc.id),
  };
}

/**
 * Η αναφορά μιας εξάρτησης που **δεν μπόρεσε** να μετρηθεί.
 *
 * 🔴 Το `-1` δεν είναι «μηδέν εξαρτήσεις»: αποτυχία ερωτήματος **μπλοκάρει** τη
 * διαγραφή. Το ασφαλές προεπιλεγμένο είναι «δεν ξέρω ⇒ μη σβήσεις», ποτέ το
 * αντίστροφο.
 */
export function unavailableDependencyOutcome(dep: DependencyIdentity): DependencyOutcome {
  return {
    label: dep.label,
    collection: dep.collection,
    count: -1,
    remediation: DEPENDENCY_REMEDIATIONS.guardUnavailable,
    documentIds: [],
  };
}

/**
 * Το **λεξιλόγιο** του κάθε φύλακα — μένει στον καλούντα επίτηδες.
 *
 * Ο μηχανισμός συνάθροισης είναι ίδιος («ποιες μετρήσεις μπλοκάρουν, πόσες
 * εγγραφές, ποια ετικέτα»)· τα μηνύματα **όχι**: «η διαγραφή αποκλείεται» και
 * «ο συνεργάτης δεν μπορεί να αφαιρεθεί» είναι δύο διαφορετικές πράξεις για τον
 * χρήστη. Ενοποιείται ο μηχανισμός, όχι το λεξιλόγιο (ADR-742 §7octies).
 */
export interface DependencyCheckCopy {
  /** Καμία εξάρτηση δεν μπλοκάρει. */
  readonly allowed: string;
  /** Υπάρχουν μετρημένες εξαρτήσεις. */
  readonly blocked: (totalDependents: number, dependencyLabels: string) => string;
  /** Όλα όσα μπλοκάρουν προέκυψαν από **σφάλμα ελέγχου**, όχι από εγγραφές. */
  readonly unavailable: (dependencyLabels: string) => string;
}

/**
 * Συναθροίζει τις επιμέρους μετρήσεις σε **μία** ετυμηγορία.
 *
 * Οι δύο φύλακες είχαν πανομοιότυπο σώμα εδώ (N.18: 16 + 13 γραμμές κλώνου,
 * ADR-742 §7novies). Ο κανόνας που ήταν διπλογραμμένος:
 *
 * - `count !== 0` μπλοκάρει — άρα **και** το `-1` (σφάλμα ελέγχου).
 * - το σύνολο μετρά **μόνο** θετικές μετρήσεις (`Math.max(0, …)`), αλλιώς ένα
 *   `-1` θα αφαιρούσε από το πλήθος και θα έδειχνε λιγότερα από όσα υπάρχουν.
 */
export function summarizeDependencyCheck(
  results: ReadonlyArray<DependencyOutcome>,
  copy: DependencyCheckCopy,
): DependencyCheckResult {
  const blocking = results.filter((r) => r.count !== 0);

  if (blocking.length === 0) {
    return { allowed: true, dependencies: [], totalDependents: 0, message: copy.allowed };
  }

  const totalDependents = blocking.reduce((sum, r) => sum + Math.max(0, r.count), 0);
  const dependencyLabels = blocking
    .map((d) => (d.count > 0 ? `${d.label} (${d.count})` : `${d.label} (έλεγχος μη διαθέσιμος)`))
    .join(', ');

  return {
    allowed: false,
    dependencies: blocking,
    totalDependents,
    message: totalDependents > 0
      ? copy.blocked(totalDependents, dependencyLabels)
      : copy.unavailable(dependencyLabels),
  };
}

/**
 * Map a collection name to its default remediation guidance (Greek).
 * Used when a dependency definition has no explicit `remediation` field.
 *
 * Εσωτερικό από τις 2026-08-01: μοναδικός καλών είναι πλέον το
 * {@link toDependencyOutcome} — οι δύο φύλακες δεν συνθέτουν πια αναφορά μόνοι
 * τους, άρα δεν χρειάζονται το ίδιο το ταίριασμα (ADR-742 §7novies).
 */
function getDefaultRemediation(collection: string): string {
  switch (collection) {
    case 'attendance_events':
      return DEPENDENCY_REMEDIATIONS.attendanceEvents;
    case 'employment_records':
      return DEPENDENCY_REMEDIATIONS.employmentRecords;
    case 'communications':
      return DEPENDENCY_REMEDIATIONS.communications;
    case 'opportunities':
      return DEPENDENCY_REMEDIATIONS.opportunities;
    case 'properties':
    case 'parking_spaces':
    case 'storage':
      return DEPENDENCY_REMEDIATIONS.propertiesOwnership;
    case 'contact_links':
      return DEPENDENCY_REMEDIATIONS.contactLinks;
    case 'obligations':
      return DEPENDENCY_REMEDIATIONS.obligations;
    case 'construction_phases':
    case 'building_milestones':
    case 'floors':
    case 'buildings':
      return DEPENDENCY_REMEDIATIONS.constructionChildren;
    case 'accounting_invoices':
      return DEPENDENCY_REMEDIATIONS.accountingDocs;
    case 'projects':
      return DEPENDENCY_REMEDIATIONS.projectsAsCompany;
    default:
      return DEPENDENCY_REMEDIATIONS.generic;
  }
}
