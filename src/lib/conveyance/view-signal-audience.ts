/**
 * =============================================================================
 * Conveyance — ΠΟΙΕΣ όψεις αλλάζουν από μια πράξη (ADR-901 §14.8 · άγκυρα Α36)
 * =============================================================================
 *
 * 🔑 **Η ΑΡΧΗ, σε μία πρόταση**: *μια όψη λαμβάνει σήμα **αν και μόνο αν** η εγγραφή που άλλαξε — πριν ή μετά —
 *    είναι ορατή σε αυτήν.* Το σήμα δεν κουβαλά περιεχόμενο, αλλά **ο χρονισμός του είναι πληροφορία**: σήμα στον
 *    δικηγόρο του αγοραστή όταν δουλεύει η πλευρά του πωλητή θα του έλεγε *πότε* — πλάγιο κανάλι που το Linear
 *    (sync groups ανά δικαιώματα) κλείνει για τα δεδομένα αλλά όχι για τον χρονισμό. Εδώ κλείνει και αυτό.
 *
 * Η κρίση **δεν** είναι νέα: ρωτά τους **υπάρχοντες** κριτές ορατότητας —
 * - transmittal → `reachesViewer` / `sentOnBehalf` (Α23 · Π2) ∩ `viewerSeesItem` (`visibleTo`)
 * - αίτημα εγγράφου → αιτών + παραλήπτης (Α31 — «όχι από εμένα» ≡ «προς εμένα»)
 * - γραμμή (εξαίρεση · έλεγχος) → `viewerSeesItem`
 * ώστε σήμα και όψη να **μην μπορούν** να διαφωνήσουν για το «ποιος βλέπει τι».
 *
 * ⚠️ Περισσότερα σήματα **μέσα** στο ακροατήριο = μία περιττή ανάγνωση (ακίνδυνο). Σήμα **έξω** από αυτό = διαρροή.
 *    Γι' αυτό η άγκυρα ελέγχει το αμετάβλητο «καμία όψη έξω από το ακροατήριο» σε **κάθε** γραμμή × ρόλο.
 *
 * **Layering**: καθαρό — καμία βάση, κανένας χρόνος.
 *
 * @module lib/conveyance/view-signal-audience
 */

import { getChecklistItem } from '@/config/conveyance-checklist/catalog';
import type { ConveyanceCommand } from './conveyance-commands';
import type { CaseActorRole } from '@/types/conveyance-case';
import type { LegalProfessionalRole } from '@/types/legal-contracts';
import { reachesViewer, sentOnBehalf, type AudienceItem, type CaseViewerRole } from './contribution-audience';
import { viewerSeesItem } from './derive-checklist';
import { viewSignalSeed, type CaseViewKey, type EngagementCaseView, type HostCaseView } from './view-signal-key';

/** Ένας ενεργός επαγγελματίας της υπόθεσης — η όψη του **και** ο ρόλος που κρίνει τι βλέπει. */
export interface EngagedViewer extends EngagementCaseView {
  readonly role: LegalProfessionalRole;
}

/** Όλες οι όψεις μιας υπόθεσης **τώρα**: ο οικοδεσπότης + οι ενεργές συμμετοχές. */
export interface CaseViewers {
  readonly host: HostCaseView;
  readonly engaged: readonly EngagedViewer[];
}

