/**
 * ADR-901 Φ4 §5.9 — η προβολή του ίχνους για τον επαγγελματία: **τι** βλέπει και **για ποιον**.
 * Κάθε `it` ονομάζει τη μετάλλαξη που πρέπει να πιάσει.
 */

import { CASE_REQUEST_FIELD, encodeCaseAccess, encodeCaseRequest, projectCaseActivity } from '../case-activity';
import type { EntityAuditEntry } from '@/types/audit-trail';

function access(id: string, by: string, fileId: string, mode: 'view' | 'download', role: 'seller_lawyer' | 'notary', at: string): EntityAuditEntry {
  return {
    id, entityType: 'conveyance_case', entityId: 'cvc_1', entityName: 'Δ3', action: 'document_accessed',
    changes: [
      { field: 'document', oldValue: null, newValue: fileId, label: `${fileId}.pdf` },
      { field: 'access', oldValue: null, newValue: encodeCaseAccess(mode, role) },
    ],
    performedBy: by, performedByName: `${by}@x.gr`, timestamp: at, companyId: 'comp_a',
  };
}

const ME = { uid: 'u_sl', role: 'seller_lawyer' as const, ownFiles: new Map([['file_mine', 'mine.pdf']]) };

describe('projectCaseActivity', () => {
  it('οι ΔΙΚΕΣ μου ενέργειες φαίνονται, νεότερη πρώτη', () => {
    const items = projectCaseActivity([
      access('a1', 'u_sl', 'file_x', 'view', 'seller_lawyer', '2026-10-01T10:00:00.000Z'),
      access('a2', 'u_sl', 'file_x', 'download', 'seller_lawyer', '2026-10-02T10:00:00.000Z'),
    ], ME);
    expect(items.map((i) => [i.id, i.kind, i.byViewer])).toEqual([['a2', 'downloaded', true], ['a1', 'viewed', true]]);
  });

  it('ποιος άνοιξε τα ΔΙΚΑ ΜΟΥ αρχεία — μόνο με τον ρόλο του, ΧΩΡΙΣ όνομα/email', () => {
    // Μετάλλαξη: φιλτράρισμα μόνο «δικές μου ενέργειες» ⇒ ο συντάκτης δεν μαθαίνει ποτέ ποιος είδε τη δουλειά του.
    const [item] = projectCaseActivity([access('b1', 'u_n', 'file_mine', 'view', 'notary', '2026-10-01T10:00:00.000Z')], ME);
    expect(item).toMatchObject({ byViewer: false, actorRole: 'notary', documentName: 'file_mine.pdf' });
    expect(JSON.stringify(item)).not.toMatch(/u_n|@x\.gr/);
  });

  it('τι άνοιξε ΑΛΛΟΣ σε αρχείο που ΔΕΝ είναι δικό μου ⇒ ΑΟΡΑΤΟ', () => {
    // Μετάλλαξη: προβολή όλου του βιβλίου ⇒ ο δικηγόρος βλέπει τι διαβάζει ο συμβολαιογράφος στα έγγραφα του οικοδεσπότη.
    expect(projectCaseActivity([access('c1', 'u_n', 'file_host', 'download', 'notary', '2026-10-01T10:00:00.000Z')], ME)).toEqual([]);
  });

  it('ενέργειες του οικοδεσπότη (άλλες πράξεις στο βιβλίο) ⇒ ΑΟΡΑΤΕΣ', () => {
    const hostEdit: EntityAuditEntry = {
      id: 'h1', entityType: 'conveyance_case', entityId: 'cvc_1', entityName: 'Δ3', action: 'updated',
      changes: [{ field: 'invitation.notary', oldValue: null, newValue: 'invited:n@x.gr' }],
      performedBy: 'u_host', performedByName: 'host', timestamp: '2026-10-01T10:00:00.000Z', companyId: 'comp_a',
    };
    expect(projectCaseActivity([hostEdit], ME)).toEqual([]);
  });

  it('κωδικοποίηση `access` που δεν αναγνωρίζεται ⇒ η εγγραφή παραλείπεται (ποτέ μαντεψιά ρόλου)', () => {
    const broken = access('d1', 'u_sl', 'file_x', 'view', 'seller_lawyer', '2026-10-01T10:00:00.000Z');
    const corrupt: EntityAuditEntry = { ...broken, changes: [broken.changes[0], { field: 'access', oldValue: null, newValue: 'view:janitor' }] };
    expect(projectCaseActivity([corrupt], ME)).toEqual([]);
  });
});

/** ADR-901 Φ4.5 (Α31) — τα αιτήματα εγγράφων στο ίχνος: μόνο ο αιτών και ο ρόλος-παραλήπτης. */
describe('projectCaseActivity — «Ζήτησε έγγραφο»', () => {
  function requested(id: string, by: string, pairs: ReadonlyArray<readonly [string, string]>): EntityAuditEntry {
    return {
      id, entityType: 'conveyance_case', entityId: 'cvc_1', entityName: 'Δ3', action: 'document_requested',
      changes: pairs.map(([itemId, label]) => ({ field: CASE_REQUEST_FIELD, oldValue: null, newValue: itemId, label })),
      performedBy: by, performedByName: null, timestamp: '2026-10-03T10:00:00.000Z', companyId: 'comp_a',
    };
  }

  it('ένα πάτημα για δύο γραμμές ⇒ δύο αντικείμενα «ζητήσατε … από: Συμβολαιογράφο» (μετάλλαξη: μία γραμμή ανά εγγραφή)', () => {
    const items = projectCaseActivity([requested('r1', 'u_sl', [
      ['contract_draft', encodeCaseRequest('seller_lawyer', 'notary')],
      ['transfer_tax_proof', encodeCaseRequest('seller_lawyer', 'notary')],
    ])], ME);
    expect(items.map((i) => [i.kind, i.itemId, i.actorRole, i.byViewer])).toEqual([
      ['requested', 'contract_draft', 'notary', true],
      ['requested', 'transfer_tax_proof', 'notary', true],
    ]);
  });

  it('ζητήθηκε από τον ΡΟΛΟ μου ⇒ «σας ζήτησε», με τον αιτούντα μόνο ως ρόλο', () => {
    const [item] = projectCaseActivity([requested('r2', 'u_host', [['legal_due_diligence_report', encodeCaseRequest('host', 'seller_lawyer')]])], ME);
    expect(item).toMatchObject({ kind: 'request-received', actorRole: 'host', byViewer: false, itemId: 'legal_due_diligence_report' });
  });

  it('🔴 αίτημα ανάμεσα σε τρίτους (συμβολαιογράφος → δικηγόρος αγοραστή) ⇒ ΑΟΡΑΤΟ (μετάλλαξη: προβολή κάθε αιτήματος)', () => {
    expect(projectCaseActivity([requested('r3', 'u_n', [['buyer_mortgage_approval', encodeCaseRequest('notary', 'buyer_lawyer')]])], ME)).toEqual([]);
  });

  it('κωδικοποίηση ρόλων που δεν αναγνωρίζεται ⇒ παραλείπεται (ποτέ μαντεψιά παραλήπτη)', () => {
    expect(projectCaseActivity([requested('r4', 'u_host', [['contract_draft', 'host>janitor']])], ME)).toEqual([]);
  });
});
