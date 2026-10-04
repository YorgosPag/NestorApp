/**
 * ADR-901 §14.8 — άγκυρα Α36: «μια όψη λαμβάνει σήμα ΑΝ ΚΑΙ ΜΟΝΟ ΑΝ η εγγραφή που άλλαξε είναι ορατή σε αυτήν».
 *
 * Τα αμετάβλητα ρωτούν τον **πραγματικό** κατάλογο (κάθε γραμμή × κάθε συντάκτη × κάθε θεατή) και τους **ίδιους**
 * κριτές με την όψη — ένα σήμα έξω από το ακροατήριο είναι διαρροή χρονισμού, ένα σήμα που λείπει είναι μπαγιάτικη
 * οθόνη. Και τα δύο κοκκινίζουν εδώ.
 */

import { CONVEYANCE_CHECKLIST } from '@/config/conveyance-checklist/catalog';
import type { ChecklistItem } from '@/config/conveyance-checklist/types';
import type { LegalProfessionalRole } from '@/types/legal-contracts';
import { reachesViewer, sentOnBehalf } from '../contribution-audience';
import { viewerSeesItem } from '../derive-checklist';
import { changeOfCommand, roleSeesChange, viewsAffectedBy, type CaseViewers } from '../view-signal-audience';
import { viewSignalSeed, type CaseViewKey } from '../view-signal-key';

const ROLES: readonly LegalProfessionalRole[] = ['seller_lawyer', 'buyer_lawyer', 'notary'];

const VIEWERS: CaseViewers = {
  host: { kind: 'host', propertyId: 'prop_1', companyId: 'comp_1' },
  engaged: ROLES.map((role) => ({ kind: 'engagement', engagementId: `eng_${role}`, uid: `u_${role}`, role })),
};

/** Ποιοι ρόλοι πήραν σήμα — `host` ή ο ρόλος της συμμετοχής. */
function signalledRoles(views: readonly CaseViewKey[]): readonly string[] {
  return views.map((v) => (v.kind === 'host' ? 'host' : v.engagementId.replace('eng_', ''))).sort();
}

function item(id: string): ChecklistItem {
  const found = CONVEYANCE_CHECKLIST.find((i) => i.id === id);
  if (!found) throw new Error(`catalog item ${id} missing`);
  return found;
}

describe('Α36 — transmittal: σήμα ΜΟΝΟ στο ακροατήριο της όψης (πραγματικός κατάλογος)', () => {
  it('🔑 αμετάβλητο: κάθε γραμμή × κάθε συντάκτης — κανένας επαγγελματίας έξω από reachesViewer ∩ visibleTo', () => {
    for (const checklistItem of CONVEYANCE_CHECKLIST) {
      for (const authorRole of ROLES) {
        const change = { kind: 'transmittal', authorRole, item: checklistItem } as const;
        const question = { authorRole, item: checklistItem };
        for (const viewer of ROLES) {
          const expected = viewer === authorRole || (reachesViewer(question, viewer) && viewerSeesItem(viewer, checklistItem));
          expect({ item: checklistItem.id, authorRole, viewer, signalled: roleSeesChange(change, viewer) })
            .toEqual({ item: checklistItem.id, authorRole, viewer, signalled: expected });
        }
        const hostExpected = reachesViewer(question, 'host') || sentOnBehalf(checklistItem);
        expect({ item: checklistItem.id, authorRole, host: roleSeesChange(change, 'host') }).toEqual({ item: checklistItem.id, authorRole, host: hostExpected });
      }
    }
  });

  it('η ΔΙΚΗ έκθεση του δικηγόρου αγοραστή ⇒ ΚΑΝΕΝΑ σήμα στον πωλητή (οικοδεσπότη) ή στον δικηγόρο του', () => {
    // Η γραμμή τη ΒΛΕΠΕΙ και ο δικηγόρος πωλητή (κάθε πλευρά έχει τη δική της έκθεση) — το ακροατήριο όμως όχι.
    const own = item('legal_due_diligence_report');
    expect(viewerSeesItem('seller_lawyer', own)).toBe(true);
    const views = viewsAffectedBy({ kind: 'transmittal', authorRole: 'buyer_lawyer', item: own }, VIEWERS);
    expect(signalledRoles(views)).not.toContain('host');
    expect(signalledRoles(views)).not.toContain('seller_lawyer');
    expect(signalledRoles(views)).toContain('buyer_lawyer');
  });

  it('έγγραφο ΕΝΤΟΛΕΑ (εκ μέρους) ⇒ ο οικοδεσπότης ΠΑΙΡΝΕΙ σήμα (σφραγισμένη παράδοση, Α35) — χωρίς ειδοποίηση', () => {
    const onBehalf = CONVEYANCE_CHECKLIST.find((i) => sentOnBehalf(i) && i.visibleTo.includes('notary'));
    if (!onBehalf) throw new Error('catalog has no on-behalf item visible to notary');
    const views = viewsAffectedBy({ kind: 'transmittal', authorRole: 'buyer_lawyer', item: onBehalf }, VIEWERS);
    expect(signalledRoles(views)).toEqual(['buyer_lawyer', 'host', 'notary']);
  });
});