/** Τι άλλαξε — όσο χρειάζεται η κρίση ορατότητας, τίποτα παραπάνω. */
export type CaseChange =
  /** Κατάσταση ολόκληρης της υπόθεσης (γεγονός · ημερομηνία υπογραφής · ακύρωση) — τη βλέπουν όλοι. */
  | { readonly kind: 'case-wide' }
  /** Μία γραμμή (εξαίρεση «δεν εφαρμόζεται» · έλεγχος · καθαρισμός). */
  | { readonly kind: 'item'; readonly item: Pick<AudienceItem, 'visibleTo'> }
  /** Αποστολή · νέα έκδοση · απόσυρση transmittal. */
  | { readonly kind: 'transmittal'; readonly authorRole: LegalProfessionalRole; readonly item: AudienceItem }
  /** Αίτημα εγγράφου — το βλέπουν **μόνο** αιτών και παραλήπτης. */
  | { readonly kind: 'request'; readonly parties: readonly CaseActorRole[] }
  /** Ποιοι συμμετέχουν (πρόταση · απάντηση · λήξη · πρόσκληση) — ο κατάλογος συμμετεχόντων είναι κοινός. */
  | { readonly kind: 'roster' }
  /** Εγγραφή με ρητό ακροατήριο — π.χ. τεκμήριο του οικοδεσπότη (CDC): οι ρόλοι που τη φτάνουν πριν **ή** μετά. */
  | { readonly kind: 'scoped'; readonly roles: readonly CaseViewerRole[] };

/** Βλέπει ο ρόλος αυτή την αλλαγή; — η ΜΙΑ ερώτηση, με τους κριτές της όψης. */
export function roleSeesChange(change: CaseChange, role: CaseViewerRole): boolean {
  switch (change.kind) {
    case 'case-wide':
    case 'roster':
      return true;
    case 'item':
      return viewerSeesItem(role, change.item);
    case 'request':
      return change.parties.some((party) => party === role);
    case 'scoped':
      return change.roles.includes(role);
    case 'transmittal':
      return transmittalSeenBy(change, role);
  }
}

/**
 * Ο οικοδεσπότης βλέπει ένα transmittal **ή** ως αρχείο (`reachesViewer`) **ή** ως «🔒 Παραδόθηκε εμπιστευτικά»
 * (έγγραφο εντολέα, Π2/Α35) — και στις δύο περιπτώσεις η όψη του αλλάζει. Ο επαγγελματίας μόνο όταν τον φτάνει
 * **και** βλέπει τη γραμμή — η ίδια τομή που κάνει ο πυρήνας του καταλόγου.
 */
function transmittalSeenBy(change: Extract<CaseChange, { kind: 'transmittal' }>, role: CaseViewerRole): boolean {
  const question = { authorRole: change.authorRole, item: change.item };
  if (role === 'host') return reachesViewer(question, 'host') || sentOnBehalf(change.item);
  if (role === change.authorRole) return true;
  return reachesViewer(question, role) && viewerSeesItem(role, change.item);
}

/**
 * Η αλλαγή μιας εντολής του οικοδεσπότη. Γεγονός · ημερομηνία υπογραφής · ακύρωση ⇒ όλη η υπόθεση· εντολή γραμμής ⇒
 * όσοι βλέπουν τη γραμμή. Γραμμή εκτός καταλόγου ⇒ μόνο ο οικοδεσπότης (fail-closed: καμία όψη δεν μαντεύεται).
 */
export function changeOfCommand(command: ConveyanceCommand): CaseChange {
  switch (command.type) {
    case 'answer_fact':
    case 'set_target_signing_date':
    case 'cancel':
      return { kind: 'case-wide' };
    case 'mark_not_applicable':
    case 'review':
    case 'clear_override': {
      const item = getChecklistItem(command.itemId);
      return item ? { kind: 'item', item } : { kind: 'scoped', roles: ['host'] };
    }
  }
}

/** Οι όψεις που λαμβάνουν σήμα — χωρίς διπλές. `extra`: όψεις που αφορά **ρητά** η πράξη (π.χ. η συμμετοχή που έληξε). */
export function viewsAffectedBy(change: CaseChange, viewers: CaseViewers, extra: readonly CaseViewKey[] = []): readonly CaseViewKey[] {
  const views: CaseViewKey[] = [];
  if (roleSeesChange(change, 'host')) views.push(viewers.host);
  for (const viewer of viewers.engaged) {
    if (roleSeesChange(change, viewer.role)) views.push({ kind: 'engagement', engagementId: viewer.engagementId, uid: viewer.uid });
  }
  const unique = new Map<string, CaseViewKey>();
  for (const view of [...views, ...extra]) unique.set(viewSignalSeed(view), view);
  return [...unique.values()];
}
