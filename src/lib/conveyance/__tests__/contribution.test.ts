/**
 * ADR-901 Φ4.4 — Transmittal: κριτής (ρόλος × κατάσταση × γραμμή), ακροατήριο από τον ρόλο, αποστολές → τεκμήρια.
 *
 * Οι άγκυρες ρωτούν **τον πραγματικό κατάλογο** και τον **πραγματικό** πυρήνα `deriveChecklist` — δηλαδή αυτό που
 * θα δει ο άνθρωπος στη γραμμή, όχι μια ενδιάμεση λίστα.
 *
 * - **Α23** έκθεση του `buyer_lawyer` ⇒ ποτέ στον οικοδεσπότη ή στον `seller_lawyer`
 * - **Α24** πρόχειρο χωρίς αποστολή ⇒ κανένα τεκμήριο (δομικά: η είσοδος είναι μόνο αποστολές)
 * - **Α25** δικηγόρος μετά την υπογραφή ⇒ άρνηση · συμβολαιογράφος ⇒ ναι · κλείσιμο ⇒ κανείς
 */

import { getChecklistItem, itemsForProfile } from '@/config/conveyance-checklist/catalog';
import type { ChecklistItem } from '@/config/conveyance-checklist/types';
import type { ConveyanceContribution } from '@/types/conveyance-contribution';
import type { LegalProfessionalRole } from '@/types/legal-contracts';
import { reachesViewer, type CaseViewerRole } from '../contribution-audience';
import { contributionEvidence, currentContributions, type ActiveContributor, type ContributedFileState } from '../contribution-evidence';
import { contributableItemIds, judgeContribution } from '../contribution-policy';
import { deriveChecklist } from '../derive-checklist';

function item(id: string): ChecklistItem {
  const found = getChecklistItem(id);
  if (!found) throw new Error(`missing catalog item ${id}`);
  return found;
}

const UID: Readonly<Record<LegalProfessionalRole, string>> = { seller_lawyer: 'u_sl', buyer_lawyer: 'u_bl', notary: 'u_nt' };
const ALL_ACTIVE: readonly ActiveContributor[] = (Object.keys(UID) as LegalProfessionalRole[]).map((role) => ({ uid: UID[role], role }));

function contribution(role: LegalProfessionalRole, itemId: string, entryPointId: string, overrides: Partial<ConveyanceContribution> = {}): ConveyanceContribution {
  const fileId = overrides.file?.fileId ?? `file_${role}_${itemId}`;
  return {
    id: `ctb_${role}_${itemId}`, companyId: 'comp_host', caseId: 'cvc_1', projectId: 'proj_1',
    authorUid: UID[role], authorRole: role, authorEngagementId: `eng_${role}`, checklistItemId: itemId, entryPointId,
    file: { fileId, fingerprint: `${fileId}:0:2026-10-01`, displayName: 'doc.pdf', contentType: 'application/pdf' },
    supersedes: null, issuedAt: '2026-10-01T10:00:00.000Z', withdrawnAt: null, withdrawnBy: null,
    ...overrides,
  };
}

function filesOf(contributions: readonly ConveyanceContribution[]): ReadonlyMap<string, ContributedFileState> {
  return new Map(contributions.map((c) => [c.file.fileId, { fileId: c.file.fileId, ownerUid: c.authorUid, hasBytes: true }]));
}

const SELLER_REPORT = contribution('seller_lawyer', 'legal_due_diligence_report', 'case-legal-due-diligence');
const BUYER_REPORT = contribution('buyer_lawyer', 'legal_due_diligence_report', 'case-legal-due-diligence');
const NOTARY_DRAFT = contribution('notary', 'contract_draft', 'case-contract-draft');
const ALL = [SELLER_REPORT, BUYER_REPORT, NOTARY_DRAFT];

/** Τα αρχεία που βλέπει ο θεατής στη γραμμή — μέσα από τον ΠΡΑΓΜΑΤΙΚΟ πυρήνα. */
function rowFileIds(viewer: CaseViewerRole, itemId: string, contributions: readonly ConveyanceContribution[] = ALL): readonly string[] {
  const evidence = contributionEvidence({ contributions, activeContributors: ALL_ACTIVE, files: filesOf(contributions), viewer, viewerUid: null });
  const checklist = deriveChecklist({
    items: [item(itemId)], facts: {}, overrides: {}, evidence, today: '2026-10-03', targetSigningDate: null, viewer,
  });
  return checklist.rows[0]?.files.map((f) => f.fileId) ?? [];
}

