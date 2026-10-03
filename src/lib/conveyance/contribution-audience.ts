/**
 * =============================================================================
 * Conveyance — ΣΕ ΠΟΙΟΥΣ φτάνει ένα transmittal (ADR-901 Φ4.4 · Σ-3 · άγκυρα Α23)
 * =============================================================================
 *
 * 🔑 Το ακροατήριο το ορίζει ο **ΡΟΛΟΣ του συντάκτη** — ποτέ λίστα παραληπτών από το αίτημα/UI. Εκεί
 * **ξεπερνάμε** το Aconex/ACC, όπου ο αποστολέας διαλέγει παραλήπτες: εδώ η έκθεση του δικηγόρου του
 * αγοραστή **δεν μπορεί** δομικά να σταλεί στον πωλητή, όσα λάθη κι αν γίνουν στην οθόνη.
 *
 * | Συντάκτης       | Ακροατήριο                                              |
 * |-----------------|---------------------------------------------------------|
 * | `notary`        | όλοι + ο οικοδεσπότης (ουδέτερος — εκδίδει για όλους)   |
 * | `seller_lawyer` | πλευρά πωλητή: οικοδεσπότης · πωλητής · `seller_lawyer` |
 * | `buyer_lawyer`  | πλευρά αγοραστή: αγοραστής · `buyer_lawyer`             |
 *
 * Ο οικοδεσπότης είναι **η πλευρά του πωλητή** (εργολάβος ή ιδιώτης που πουλά, ADR-901 §5.11). Η τελική
 * ορατότητα = ακροατήριο ∩ `visibleTo` της γραμμής (ο πυρήνας `deriveChecklist` εφαρμόζει το δεύτερο).
 *
 * ⚠️ **Δεν αποθηκεύεται** στο έγγραφο: παράγεται εδώ κάθε φορά ⇒ δεν μπορεί να αποκλίνει από τον κανόνα.
 *
 * **Layering**: leaf.
 *
 * @module lib/conveyance/contribution-audience
 */

import type { ConveyanceRole } from '@/config/conveyance-checklist/types';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

/** Ποιος κοιτά τον κατάλογο: ένας ρόλος της υπόθεσης ή ο οικοδεσπότης (ίδιο λεξιλόγιο με `ChecklistViewer`). */
export type CaseViewerRole = ConveyanceRole | 'host';

const SELLER_SIDE: readonly CaseViewerRole[] = ['host', 'seller', 'seller_lawyer'];
const BUYER_SIDE: readonly CaseViewerRole[] = ['buyer', 'buyer_lawyer'];
const EVERYONE_AND_HOST: readonly CaseViewerRole[] = ['host', 'seller', 'buyer', 'seller_lawyer', 'buyer_lawyer', 'notary'];

const AUDIENCE_BY_AUTHOR: Readonly<Record<LegalProfessionalRole, readonly CaseViewerRole[]>> = {
  notary: EVERYONE_AND_HOST,
  seller_lawyer: SELLER_SIDE,
  buyer_lawyer: BUYER_SIDE,
};

/** Το ακροατήριο ενός transmittal αυτού του συντάκτη. */
function contributionAudience(authorRole: LegalProfessionalRole): readonly CaseViewerRole[] {
  return AUDIENCE_BY_AUTHOR[authorRole];
}

/** Φτάνει ένα transmittal αυτού του συντάκτη σε αυτόν τον θεατή; */
export function reachesViewer(authorRole: LegalProfessionalRole, viewer: CaseViewerRole): boolean {
  return contributionAudience(authorRole).includes(viewer);
}
