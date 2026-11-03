/**
 * Οι **δικαιοδοσίες** της υπεργολαβίας → τα δικαιώματα που τις κρίνουν (ADR-928 §5.2.1). **Ένας** πίνακας για τον
 * διακομιστή (ποιο δικαίωμα ζητά η διαδρομή) και την οθόνη της Φ3 (εμφανίζεται το κουμπί;) — όπως το
 * `catalog-authorities` του ADR-923, που ήταν δύο αντίγραφα ως την 3β και θα απέκλιναν στην πρώτη νέα.
 *
 * | Δικαιοδοσία | Τι κρίνει | Πρακτική |
 * |---|---|---|
 * | `propose` | νέα ρήτρα / νέα έκδοση / μετάφραση / απόσυρση δικής μου πρότασης — **πρόταση**, όχι ισχύς | DocuSign CLM: αίτημα αλλαγής |
 * | `manage` | έγκριση · απόρριψη · επαγγελματικός έλεγχος · αρχειοθέτηση | Ironclad: η βιβλιοθήκη ανήκει στους διαχειριστές |
 * | `templates` | πρότυπα ειδικότητας — το καλούπι κάθε συμφωνητικού | Procore: πρότυπα συμβάσεων |
 * | `seed` | σπορά της προεπιλεγμένης βιβλιοθήκης: γράφει προτάσεις **και** πρότυπα ⇒ θέλει **και τα δύο** | — |
 * | `agreements` | συμφωνητικό: πρόχειρο, μεταβάσεις κύκλου ζωής, αναθέσεις εργοταξίου (Φ2) | Procore: Commitments admin |
 * | `approveDeviation` | έγκριση/απόρριψη **απόκλισης** ενός συμφωνητικού από τις ζώνες της εταιρείας (§5.2.1 τρόπος 3) | DocuSign CLM: έγκριση εξαίρεσης |
 *
 * 🔑 Τα δικαιώματα συμφωνητικού είναι **της εταιρείας**, όχι του έργου (Φ2 απόφαση 11): ένα `multi_project` έγγραφο
 * δεν έχει **ένα** έργο-πόρο, και το ADR-926 Κ3 δέχεται έργο **μόνο** από τον πόρο.
 *
 * @module subapps/procurement/subcontracts/vocabulary/subcontract-authorities
 */

import type { PermissionId } from '@/lib/auth/types';

export const SUBCONTRACT_AUTHORITY_PERMISSIONS = {
  propose: ['subcontracts:clauses:propose'],
  manage: ['subcontracts:clauses:manage'],
  templates: ['subcontracts:templates:manage'],
  seed: ['subcontracts:clauses:manage', 'subcontracts:templates:manage'],
  agreements: ['subcontracts:agreements:manage'],
  approveDeviation: ['subcontracts:agreements:approve_deviation'],
} as const satisfies Readonly<Record<string, readonly PermissionId[]>>;

export type SubcontractAuthority = keyof typeof SUBCONTRACT_AUTHORITY_PERMISSIONS;