describe('Α23 — ακροατήριο από τον ρόλο του συντάκτη', () => {
  it('η έκθεση του δικηγόρου του ΑΓΟΡΑΣΤΗ δεν φτάνει ποτέ στον οικοδεσπότη ούτε στον δικηγόρο του πωλητή', () => {
    expect(rowFileIds('host', 'legal_due_diligence_report')).toEqual([SELLER_REPORT.file.fileId]);
    expect(rowFileIds('seller_lawyer', 'legal_due_diligence_report')).toEqual([SELLER_REPORT.file.fileId]);
  });
  it('ο δικηγόρος του αγοραστή βλέπει ΜΟΝΟ τη δική του πλευρά', () => {
    expect(rowFileIds('buyer_lawyer', 'legal_due_diligence_report')).toEqual([BUYER_REPORT.file.fileId]);
  });
  it('η έκθεση του δικηγόρου του πωλητή δεν φτάνει στην πλευρά του αγοραστή', () => {
    expect(reachesViewer('seller_lawyer', 'buyer')).toBe(false);
    expect(reachesViewer('seller_lawyer', 'buyer_lawyer')).toBe(false);
  });
  it('το σχέδιο του συμβολαιογράφου φτάνει σε όλους, και στον οικοδεσπότη', () => {
    for (const viewer of ['host', 'seller', 'buyer', 'seller_lawyer', 'buyer_lawyer', 'notary'] as const) {
      expect(rowFileIds(viewer, 'contract_draft')).toEqual([NOTARY_DRAFT.file.fileId]);
    }
  });
});

describe('Α24 — πρόχειρο δεν γίνεται τεκμήριο', () => {
  it('χωρίς αποστολή: η γραμμή του συμβολαιογράφου μένει `notary_side`, όχι `uploaded`', () => {
    const checklist = deriveChecklist({
      items: [item('contract_draft')], facts: {}, overrides: {}, today: '2026-10-03', targetSigningDate: null, viewer: 'host',
      evidence: contributionEvidence({ contributions: [], activeContributors: ALL_ACTIVE, files: new Map(), viewer: 'host', viewerUid: null }),
    });
    expect(checklist.rows[0].status).toBe('notary_side');
  });
  it('αποσυρμένη αποστολή ⇒ κανένα τεκμήριο', () => {
    const withdrawn = { ...NOTARY_DRAFT, withdrawnAt: '2026-10-02T00:00:00.000Z', withdrawnBy: UID.notary };
    expect(rowFileIds('host', 'contract_draft', [withdrawn])).toEqual([]);
  });
  it('αρχείο που δεν ανήκει στον συντάκτη ⇒ κανένα τεκμήριο', () => {
    const files = new Map([[NOTARY_DRAFT.file.fileId, { fileId: NOTARY_DRAFT.file.fileId, ownerUid: 'someone_else', hasBytes: true }]]);
    expect(contributionEvidence({ contributions: [NOTARY_DRAFT], activeContributors: ALL_ACTIVE, files, viewer: 'host', viewerUid: null })).toEqual([]);
  });
  it('συντάκτης που δεν είναι πια ενεργός ⇒ τα δικά του δεν μετράνε', () => {
    const others = ALL_ACTIVE.filter((a) => a.role !== 'notary');
    expect(currentContributions([NOTARY_DRAFT], others)).toEqual([]);
  });
});

describe('νέα έκδοση — μετρά η νεότερη, η παλιά μένει στο ίχνος', () => {
  it('δύο αποστολές του ίδιου για την ίδια γραμμή ⇒ ένα τεκμήριο, το νεότερο', () => {
    const v2 = contribution('notary', 'contract_draft', 'case-contract-draft', {
      id: 'ctb_v2', supersedes: NOTARY_DRAFT.id, issuedAt: '2026-10-02T10:00:00.000Z',
      file: { fileId: 'file_v2', fingerprint: 'file_v2:1:2026-10-02', displayName: 'v2.pdf', contentType: 'application/pdf' },
    });
    expect(rowFileIds('host', 'contract_draft', [NOTARY_DRAFT, v2])).toEqual(['file_v2']);
  });
  it('`own` αληθεύει μόνο για τον συντάκτη', () => {
    const [mine] = contributionEvidence({ contributions: [NOTARY_DRAFT], activeContributors: ALL_ACTIVE, files: filesOf([NOTARY_DRAFT]), viewer: 'notary', viewerUid: UID.notary });
    const [theirs] = contributionEvidence({ contributions: [NOTARY_DRAFT], activeContributors: ALL_ACTIVE, files: filesOf([NOTARY_DRAFT]), viewer: 'host', viewerUid: 'u_host' });
    expect(mine.source).toMatchObject({ kind: 'transmittal', own: true });
    expect(theirs.source).toMatchObject({ kind: 'transmittal', own: false });
  });
});

