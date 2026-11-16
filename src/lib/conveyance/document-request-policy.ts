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
 * Σειρά: υπόθεση ζωντανή → γραμμή αιτήσιμη → ο αιτών τη βλέπει → πάροχος → παραλήπτης (`PROVIDER_FULFILMENT`)
 * → όχι ο ίδιος → ο παραλήπτης **βλέπει** τη γραμμή → είναι **ενεργός τώρα**.
 *
 * 🔑 Α29 **δομικά**: ο παραλήπτης δεν έρχεται ποτέ από το αίτημα· και πρέπει να βλέπει τη γραμμή — δικηγόρος αγοραστή
 *    δεν μαθαίνει ποτέ για γραμμή του πωλητή, ούτε ως αιτών (δεν τη βλέπει) ούτε ως παραλήπτης.
 * 🔑 Α31: το «εκκρεμεί» **παράγεται** (`pendingRequestOf`) — αιτήματα **μετά** το νεότερο τεκμήριο της γραμμής, όσο η
 *    γραμμή είναι ακόμη αιτήσιμη. Κανένα «κλείσιμο» με το χέρι.
 *
 * ADR-942 Φ0: ό,τι **δεν** εξαρτάται από τον κατάλογο της μεταβίβασης (σπόρος ταυτότητας, όψεις ανά θεατή, πυρήνας
 * του «εκκρεμεί») ζει στο `lib/document-requests/request-core.ts` και επανεξάγεται εδώ — εδώ μένει **μόνο** ο κριτής
 * της μεταβίβασης.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, χωρίς I/O.
 *
 * @module lib/conveyance/document-request-policy
 */

import type { ChecklistItem } from '@/config/conveyance-checklist/types';
import { fulfilmentOf } from '@/config/engagement-policy';
import {
  pendingFromLog,
  requestedTodayByViewer,
  type RequestParty as CoreRequestParty,
} from '@/lib/document-requests/request-core';
import type { CaseActorRole, ChecklistRow, ChecklistRowStatus, ConveyanceCaseState } from '@/types/conveyance-case';
import type {
  DocumentRequestTarget,
  DocumentRequestView,
  PendingDocumentRequest,
} from '@/types/conveyance-document-request';
import type { LegalProfessionalRole } from '@/types/legal-contracts';
import { acceptsEngagements } from './case-state';
import { contributionEntryPointIds } from './contribution-policy';
import { viewerSeesItem } from './derive-checklist';

export { documentRequestSeed, documentRequestViewsFor, requesterKeyOf } from '@/lib/document-requests/request-core';

/**
 * Οι καταστάσεις όπου κάτι **οφείλεται**: λείπει · επιστράφηκε · έληξε · λήγει (ζήτα την ανανέωση **πριν**) · άλλαξε
 * μετά τον έλεγχο · άγνωστη λήξη (ADR-915 §44 — ζήτα έγγραφο με ορατή έκδοση/λήξη).
 */
export const REQUESTABLE_STATUSES: readonly ChecklistRowStatus[] = ['missing', 'rejected', 'expired', 'expiring', 'expiry_unknown', 'stale'];

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
  const route = fulfilmentOf(item.provider).recipient;
  return route === 'own-side-lawyer' ? lawyerOfSide(requester) : route;
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
  if (!viewerSeesItem(requester, item)) return { ok: false, refusal: 'not-requestable' };
  const recipient = recipientOf(item, requester);
  if (recipient === null) return { ok: false, refusal: 'no-recipient' };
  if (recipient === requester) return { ok: false, refusal: 'self-provider' };
  if (!viewerSeesItem(recipient, item)) return { ok: false, refusal: 'no-recipient' };
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
  return pendingFromLog(log, row.itemId, newestEvidenceAt(row), today);
}

/** Ο αιτών/θεατής της μεταβίβασης — ο γενικός `RequestParty` (ADR-942) στενεμένος στους ρόλους της υπόθεσης. */
export type RequestParty = CoreRequestParty<CaseActorRole>;

/** Οι γραμμές που **μπορεί** να ζητήσει τώρα με ένα πάτημα («Ζήτησε όλα τα ελλείποντα») — όχι όσες ζήτησε ήδη σήμερα. */
export function requestableNow(
  rows: readonly ChecklistRow[],
  targets: Readonly<Record<string, DocumentRequestTarget>>,
  log: readonly DocumentRequestView[],
  today: string,
): readonly ChecklistRow[] {
  return rows.filter((row) => {
    if (!isRequestableRow(row) || targets[row.itemId]?.ok !== true) return false;
    return !requestedTodayByViewer(log, row.itemId, today);
  });
}
