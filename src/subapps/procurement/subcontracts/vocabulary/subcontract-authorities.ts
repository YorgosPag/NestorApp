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
 * | `agreements` | συμφωνητικό: πρόχειρο, μεταβάσεις κύκλου ζωής (Φ2) | Procore: Commitments admin |
 * | `assign` | **εντολή εργασίας**: ανάθεση εργοταξίου σε κύρια σύμβαση πολλών έργων (§5.15) | AIA A422 · Procore «Create Work Order Contract» |
 * | `approveDeviation` | έγκριση/απόρριψη **απόκλισης** ενός συμφωνητικού από τις ζώνες της εταιρείας (§5.2.1 τρόπος 3) | DocuSign CLM: έγκριση εξαίρεσης |
 *
 * 🔑 Εμβέλεια (§5.15): το `agreements` ισχύει **και στο έργο** για συμφωνητικό `single_project`, το `assign` στο
 * **έργο-στόχο** της ανάθεσης· η κύρια σύμβαση (`multi_project`) και το `approveDeviation` μένουν **της εταιρείας**.
 * Το έργο το δίνει **μόνο** ο πόρος (`agreement-resource.server.ts`, ADR-926 Κ3).
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
  assign: ['subcontracts:agreements:assign'],
  approveDeviation: ['subcontracts:agreements:approve_deviation'],
} as const satisfies Readonly<Record<string, readonly PermissionId[]>>;

export type SubcontractAuthority = keyof typeof SUBCONTRACT_AUTHORITY_PERMISSIONS;
