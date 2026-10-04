/**
 * ADR-901 Φ4.5 — «Ζήτησε έγγραφο»: ο ΕΝΑΣ κριτής (server + client) και το παραγόμενο «εκκρεμεί».
 *
 * Ρωτά **τον πραγματικό κατάλογο** (πάροχος · `visibleTo` · `ownSideOnly`) — όχι πλαστές γραμμές με επινοημένους
 * παρόχους: η άγκυρα σπάει όταν αλλάζει ο κατάλογος ή ο πίνακας δρομολόγησης, που είναι ακριβώς το ζητούμενο.
 *
 * - **Α29** παραλήπτης από τον πάροχο — ποτέ από επιλογή· πρέπει να βλέπει τη γραμμή και να είναι ενεργός· ο
 *   δικηγόρος του αγοραστή ούτε ζητά ούτε δέχεται γραμμή του πωλητή
 * - **Α31** «εκκρεμεί» παράγεται: μετά το νεότερο τεκμήριο, όσο η γραμμή οφείλεται· το αίτημα το βλέπουν μόνο αιτών
 *   και παραλήπτης
 *
 * Κάθε `it` ονομάζει τη μετάλλαξη που πρέπει να πιάσει.
 */

import { getChecklistItem, itemsForProfile } from '@/config/conveyance-checklist/catalog';
import { CONVEYANCE_PROFILES, type ChecklistItem } from '@/config/conveyance-checklist/types';
import { contributionEntryPointIds, judgeContribution } from '../contribution-policy';
import { deriveChecklist } from '../derive-checklist';
import { DOCUMENT_REQUEST_BATCH_MAX } from '@/config/engagement-policy';
import type { ChecklistRow, ChecklistRowStatus, ConveyanceCaseState, EvidenceFile } from '@/types/conveyance-case';
import type { DocumentRequestView } from '@/types/conveyance-document-request';
import type { LegalProfessionalRole } from '@/types/legal-contracts';
import {
  documentRequestSeed,
  documentRequestViewsFor,
  judgeDocumentRequest,
  pendingRequestOf,
  requestableNow,
  requestTargetOf,
} from '../document-request-policy';

const ALL_ROLES: ReadonlySet<LegalProfessionalRole> = new Set(['seller_lawyer', 'buyer_lawyer', 'notary']);
const NONE: ReadonlySet<LegalProfessionalRole> = new Set();

function row(itemId: string, status: ChecklistRowStatus = 'missing', files: readonly EvidenceFile[] = []): ChecklistRow {
  const item = getChecklistItem(itemId);
  if (!item) throw new Error(`missing catalog item ${itemId}`);
  return {
    itemId, item, section: item.section, provider: item.provider, status, files, sealed: null,
    review: null, notApplicable: null, notApplicableBy: null, pendingFact: null, expiresOn: null, validOnSigning: null,
  };
}

function file(createdAt: string): EvidenceFile {
  return {
    source: { kind: 'owned' }, fileId: 'f1', displayName: 'x.pdf', entityType: 'property', entityId: 'p1', purpose: 'x',
    level: 'property', fingerprint: 'f1:0:', createdAt,
  };
}

/**
 * Α33 — έχει ο παραλήπτης **δρόμο** να ικανοποιήσει τη γραμμή; Επαγγελματίας ⇒ ο **ίδιος** κριτής αποστολής που τρέχει ο
 * server. Οικοδεσπότης ⇒ ανεβάζει σε οντότητα του χώρου του (matcher εκτός `contribution`) ή επιβεβαιώνει παραλαβή
 * (`offline` / `notary_issued` — δεν είναι αρχείο).
 */
function canFulfil(recipient: 'host' | LegalProfessionalRole, item: ChecklistItem): boolean {
  if (recipient === 'host') {
    return item.satisfaction.kind !== 'files' || item.satisfaction.matchers.some((m) => m.level !== 'contribution');
  }
  const [entryPointId] = contributionEntryPointIds(item);
  return entryPointId !== undefined && judgeContribution({ role: recipient, state: 'open', item, entryPointId }).ok;
}