describe('Α25 — κριτής: ρόλος × κατάσταση υπόθεσης × γραμμή', () => {
  const report = item('legal_due_diligence_report');
  const final = item('final_contract');
  it('δικηγόρος: ανοιχτή ⇒ ναι · υπογεγραμμένη ⇒ πάγωμα', () => {
    expect(judgeContribution({ role: 'buyer_lawyer', state: 'open', item: report, entryPointId: 'case-legal-due-diligence' })).toEqual({ ok: true });
    expect(judgeContribution({ role: 'buyer_lawyer', state: 'signed', item: report, entryPointId: 'case-legal-due-diligence' }))
      .toEqual({ ok: false, refusal: 'case-frozen' });
  });
  it('συμβολαιογράφος: μετά την υπογραφή και την καταχώριση ⇒ ναι · κλείσιμο/ακύρωση ⇒ όχι', () => {
    for (const state of ['open', 'signed', 'registered'] as const) {
      expect(judgeContribution({ role: 'notary', state, item: final, entryPointId: 'case-final-contract' })).toEqual({ ok: true });
    }
    for (const state of ['closed', 'cancelled'] as const) {
      expect(judgeContribution({ role: 'notary', state, item: final, entryPointId: 'case-final-contract' })).toEqual({ ok: false, refusal: 'case-frozen' });
    }
  });
  it('δικηγόρος δεν στέλνει έγγραφο συμβολαιογράφου · κανείς σε γραμμή χωρίς transmittal · λάθος entry point', () => {
    expect(judgeContribution({ role: 'seller_lawyer', state: 'open', item: final, entryPointId: 'case-final-contract' }))
      .toEqual({ ok: false, refusal: 'role-not-provider' });
    expect(judgeContribution({ role: 'notary', state: 'open', item: item('building_permit'), entryPointId: 'case-final-contract' }))
      .toEqual({ ok: false, refusal: 'not-contributable' });
    expect(judgeContribution({ role: 'notary', state: 'open', item: final, entryPointId: 'case-contract-draft' }))
      .toEqual({ ok: false, refusal: 'entry-point-mismatch' });
  });
  it('οι γραμμές «Αποστολή» κάθε ρόλου παράγονται από τον κατάλογο', () => {
    const items = itemsForProfile('new_build_company');
    expect(contributableItemIds('seller_lawyer', 'open', items)).toEqual(['legal_due_diligence_report']);
    expect(contributableItemIds('seller_lawyer', 'signed', items)).toEqual([]);
    expect([...contributableItemIds('notary', 'signed', items)].sort()).toEqual(
      ['cadastre_registration_proof', 'contract_draft', 'final_contract', 'transfer_tax_proof'],
    );
  });
});

describe('Α28 — «υπάρχει νεότερη έκδοση» ΜΟΝΟ στον συντάκτη', () => {
  const report = contribution('notary', 'contract_draft', 'case-contract-draft');
  const newer = new Map([[report.id, { displayName: 'σχέδιο-v2.pdf' }]]);
  const evidenceFor = (viewer: CaseViewerRole, viewerUid: string | null) =>
    contributionEvidence({ contributions: [report], activeContributors: ALL_ACTIVE, files: filesOf([report]), viewer, viewerUid, newerVersions: newer });

  it('ο συντάκτης βλέπει τη νεότερη έκδοση της στοίβας του', () => {
    expect(evidenceFor('notary', UID.notary)[0]?.source).toMatchObject({ kind: 'transmittal', own: true, newerVersion: { displayName: 'σχέδιο-v2.pdf' } });
  });

  it('🔴 οικοδεσπότης και άλλοι ρόλοι: ΚΑΝΕΝΑ πεδίο — ούτε καν `false` (μετάλλαξη: newerVersion σε κάθε θεατή)', () => {
    for (const [viewer, uid] of [['host', null], ['seller_lawyer', UID.seller_lawyer], ['buyer', null]] as const) {
      const source = evidenceFor(viewer, uid)[0]?.source;
      expect(source).toMatchObject({ kind: 'transmittal', own: false });
      expect(source && 'newerVersion' in source).toBe(false);
    }
  });

  it('χωρίς νεότερη έκδοση ⇒ `null`, όχι απουσία (ο συντάκτης ξέρει ότι ρωτήθηκε)', () => {
    const plain = contributionEvidence({ contributions: [report], activeContributors: ALL_ACTIVE, files: filesOf([report]), viewer: 'notary', viewerUid: UID.notary });
    expect(plain[0]?.source).toMatchObject({ own: true, newerVersion: null });
  });
});
