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
 * | **εκ μέρους** πελάτη (Π2) | η κλάση του **εγγράφου** (`visibleTo`) — π.χ. ταυτότητα αγοραστή ⇒ αγοραστής · `buyer_lawyer` · `notary` |
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

import { getChecklistItem } from '@/config/conveyance-checklist/catalog';
import { fulfilmentOf } from '@/config/engagement-policy';
import type { ChecklistItem, ConveyanceRole } from '@/config/conveyance-checklist/types';
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

/** Ό,τι χρειάζεται η κρίση ακροατηρίου από τη γραμμή: τον πάροχο (ιδιότητα) και την κλάση ιδιωτικότητας. */
export type AudienceItem = Pick<ChecklistItem, 'provider' | 'visibleTo'>;

/** Ένα transmittal όπως το βλέπει η κρίση ακροατηρίου: **ποιος** το έστειλε, για **ποια** γραμμή. */
export interface AudienceQuestion {
  readonly authorRole: LegalProfessionalRole;
  readonly item: AudienceItem;
}

/** Στέλνει ο συντάκτης **εκ μέρους** του πελάτη του (Π2); — παράγεται από τον πάροχο, ποτέ αποθηκευμένο. */
export function sentOnBehalf(item: AudienceItem): boolean {
  return fulfilmentOf(item.provider).capacity === 'on_behalf';
}

/**
 * Το ακροατήριο ενός transmittal. 🔑 Π2: έγγραφο **του πελάτη** (εκ μέρους) πηγαίνει όπου πηγαίνει το **έγγραφο**
 * (`visibleTo`: αγοραστής · δικηγόρος του · συμβολαιογράφος) — ο συμβολαιογράφος **πρέπει** να βλέπει την ταυτότητα
 * του αγοραστή, ενώ η πλευρά του δικηγόρου (`BUYER_SIDE`) δεν τον περιλαμβάνει. Ο οικοδεσπότης **ποτέ**: δεν υπάρχει
 * στο λεξιλόγιο του `visibleTo` (μαθαίνει μόνο ότι παραδόθηκε — `sealedDeliveries`).
 */
function contributionAudience(question: AudienceQuestion): readonly CaseViewerRole[] {
  return sentOnBehalf(question.item) ? question.item.visibleTo : AUDIENCE_BY_AUTHOR[question.authorRole];
}

/**
 * Η ερώτηση ακροατηρίου μιας **αποθηκευμένης** αποστολής — η γραμμή από τον κατάλογο. Γραμμή που δεν υπάρχει πια
 * ⇒ `null` και ο καλών κλείνει (fail-closed): κανένα όνομα, κανένα τεκμήριο.
 */
export function audienceOfTransmittal(transmittal: { readonly authorRole: LegalProfessionalRole; readonly checklistItemId: string }): AudienceQuestion | null {
  const item = getChecklistItem(transmittal.checklistItemId);
  return item ? { authorRole: transmittal.authorRole, item } : null;
}

/** Φτάνει αυτό το transmittal σε αυτόν τον θεατή; */
export function reachesViewer(question: AudienceQuestion, viewer: CaseViewerRole): boolean {
  return contributionAudience(question).includes(viewer);
}
