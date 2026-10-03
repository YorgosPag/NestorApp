/**
 * =============================================================================
 * «Ζήτησε έγγραφο» — ο ΕΝΑΣ κριτής (ADR-901 §5.8 γρ.3 · Φ4.5 · άγκυρες Α29 · Α31)
 * =============================================================================
 *
 * `γραμμή + αιτών + κατάσταση υπόθεσης + ενεργοί ρόλοι τώρα → παραλήπτης | ονομασμένη άρνηση`
 *
 * Τον τρέχουν **και** ο server (πριν γράψει/ειδοποιήσει) **και** ο client (για να δείξει *πριν* το πάτημα «θα
 * ειδοποιηθεί: Συμβολαιογράφος» ή γιατί το κουμπί είναι ανενεργό). Ίδιος κριτής ⇒ κανένα κουμπί που ψεύδεται.
 *
 * Σειρά: υπόθεση ζωντανή → γραμμή αιτήσιμη → ο αιτών τη βλέπει → πάροχος → παραλήπτης (`REQUEST_RECIPIENT_BY_PROVIDER`)
 * → όχι ο ίδιος → ο παραλήπτης **βλέπει** τη γραμμή → είναι **ενεργός τώρα**.
 *
 * 🔑 Α29 **δομικά**: ο παραλήπτης δεν έρχεται ποτέ από το αίτημα· και πρέπει να βλέπει τη γραμμή — δικηγόρος αγοραστή
 *    δεν μαθαίνει ποτέ για γραμμή του πωλητή, ούτε ως αιτών (δεν τη βλέπει) ούτε ως παραλήπτης.
 * 🔑 Α31: το «εκκρεμεί» **παράγεται** (`pendingRequestOf`) — αιτήματα **μετά** το νεότερο τεκμήριο της γραμμής, όσο η
 *    γραμμή είναι ακόμη αιτήσιμη. Κανένα «κλείσιμο» με το χέρι.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, χωρίς I/O.
 *
 * @module lib/conveyance/document-request-policy
 */

import type { ChecklistItem } from '@/config/conveyance-checklist/types';
import { REQUEST_RECIPIENT_BY_PROVIDER } from '@/config/engagement-policy';
import type { CaseActorRole, ChecklistRow, ChecklistRowStatus, ConveyanceCaseState } from '@/types/conveyance-case';
import type {
  DocumentRequestTarget,
  DocumentRequestView,
  PendingDocumentRequest,
} from '@/types/conveyance-document-request';
import type { LegalProfessionalRole } from '@/types/legal-contracts';
import { acceptsEngagements } from './case-state';
import { contributionEntryPointIds } from './contribution-policy';

/**
 * Οι καταστάσεις όπου κάτι **οφείλεται**: λείπει · επιστράφηκε · έληξε · λήγει (ζήτα την ανανέωση **πριν**) · άλλαξε
 * μετά τον έλεγχο.
 */
export const REQUESTABLE_STATUSES: readonly ChecklistRowStatus[] = ['missing', 'rejected', 'expired', 'expiring', 'stale'];

/**
 * **Οφείλεται κάτι σε αυτή τη γραμμή που μπορεί να ζητηθεί;**
 *
 * Πέρα από τις {@link REQUESTABLE_STATUSES}, και το `notary_side` **όταν** η γραμμή δέχεται transmittal: «θα το φέρει ο
 * συμβολαιογράφος» σημαίνει ακριβώς «εκκρεμεί από τον συμβολαιογράφο» (π.χ. σχέδιο συμβολαίου) — το πιο συχνό αίτημα
 * μιας υπόθεσης. ⛔ `notary_side` **χωρίς** δρόμο μέσα στην πλατφόρμα (εκδίδεται στην πράξη) **δεν** ζητείται: δεν
 * υπάρχει τι να σταλεί.
 */