/** Η γραμμή όπως είναι όταν **ισχύει** και δεν έχει ακόμη τίποτα — κατάσταση από τον ΠΡΑΓΜΑΤΙΚΟ πυρήνα, όχι επινοημένη. */
function owedRow(item: ChecklistItem): ChecklistRow {
  const facts = item.requirement.kind === 'when' ? { [item.requirement.fact]: item.requirement.equals } : {};
  return deriveChecklist({ items: [item], facts, overrides: {}, evidence: [], sealed: [], today: '2026-10-03', targetSigningDate: null, viewer: 'host' }).rows[0];
}

const judge = (itemId: string, requester: Parameters<typeof requestTargetOf>[0]['requester'], active = ALL_ROLES, state: ConveyanceCaseState = 'open') =>
  judgeDocumentRequest({ row: row(itemId), requester, state, activeRoles: active });

describe('Α29 — ο παραλήπτης παράγεται από τον πάροχο της γραμμής', () => {
  it('σχέδιο συμβολαίου (πάροχος: συμβολαιογράφος) ⇒ ο συμβολαιογράφος, από όποιον κι αν το ζητά (μετάλλαξη: λάθος δρομολόγηση)', () => {
    expect(judge('contract_draft', 'host')).toEqual({ ok: true, recipient: 'notary' });
    expect(judge('contract_draft', 'buyer_lawyer')).toEqual({ ok: true, recipient: 'notary' });
  });

  it('έγγραφο του πωλητή ⇒ ο οικοδεσπότης (η πλευρά του πωλητή) — από τον συμβολαιογράφο', () => {
    expect(judge('seller_enfia_certificate', 'notary')).toEqual({ ok: true, recipient: 'host' });
  });

  it('έγκριση δανείου (πάροχος: τράπεζα) ⇒ ο δικηγόρος του αγοραστή ως εκπρόσωπος (μετάλλαξη: «bank» χωρίς δρομολόγηση)', () => {
    expect(judge('buyer_mortgage_approval', 'notary')).toEqual({ ok: true, recipient: 'buyer_lawyer' });
  });

  it('έκθεση νομικού ελέγχου (ownSideOnly) ⇒ ο δικηγόρος ΤΗΣ ΔΙΚΗΣ ΜΟΥ πλευράς — ο οικοδεσπότης παίρνει τον δικηγόρο του πωλητή', () => {
    expect(judge('legal_due_diligence_report', 'host')).toEqual({ ok: true, recipient: 'seller_lawyer' });
    expect(judge('legal_due_diligence_report', 'buyer_lawyer')).toEqual({ ok: false, refusal: 'self-provider' });
  });

  it('🔴 δικηγόρος αγοραστή ⇏ γραμμή του πωλητή — δεν τη βλέπει, άρα ούτε τη ζητά (μετάλλαξη: κατάργηση ελέγχου ορατότητας αιτούντος)', () => {
    expect(judge('seller_enfia_certificate', 'buyer_lawyer')).toEqual({ ok: false, refusal: 'not-requestable' });
  });

  it('🔴 ο παραλήπτης ΠΡΕΠΕΙ να βλέπει τη γραμμή — ο συμβολαιογράφος δεν βλέπει την έκθεση των δικηγόρων (μετάλλαξη: κατάργηση ελέγχου ορατότητας παραλήπτη)', () => {
    expect(judge('legal_due_diligence_report', 'notary')).toEqual({ ok: false, refusal: 'not-requestable' });
  });

  it('🔴 δίχτυ: γραμμή που ο παραλήπτης ΔΕΝ βλέπει (αλλαγή `visibleTo` αύριο) ⇒ `no-recipient`, ποτέ ειδοποίηση για κάτι αόρατο (μετάλλαξη: κατάργηση ελέγχου παραλήπτη)', () => {
    const draft = row('contract_draft');
    const hidden = { ...draft, item: { ...draft.item, visibleTo: ['seller', 'seller_lawyer'] as const } };
    expect(judgeDocumentRequest({ row: hidden, requester: 'seller_lawyer', state: 'open', activeRoles: ALL_ROLES }))
      .toEqual({ ok: false, refusal: 'no-recipient' });
  });

  it('ΑΜΕΤΑΒΛΗΤΟ του καταλόγου: όποιος παραλήπτης παράγεται, ΒΛΕΠΕΙ τη γραμμή — για κάθε γραμμή × κάθε αιτούντα', () => {
    const requesters = ['host', 'seller_lawyer', 'buyer_lawyer', 'notary'] as const;
    for (const profile of CONVEYANCE_PROFILES) {
      for (const item of itemsForProfile(profile)) {
        for (const requester of requesters) {
          const target = requestTargetOf({ item, requester, state: 'open', activeRoles: ALL_ROLES });
          if (target.ok && target.recipient !== 'host') expect(item.visibleTo).toContain(target.recipient);
        }
      }
    }
  });

  it('🔴 Α33 ΑΜΕΤΑΒΛΗΤΟ ΕΚΠΛΗΡΩΣΗΣ: όποιος παραλήπτης παράγεται, ΜΠΟΡΕΙ να το ικανοποιήσει — κάθε γραμμή × κάθε αιτούντα (μετάλλαξη: `buyer.contributors = []`, το Π2)', () => {
    const requesters = ['host', 'seller_lawyer', 'buyer_lawyer', 'notary'] as const;
    const unfulfillable: string[] = [];
    for (const profile of CONVEYANCE_PROFILES) {
      for (const item of itemsForProfile(profile)) {
        const owed = owedRow(item);
        for (const requester of requesters) {
          const target = judgeDocumentRequest({ row: owed, requester, state: 'open', activeRoles: ALL_ROLES });
          if (target.ok && !canFulfil(target.recipient, item)) unfulfillable.push(`${item.id} ← ${requester} → ${target.recipient}`);
        }
      }
    }
    expect(unfulfillable).toEqual([]);
  });

  it('Π2 — έγγραφα αγοραστή/τράπεζας: ο δικηγόρος αγοραστή τα στέλνει, όχι μόνο τα δέχεται ως αίτημα', () => {
    for (const itemId of ['buyer_identity', 'buyer_payment_proofs', 'bank_property_valuation']) {
      expect(judge(itemId, 'host')).toEqual({ ok: true, recipient: 'buyer_lawyer' });
      expect(canFulfil('buyer_lawyer', row(itemId).item)).toBe(true);
    }
  });

  it('ρόλος που δεν συμμετέχει τώρα ⇒ `no-recipient`, ποτέ σιωπηλή ειδοποίηση στο κενό (μετάλλαξη: αγνόηση ενεργών ρόλων)', () => {
    expect(judge('buyer_mortgage_approval', 'host', NONE)).toEqual({ ok: false, refusal: 'no-recipient' });
    expect(judge('contract_draft', 'host', NONE)).toEqual({ ok: false, refusal: 'no-recipient' });
  });

  it('ο πάροχος ζητά από τον εαυτό του ⇒ `self-provider` (ο συμβολαιογράφος δεν «ζητά» το δικό του σχέδιο)', () => {
    expect(judge('contract_draft', 'notary')).toEqual({ ok: false, refusal: 'self-provider' });
    expect(judge('seller_enfia_certificate', 'host')).toEqual({ ok: false, refusal: 'self-provider' });
  });

  it('γραμμή που δεν οφείλεται (ελέγχθηκε) ⇒ `not-requestable` · κλειστή υπόθεση ⇒ `case-closed`', () => {
    expect(judgeDocumentRequest({ row: row('contract_draft', 'accepted'), requester: 'host', state: 'open', activeRoles: ALL_ROLES }))
      .toEqual({ ok: false, refusal: 'not-requestable' });
    expect(judge('contract_draft', 'host', ALL_ROLES, 'closed')).toEqual({ ok: false, refusal: 'case-closed' });
  });

  it('«από τον συμβολαιογράφο» (notary_side) ζητείται ΜΟΝΟ αν φτάνει μέσα από την πλατφόρμα (μετάλλαξη: notary_side πάντα / ποτέ)', () => {
    const ask = (itemId: string) => judgeDocumentRequest({ row: row(itemId, 'notary_side'), requester: 'host', state: 'open', activeRoles: ALL_ROLES });
    // σχέδιο συμβολαίου: στέλνεται με transmittal ⇒ «εκκρεμεί από τον συμβολαιογράφο» — το πιο συχνό αίτημα
    expect(ask('contract_draft')).toEqual({ ok: true, recipient: 'notary' });
    // πιστοποιητικό βαρών: το εκδίδει την ημέρα της πράξης, κανένας δρόμος στην πλατφόρμα ⇒ τίποτα να ζητηθεί
    expect(ask('encumbrance_certificate')).toEqual({ ok: false, refusal: 'not-requestable' });
  });

  it('μετά την υπογραφή ζητείται ακόμη ό,τι οφείλει ο συμβολαιογράφος (οριστικό · καταχώριση)', () => {
    expect(judge('cadastre_registration_proof', 'host', ALL_ROLES, 'signed')).toEqual({ ok: true, recipient: 'notary' });
  });
});

