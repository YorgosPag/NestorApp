/**
 * Ο ΚΛΕΙΣΤΟΣ ΚΑΤΑΛΟΓΟΣ ΠΡΑΞΕΩΝ ΕΡΓΟΥ (ADR-926 Κ2).
 *
 * Ο ρόλος έργου δίνει **μόνο** ό,τι δηλώνεται εδώ. Ο κατάλογος ρόλων λέει τι *περιέχει* ένας ρόλος· αυτός ο πίνακας λέει
 * ποια από αυτά *ισχύουν* στην εμβέλεια έργου. Έτσι τα ~50 δικαιώματα του `project_manager` δεν ενεργοποιούνται σιωπηλά
 * τη μέρα που μια διαδρομή αρχίσει να περνά `projectId`.
 *
 * ⚠️ Κάθε νέα γραμμή είναι απόφαση πολιτικής. Θέλει σημείο επιβολής και γραμμή στον πίνακα
 * `PROJECT_ROLE_POLICY`: το ελέγχει το CHECK 3.111.
 *
 * ⛔ `projects:floors:delete` ΔΕΝ μπαίνει εδώ: ο όροφος δεν έχει κάδο, η διαγραφή του είναι οριστική, και η οριστική
 * διαγραφή μένει στον `company_admin` (ADR-926 §4).
 *
 * Καθαρά δεδομένα, χωρίς `server-only`: τα διαβάζει και η πύλη.
 *
 * @module lib/auth/project-scoped-actions
 * @see lib/auth/permissions — ο κριτής
 */

import type { PermissionId } from './types';

export const PROJECT_SCOPED_ACTIONS = [
  'buildings:buildings:create',
  'buildings:buildings:update',
  /** Μόνο κάδος: η διαδρομή κάνει `softDelete`. Η οριστική διαγραφή θέλει `trash:entities:purge`. */
  'buildings:buildings:delete',
  'projects:floors:create',
  'projects:floors:update',
  /** Ζωντανό πριν από το ADR-926: `landowner-unlink-check`. */
  'projects:projects:update',
  /** Ζωντανά πριν από το ADR-926: `authorizeForProperty` (υπόθεση μεταβίβασης, ADR-901). */
  'legal:conveyance:view',
  'legal:conveyance:manage',
] as const satisfies readonly PermissionId[];

export type ProjectScopedAction = (typeof PROJECT_SCOPED_ACTIONS)[number];

/** Η απάντηση του διακομιστή για τον θεατή σε ένα έργο (ADR-926 Κ7), όπως το `capabilities` του Google Drive. */
export type ProjectViewerCapabilities = Readonly<Record<ProjectScopedAction, boolean>>;

const DECLARED: ReadonlySet<string> = new Set(PROJECT_SCOPED_ACTIONS);

/** Ισχύει αυτή η πράξη στην εμβέλεια έργου; */
export function isProjectScopedAction(permission: PermissionId): boolean {
  return DECLARED.has(permission);
}