export function isRequestableRow(row: Pick<ChecklistRow, 'status' | 'item'>): boolean {
  if (REQUESTABLE_STATUSES.includes(row.status)) return true;
  return row.status === 'notary_side' && contributionEntryPointIds(row.item).length > 0;
}

/** Ο δικηγόρος της πλευράς του αιτούντος — ο οικοδεσπότης **είναι** η πλευρά του πωλητή· ο συμβολαιογράφος δεν έχει πλευρά. */
function lawyerOfSide(requester: CaseActorRole): LegalProfessionalRole | null {
  if (requester === 'host' || requester === 'seller_lawyer') return 'seller_lawyer';
  return requester === 'buyer_lawyer' ? 'buyer_lawyer' : null;
}

function recipientOf(item: ChecklistItem, requester: CaseActorRole): CaseActorRole | null {
  const route = REQUEST_RECIPIENT_BY_PROVIDER[item.provider];
  return route === 'own-side-lawyer' ? lawyerOfSide(requester) : route;
}

/** Βλέπει αυτός ο λογαριασμός τη γραμμή; Ο οικοδεσπότης βλέπει όλο τον κατάλογο (ίδιο με το `deriveChecklist`). */
function sees(role: CaseActorRole, item: ChecklistItem): boolean {
  return role === 'host' || item.visibleTo.includes(role);
}

interface TargetQuestion {
  readonly item: ChecklistItem;
  readonly requester: CaseActorRole;
  readonly state: ConveyanceCaseState;
  /** Οι ρόλοι επαγγελματιών με ενεργή συμμετοχή **τώρα** (ο οικοδεσπότης υπάρχει πάντα). */
  readonly activeRoles: ReadonlySet<LegalProfessionalRole>;
}

/** Σε ποιον θα πήγαινε το αίτημα — **ανεξάρτητα** από την κατάσταση της γραμμής (αυτό το προσθέτει ο `judgeDocumentRequest`). */
export function requestTargetOf(question: TargetQuestion): DocumentRequestTarget {
  const { item, requester, state, activeRoles } = question;
  if (!acceptsEngagements(state)) return { ok: false, refusal: 'case-closed' };
  if (!sees(requester, item)) return { ok: false, refusal: 'not-requestable' };
  const recipient = recipientOf(item, requester);
  if (recipient === null) return { ok: false, refusal: 'no-recipient' };
  if (recipient === requester) return { ok: false, refusal: 'self-provider' };
  if (!sees(recipient, item)) return { ok: false, refusal: 'no-recipient' };
  if (recipient !== 'host' && !activeRoles.has(recipient)) return { ok: false, refusal: 'no-recipient' };
  return { ok: true, recipient };
}

/** Η πλήρης κρίση για **αυτή** τη γραμμή τώρα: πρώτα «οφείλεται κάτι;», μετά «σε ποιον;». */
export function judgeDocumentRequest(question: Omit<TargetQuestion, 'item'> & { readonly row: ChecklistRow }): DocumentRequestTarget {
  if (!isRequestableRow(question.row)) return { ok: false, refusal: 'not-requestable' };
  return requestTargetOf({ ...question, item: question.row.item });
}

/** Το νεότερο τεκμήριο της γραμμής — αιτήματα **πριν** από αυτό απαντήθηκαν ήδη. */
function newestEvidenceAt(row: ChecklistRow): string {
  return row.files.reduce((latest, file) => (file.createdAt > latest ? file.createdAt : latest), '');
}

/**
 * «Εκκρεμεί από: …» (Α31) — **παράγεται**: το νεότερο αίτημα μετά το νεότερο τεκμήριο, όσο η γραμμή είναι αιτήσιμη.
 * Το «ζητήθηκε σήμερα» κρίνεται με την **ίδια** ημέρα που κάνει ταυτότητα το αίτημα (ίδιο ρολόι με τον server).
 */
