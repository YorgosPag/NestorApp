/**
 * ADR-901 Φ4.5 §14.6 — «πώς γεννιέται η v2»: η νέα έκδοση ανεβαίνει από την πόρτα με τον **σκοπό του σταλμένου**,
 * ώστε ο **πραγματικός** κριτής διαδοχής (`judgeSuccession`) να τη δεχτεί ως το ίδιο δοχείο.
 *
 * Οι άγκυρες ρωτούν τον **πραγματικό** κατάλογο, το **πραγματικό** μητρώο entry points και τον **πραγματικό** κριτή —
 * όχι μια ενδιάμεση λίστα. Αν κάποιος «απλοποιήσει» την επιλογή σε «το πρώτο entry point της γραμμής», ή αλλάξει τη
 * θέση του ανεβάσματος, η v2 θα έβγαινε `identity-mismatch` και το «Στείλε τη νέα έκδοση» δεν θα εμφανιζόταν ποτέ.
 */

import { CONVEYANCE_CHECKLIST } from '@/config/conveyance-checklist/catalog';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { findEntryPoint } from '@/config/upload-entry-points/queries';
import type { UploadEntryPoint } from '@/config/upload-entry-points/types';
import { judgeSuccession } from '@/services/iso19650/container-succession-policy';
import { contributionEntryPointIds } from '../contribution-policy';
import { revisionEntryPoint } from '../contribution-revision';

const OWNER = 'u_notary';
const CASE_ID = 'cvc_1';

/** Οι γραμμές που δέχονται transmittal — από τον πραγματικό κατάλογο. */
const CONTRIBUTABLE = CONVEYANCE_CHECKLIST.filter((item) => contributionEntryPointIds(item).length > 0);

/** Ένα αρχείο υπόθεσης όπως το γράφει το `uploadEntityFile` από αυτή την πόρτα (μόνο τα πεδία που κρίνονται). */
function caseFile(entryPoint: UploadEntryPoint, createdAt: string): Record<string, unknown> {
  return {
    userId: OWNER, createdBy: OWNER, status: 'ready', lifecycleState: 'active', createdAt,
    entityType: ENTITY_TYPES.CONVEYANCE_CASE, entityId: CASE_ID,
    domain: entryPoint.domain, category: entryPoint.category, purpose: entryPoint.purpose,
  };
}

describe('revisionEntryPoint — η πόρτα της νέας έκδοσης', () => {
  it('ο κατάλογος έχει γραμμές transmittal (αλλιώς η σουίτα δεν ρωτά τίποτα)', () => {
    expect(CONTRIBUTABLE.length).toBeGreaterThan(0);
  });

  it.each(CONTRIBUTABLE.map((item) => [item.id, item] as const))('%s: κάθε σκοπός ⇒ η ΙΔΙΑ πόρτα (συμμετρία με τον server)', (_id, item) => {
    for (const id of contributionEntryPointIds(item)) {
      const sent = findEntryPoint(ENTITY_TYPES.CONVEYANCE_CASE, id);
      expect(sent).toBeDefined();
      if (!sent) continue;
      expect(revisionEntryPoint(item, sent.purpose)?.purpose).toBe(sent.purpose);
    }
  });

  it.each(CONTRIBUTABLE.map((item) => [item.id, item] as const))('%s: η v2 από αυτή την πόρτα ΠΕΡΝΑ τον πραγματικό κριτή διαδοχής', (_id, item) => {
    const sent = findEntryPoint(ENTITY_TYPES.CONVEYANCE_CASE, contributionEntryPointIds(item)[0] ?? '');
    if (!sent) throw new Error(`entry point της ${item.id} λείπει`);
    const door = revisionEntryPoint(item, sent.purpose);
    if (!door) throw new Error(`καμία πόρτα αναθεώρησης για ${item.id}`);
    const verdict = judgeSuccession({
      predecessor: caseFile(sent, '2026-10-01T10:00:00.000Z'),
      successor: caseFile(door, '2026-10-02T10:00:00.000Z'),
      predecessorId: 'file_v1',
      successorId: 'file_v2',
      actorUid: OWNER,
      actorCustody: { userId: OWNER },
      actsForOthers: false,
    });
    expect(verdict).toEqual({ ok: true, successorId: 'file_v2' });
  });

  it('άγνωστος σκοπός ⇒ καμία πόρτα (ποτέ μαντεψιά που ο κριτής θα αρνιόταν)', () => {
    const [item] = CONTRIBUTABLE;
    expect(revisionEntryPoint(item, 'no-such-purpose')).toBeUndefined();
  });

  it('γραμμή χωρίς transmittal ⇒ καμία πόρτα', () => {
    const plain = CONVEYANCE_CHECKLIST.find((item) => contributionEntryPointIds(item).length === 0);
    expect(plain).toBeDefined();
    if (plain) expect(revisionEntryPoint(plain, 'anything')).toBeUndefined();
  });
});