describe('Α30 — η ταυτότητα του αιτήματος (anti-spam ανά ημέρα)', () => {
  it('ο οικοδεσπότης είναι ΧΩΡΟΣ: δύο διαχειριστές την ίδια μέρα ⇒ ίδια ταυτότητα (μετάλλαξη: uid στον σπόρο του host)', () => {
    expect(documentRequestSeed('c1', 'contract_draft', { role: 'host', uid: 'u_a' }, '2026-10-03'))
      .toBe(documentRequestSeed('c1', 'contract_draft', { role: 'host', uid: 'u_b' }, '2026-10-03'));
  });

  it('άλλη μέρα ή άλλος επαγγελματίας ⇒ άλλη ταυτότητα', () => {
    const base = documentRequestSeed('c1', 'contract_draft', { role: 'seller_lawyer', uid: 'u_sl' }, '2026-10-03');
    expect(documentRequestSeed('c1', 'contract_draft', { role: 'seller_lawyer', uid: 'u_sl' }, '2026-10-04')).not.toBe(base);
    expect(documentRequestSeed('c1', 'contract_draft', { role: 'buyer_lawyer', uid: 'u_bl' }, '2026-10-03')).not.toBe(base);
  });

  it('«Ζήτησε όλα» χωράει ΠΑΝΤΑ σε ένα αίτημα: όλος ο κατάλογος ≤ όριο αιτήματος (μετάλλαξη: κατάλογος μεγαλώνει χωρίς όριο)', () => {
    for (const profile of CONVEYANCE_PROFILES) {
      expect(itemsForProfile(profile).length).toBeLessThanOrEqual(DOCUMENT_REQUEST_BATCH_MAX);
    }
  });
});