export function pendingRequestOf(row: ChecklistRow, log: readonly DocumentRequestView[], today: string): PendingDocumentRequest | null {
  if (!isRequestableRow(row)) return null;
  const mine = log.filter((entry) => entry.itemId === row.itemId);
  const since = newestEvidenceAt(row);
  const open = mine.filter((entry) => entry.requestedAt > since);
  if (open.length === 0) return null;
  const latest = open.reduce((a, b) => (b.requestedAt > a.requestedAt ? b : a));
  return {
    recipient: latest.recipient,
    lastRequestedAt: latest.requestedAt,
    requestedTodayByViewer: mine.some((entry) => entry.byViewer && entry.dayKey === today),
  };
}

/**
 * **Ποιος** ζητά/κοιτά: ο λογαριασμός με τον ρόλο του. Ο οικοδεσπότης είναι **χώρος** (δημιουργός + διαχειριστές):
 * ό,τι ζήτησε ένας, το ζήτησε η πλευρά — ένα αίτημα ανά γραμμή/ημέρα για όλο τον χώρο, όχι ένα ανά διαχειριστή.
 */
export interface RequestParty {
  readonly role: CaseActorRole;
  readonly uid: string;
}

/** Το κλειδί του αιτούντος στην ταυτότητα του αιτήματος — η πλευρά για τον οικοδεσπότη, ο άνθρωπος για τον επαγγελματία. */
export function requesterKeyOf(party: RequestParty): string {
  return party.role === 'host' ? 'host' : party.uid;
}

/** Ο σπόρος της ντετερμινιστικής ταυτότητας: ΕΝΑ αίτημα ανά (υπόθεση, γραμμή, αιτών, ημέρα). */
export function documentRequestSeed(caseId: string, itemId: string, party: RequestParty, dayKey: string): string {
  return `${caseId}|${itemId}|${requesterKeyOf(party)}|${dayKey}`;
}

interface StoredRequestFields {
  readonly checklistItemId: string;
  readonly requesterRole: CaseActorRole;
  readonly requesterUid: string;
  readonly recipient: CaseActorRole;
  readonly requestedAt: string;
  readonly dayKey: string;
}

function isRequester(entry: StoredRequestFields, viewer: RequestParty): boolean {
  return viewer.role === 'host' ? entry.requesterRole === 'host' : entry.requesterUid === viewer.uid;
}

/**
 * Α31 — τα αιτήματα που **αυτός** ο θεατής δικαιούται να δει: μόνο όσα ζήτησε ή όσα του ζητήθηκαν. Κανένα αίτημα
 * ανάμεσα σε τρίτους (ο οικοδεσπότης δεν μαθαίνει τι ζήτησε ο συμβολαιογράφος από τον δικηγόρο του αγοραστή).
 */
export function documentRequestViewsFor(requests: readonly StoredRequestFields[], viewer: RequestParty): readonly DocumentRequestView[] {
  return requests
    .filter((entry) => isRequester(entry, viewer) || entry.recipient === viewer.role)
    .map((entry) => ({
      itemId: entry.checklistItemId,
      recipient: entry.recipient,
      requestedAt: entry.requestedAt,
      dayKey: entry.dayKey,
      byViewer: isRequester(entry, viewer),
    }));
}

/** Οι γραμμές που **μπορεί** να ζητήσει τώρα με ένα πάτημα («Ζήτησε όλα τα ελλείποντα») — όχι όσες ζήτησε ήδη σήμερα. */
export function requestableNow(
  rows: readonly ChecklistRow[],
  targets: Readonly<Record<string, DocumentRequestTarget>>,
  log: readonly DocumentRequestView[],
  today: string,
): readonly ChecklistRow[] {
  return rows.filter((row) => {
    if (!isRequestableRow(row) || targets[row.itemId]?.ok !== true) return false;
    return !log.some((entry) => entry.itemId === row.itemId && entry.byViewer && entry.dayKey === today);
  });
}