describe('Α36 — αίτημα, γραμμή, υπόθεση, συμμετοχές', () => {
  it('αίτημα ⇒ ΜΟΝΟ αιτών και παραλήπτης (Α31): ο οικοδεσπότης δεν μαθαίνει αίτημα συμβολαιογράφου → δικηγόρου', () => {
    const views = viewsAffectedBy({ kind: 'request', parties: ['notary', 'buyer_lawyer'] }, VIEWERS);
    expect(signalledRoles(views)).toEqual(['buyer_lawyer', 'notary']);
  });

  it('εντολή γραμμής ⇒ ο οικοδεσπότης + ΜΟΝΟ όσοι βλέπουν τη γραμμή — σε κάθε γραμμή του καταλόγου', () => {
    for (const checklistItem of CONVEYANCE_CHECKLIST) {
      const roles = signalledRoles(viewsAffectedBy(changeOfCommand({ type: 'clear_override', itemId: checklistItem.id }), VIEWERS));
      const expected = ['host', ...ROLES.filter((r) => viewerSeesItem(r, checklistItem))].sort();
      expect({ item: checklistItem.id, roles }).toEqual({ item: checklistItem.id, roles: expected });
    }
  });

  it('γραμμή εκτός καταλόγου ⇒ μόνο ο οικοδεσπότης (fail-closed — καμία όψη δεν μαντεύεται)', () => {
    expect(signalledRoles(viewsAffectedBy(changeOfCommand({ type: 'clear_override', itemId: 'no_such_item' }), VIEWERS))).toEqual(['host']);
  });

  it('γεγονός · ημερομηνία υπογραφής · ακύρωση ⇒ όλες οι όψεις', () => {
    for (const command of [
      { type: 'answer_fact', factId: 'buyer_has_mortgage', value: true },
      { type: 'set_target_signing_date', date: '2026-11-01' },
      { type: 'cancel', reason: 'x' },
    ] as const) {
      expect(signalledRoles(viewsAffectedBy(changeOfCommand(command), VIEWERS))).toEqual(['buyer_lawyer', 'host', 'notary', 'seller_lawyer']);
    }
  });

  it('συμμετοχή ⇒ όλοι οι ενεργοί + η όψη της αλλαγμένης (και ανακλημένης), χωρίς διπλή αύξηση', () => {
    const revoked: CaseViewKey = { kind: 'engagement', engagementId: 'eng_old', uid: 'u_old' };
    const again: CaseViewKey = { kind: 'engagement', engagementId: 'eng_notary', uid: 'u_notary' };
    const views = viewsAffectedBy({ kind: 'roster' }, VIEWERS, [revoked, again]);
    expect(views.map(viewSignalSeed)).toHaveLength(new Set(views.map(viewSignalSeed)).size);
    expect(signalledRoles(views)).toEqual(['buyer_lawyer', 'host', 'notary', 'old', 'seller_lawyer']);
  });
});

describe('Α36 — ταυτότητα όψης', () => {
  it('η όψη οικοδεσπότη είναι ΑΝΑ ΑΚΙΝΗΤΟ ΚΑΙ ΧΩΡΟ — το άνοιγμα υπόθεσης φτάνει σε όποιον κοιτά το ακίνητο', () => {
    expect(viewSignalSeed({ kind: 'host', propertyId: 'prop_1', companyId: 'comp_1' }))
      .not.toBe(viewSignalSeed({ kind: 'host', propertyId: 'prop_1', companyId: 'comp_2' }));
    expect(viewSignalSeed({ kind: 'host', propertyId: 'prop_1', companyId: 'comp_1' })).toBe('conveyance-view:host:comp_1:prop_1');
  });

  it('η γραμμή που έστειλε ο ΙΔΙΟΣ φτάνει πάντα στη δική του όψη', () => {
    for (const authorRole of ROLES) {
      expect(roleSeesChange({ kind: 'transmittal', authorRole, item: item(CONVEYANCE_CHECKLIST[0].id) }, authorRole)).toBe(true);
    }
  });
});