describe('Α31 — το «εκκρεμεί» παράγεται και το αίτημα το βλέπουν μόνο οι δύο', () => {
  const asked = (requestedAt: string, byViewer = true, dayKey = '2026-10-03'): DocumentRequestView => {
    const base = { itemId: 'contract_draft', recipient: 'notary', requestedAt, dayKey } as const;
    return byViewer ? { ...base, byViewer: true } : { ...base, byViewer: false, requester: 'host' };
  };

  it('αίτημα χωρίς τεκμήριο μετά ⇒ «εκκρεμεί από: συμβολαιογράφο» · ζητήθηκε σήμερα από μένα', () => {
    expect(pendingRequestOf(row('contract_draft'), [asked('2026-10-03T08:00:00.000Z')], '2026-10-03'))
      .toEqual({ recipient: 'notary', lastRequestedAt: '2026-10-03T08:00:00.000Z', requestedTodayByViewer: true, askedOfViewerBy: null });
  });

  it('🔴 Π1 — ζητήθηκε ΑΠΟ ΕΜΕΝΑ ⇒ «Σας ζητήθηκε από: <αιτών>», όχι «εκκρεμεί από: <εμένα>» (μετάλλαξη: αιτών που δεν ταξιδεύει)', () => {
    expect(pendingRequestOf(row('contract_draft'), [asked('2026-10-03T08:00:00.000Z', false)], '2026-10-03'))
      .toMatchObject({ askedOfViewerBy: 'host', requestedTodayByViewer: false });
  });

  it('🔴 ήρθε τεκμήριο μετά το αίτημα ⇒ κανένα «εκκρεμεί» — κλείνει μόνο του (μετάλλαξη: αγνόηση νεότερου τεκμηρίου)', () => {
    const rejected = row('contract_draft', 'rejected', [file('2026-10-03T09:00:00.000Z')]);
    expect(pendingRequestOf(rejected, [asked('2026-10-03T08:00:00.000Z')], '2026-10-03')).toBeNull();
  });

  it('γραμμή που ελέγχθηκε ⇒ κανένα «εκκρεμεί», όσα αιτήματα κι αν υπάρχουν', () => {
    expect(pendingRequestOf(row('contract_draft', 'accepted'), [asked('2026-10-03T08:00:00.000Z')], '2026-10-03')).toBeNull();
  });

  it('ήδη ζητημένο σήμερα από μένα ⇒ εκτός «Ζήτησε όλα» · χθεσινό ⇒ ξαναζητείται', () => {
    const rows = [row('contract_draft')];
    const targets = { contract_draft: { ok: true, recipient: 'notary' } as const };
    expect(requestableNow(rows, targets, [asked('2026-10-03T08:00:00.000Z')], '2026-10-03')).toEqual([]);
    expect(requestableNow(rows, targets, [asked('2026-10-02T08:00:00.000Z', true, '2026-10-02')], '2026-10-03')).toHaveLength(1);
  });

  const stored = (requesterRole: 'host' | LegalProfessionalRole, requesterUid: string, recipient: 'host' | LegalProfessionalRole) => ({
    checklistItemId: 'buyer_mortgage_approval', requesterRole, requesterUid, recipient, requestedAt: '2026-10-03T08:00:00.000Z', dayKey: '2026-10-03',
  });

  it('🔴 ο οικοδεσπότης ΔΕΝ βλέπει αίτημα συμβολαιογράφου → δικηγόρου αγοραστή (μετάλλαξη: όλα τα αιτήματα σε όλους)', () => {
    const notaryToBuyer = stored('notary', 'u_n', 'buyer_lawyer');
    expect(documentRequestViewsFor([notaryToBuyer], { role: 'host', uid: 'u_host' })).toEqual([]);
    expect(documentRequestViewsFor([notaryToBuyer], { role: 'seller_lawyer', uid: 'u_sl' })).toEqual([]);
  });

  it('αιτών και παραλήπτης το βλέπουν — ο αιτών ως «δικό μου»', () => {
    const notaryToBuyer = stored('notary', 'u_n', 'buyer_lawyer');
    expect(documentRequestViewsFor([notaryToBuyer], { role: 'notary', uid: 'u_n' })[0]?.byViewer).toBe(true);
    expect(documentRequestViewsFor([notaryToBuyer], { role: 'buyer_lawyer', uid: 'u_bl' })[0]).toMatchObject({ byViewer: false, requester: 'notary' });
  });

  it('ο αιτών ταξιδεύει ΜΟΝΟ προς τον παραλήπτη — στο «δικό μου» δεν υπάρχει πεδίο', () => {
    const [own] = documentRequestViewsFor([stored('notary', 'u_n', 'buyer_lawyer')], { role: 'notary', uid: 'u_n' });
    expect(own && 'requester' in own).toBe(false);
  });

  it('ο οικοδεσπότης είναι χώρος: αίτημα άλλου διαχειριστή = «δικό μας»', () => {
    expect(documentRequestViewsFor([stored('host', 'u_other_admin', 'notary')], { role: 'host', uid: 'u_host' })[0]?.byViewer).toBe(true);
  });
});
