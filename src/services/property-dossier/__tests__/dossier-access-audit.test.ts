/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 Φ-Ε1 — άγκυρες του **Ιστορικού της πρόσβασης** στον φάκελο (`dossier-access-audit.ts`) και της
 * **ανάγνωσής** του με λέξεις (δηλώσεις πεδίων · κατάλογοι · ετικέτες el/en · αποσυρμένα `invitation.<ρόλος>`).
 *
 * 🔑 Mock **μόνο** η εγγραφή στη βάση (`EntityAuditService.recordChange`). Οι δηλώσεις, οι κατάλογοι και τα locales είναι
 *    τα **πραγματικά** αρχεία.
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | γραφή σε οντότητα `engagement` / σε βιβλίο άλλου από τον κάτοχο | Ι1 · Ι2 |
 * | ωμό κλειδί πεδίου (`invitation.owner_lawyer`) αντί για το πεδίο του ρόλου | Ι1 |
 * | αποδοχή χωρίς λήξη · με «για λογαριασμό» (id γραφείου στον ιδιώτη) | Ι2 |
 * | εύρος ως ενωμένη συμβολοσειρά (`floorplan,documents`) · αρχείο χωρίς όνομα · γραμμή χωρίς αλλαγή | Ι3 |
 * | πεδίο του γραφέα χωρίς δήλωση ανάγνωσης / κατάλογο / ετικέτα σε μία γλώσσα | Α1 · Α2 |
 * | η παλιά γραμμή `invitation.<ρόλος>` πέφτει σε ωμό κλειδί | Α3 |
 */

import fs from 'fs';
import path from 'path';

jest.mock('server-only', () => ({}));
const mockRecord = jest.fn(async (..._args: unknown[]): Promise<string | null> => 'eaud_1');
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: (...args: unknown[]) => mockRecord(...args) },
}));

import { getDirectWrittenAuditFields } from '@/config/audit-direct-written-fields';
import { getRetiredFieldDef } from '@/config/audit-retired-fields';
import { getAuditValueCatalog } from '@/config/audit-value-catalogs';
import { activeDossierByInvitation } from '@/lib/auth/engagement-dossier-plan';
import { DOSSIER_ACCESS_AUDIT_FIELDS } from '@/lib/property-dossier/dossier-audit-fields';
import type { AuditFieldChange } from '@/types/audit-trail';
import type { DossierEngagement } from '@/types/engagement';
import { orgWorkspace } from '@/types/workspace-membership';
import {
  dossierAccessChanges,
  recordDossierAccessAccepted,
  recordDossierAccessChanged,
  recordDossierInvitationAudit,
} from '../dossier-access-audit';

const NOW = Date.parse('2026-11-18T10:00:00.000Z');
const DOSSIER = { id: 'pdos_1', userId: 'u_owner', label: 'Σπίτι' };
const OWNER = { uid: 'u_owner', email: 'owner@example.gr' };
const LAWYER = { uid: 'u_lawyer', email: 'l@example.gr' };

function engagement(overrides: Partial<DossierEngagement> = {}): DossierEngagement {
  return {
    ...activeDossierByInvitation({
      subject: { kind: 'property_dossier', dossierId: 'pdos_1' }, role: 'owner_lawyer', uid: 'u_lawyer',
      email: 'l@example.gr', invitationId: 'inv_1',
      declaredCredential: { authority: 'bar-association', number: '12345', chapter: 'Αθηνών', assurance: 'declared', declaredAt: new Date(NOW).toISOString() },
      actingFor: orgWorkspace('comp_office'),
      reach: { tabs: ['documents', 'floorplan'], excludedFileIds: [] }, shareDays: 30,
      offeredBy: 'u_owner', nowMs: NOW,
    }),
    ...overrides,
  };
}

function lastRecord(): { readonly entityType: string; readonly entityId: string; readonly userId: string; readonly action: string; readonly performedBy: string; readonly changes: AuditFieldChange[] } {
  const calls = mockRecord.mock.calls;
  return calls[calls.length - 1][0] as ReturnType<typeof lastRecord>;
}

beforeEach(() => mockRecord.mockClear());

describe('ADR-916 Φ-Ε1 — ο γραφέας γράφει στο Ιστορικό του ΦΑΚΕΛΟΥ, ένα πεδίο ανά ρόλο', () => {
  it('Ι1 — πρόσκληση · επαναποστολή · ακύρωση ⇒ `…DossierInvitation`, στον φάκελο, στο βιβλίο του κατόχου', async () => {
    await recordDossierInvitationAudit(DOSSIER, OWNER, 'notary', { kind: 'invited', email: 'n@example.gr' });
    expect(lastRecord()).toMatchObject({ entityType: 'property_dossier', entityId: 'pdos_1', userId: 'u_owner', action: 'updated', performedBy: 'u_owner' });
    expect(lastRecord().changes).toEqual([{ field: 'notaryDossierInvitation', oldValue: null, newValue: 'invited:n@example.gr' }]);

    await recordDossierInvitationAudit(DOSSIER, OWNER, 'owner_lawyer', { kind: 'resent', email: 'l@example.gr' });
    expect(lastRecord().changes[0]).toMatchObject({ field: 'ownerLawyerDossierInvitation', newValue: 'resent:l@example.gr' });

    await recordDossierInvitationAudit(DOSSIER, OWNER, 'owner_lawyer', { kind: 'revoked' });
    expect(lastRecord().changes[0]).toMatchObject({ field: 'ownerLawyerDossierInvitation', newValue: 'revoked' });
  });

  it('Ι2 — αποδοχή ⇒ κατάσταση + λήξη + ιδιότητα, με τον επαγγελματία ως δράστη· ΟΧΙ «για λογαριασμό»', async () => {
    const accepted = engagement();
    await recordDossierAccessAccepted(DOSSIER, LAWYER, accepted);
    expect(lastRecord()).toMatchObject({ entityType: 'property_dossier', userId: 'u_owner', action: 'created', performedBy: 'u_lawyer' });
    const fields = lastRecord().changes.map((change) => change.field);
    expect(fields).toEqual(['ownerLawyerDossierAccess', 'ownerLawyerDossierCredential', 'ownerLawyerDossierAccessUntil']);
    expect(lastRecord().changes[0]).toMatchObject({ oldValue: null, newValue: 'active' });
    expect(lastRecord().changes[1].newValue).toBe('12345 · Αθηνών');
    expect(lastRecord().changes[2].newValue).toBe(accepted.expiresAt);
  });

  it('Ι3 — εύρος ⇒ μία γραμμή ανά καρτέλα/αρχείο που μπήκε ή βγήκε, με το ΟΝΟΜΑ του αρχείου· καμία αλλαγή ⇒ καμία εγγραφή', async () => {
    const before = engagement();
    const after = { ...before, reach: { tabs: ['documents', 'photos'], excludedFileIds: ['file_deed'] } } as DossierEngagement;
    const changes = dossierAccessChanges(before, after, new Map([['file_deed', 'Τίτλος.pdf']]));
    expect(changes).toEqual([
      { field: 'ownerLawyerDossierReachTab', oldValue: null, newValue: 'photos' },
      { field: 'ownerLawyerDossierReachTab', oldValue: 'floorplan', newValue: null },
      { field: 'ownerLawyerDossierExcludedFile', oldValue: null, newValue: 'file_deed', newValueLabel: 'Τίτλος.pdf' },
    ]);

    const reordered = { ...before, reach: { tabs: ['floorplan', 'documents'], excludedFileIds: [] } } as DossierEngagement;
    const none = dossierAccessChanges(before, reordered, new Map());
    expect(none).toEqual([]);
    await recordDossierAccessChanged(DOSSIER, OWNER, 'updated', none);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('Ι3 — ανάκληση ⇒ μόνο η κατάσταση (λέξη του καταλόγου καταστάσεων)', () => {
    const before = engagement();
    const after = { ...before, state: 'revoked' } as DossierEngagement;
    expect(dossierAccessChanges(before, after, new Map())).toEqual([
      { field: 'ownerLawyerDossierAccess', oldValue: 'active', newValue: 'revoked' },
    ]);
  });
});

// =============================================================================
// Η ΑΝΑΓΝΩΣΗ — κάθε πεδίο του γραφέα διαβάζεται με λέξεις
// =============================================================================

const LOCALES = path.join(__dirname, '..', '..', '..', 'i18n', 'locales');

function locale(language: string, namespace: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(LOCALES, language, `${namespace}.json`), 'utf8')) as Record<string, unknown>;
}

function at(tree: Record<string, unknown>, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((node, key) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), tree);
}

const ALL_FIELDS = Object.values(DOSSIER_ACCESS_AUDIT_FIELDS).flatMap((fields) => Object.values(fields));

describe('ADR-916 Φ-Ε1 — η ανάγνωση: δηλώσεις · κατάλογοι · ετικέτες', () => {
  it('Α1 — κάθε πεδίο του γραφέα είναι δηλωμένο ως «γραμμένο απευθείας» στον φάκελο (⇒ φορτώνει το λεξιλόγιό του)', () => {
    expect(ALL_FIELDS).toHaveLength(16);
    expect([...getDirectWrittenAuditFields('property_dossier')].sort()).toEqual([...ALL_FIELDS].sort());
  });

  it.each(['el', 'en'])('Α2 — %s: ετικέτα για κάθε πεδίο· κατάλογος (μη κενός) για πρόσκληση · κατάσταση · καρτέλα', (language) => {
    const audit = locale(language, 'common-audit');
    for (const field of ALL_FIELDS) expect(typeof at(audit, `audit.fields.${field}`)).toBe('string');
    for (const fields of Object.values(DOSSIER_ACCESS_AUDIT_FIELDS)) {
      for (const field of [fields.invitation, fields.access, fields.reachTab]) {
        const catalog = getAuditValueCatalog(field);
        expect(catalog).toBeDefined();
        const words = at(locale(language, catalog?.ns ?? ''), catalog?.path ?? '');
        expect(Object.values(words as Record<string, unknown>).length).toBeGreaterThan(0);
        for (const word of Object.values(words as Record<string, unknown>)) expect(typeof word).toBe('string');
      }
    }
    expect(at(locale(language, 'property-market'), 'dossier.access.audit.invitation'))
      .toEqual(expect.objectContaining({ invited: expect.any(String), resent: expect.any(String), revoked: expect.any(String), pending: expect.any(String) }));
    expect(at(locale(language, 'conveyance'), 'engagement.states.revoked')).toEqual(expect.any(String));
  });

  it('Α3 — η παλιά γραμμή `invitation.<ρόλος>` διαβάζεται με την ετικέτα ΚΑΙ τον κατάλογο του νέου πεδίου', () => {
    for (const [role, fields] of Object.entries(DOSSIER_ACCESS_AUDIT_FIELDS)) {
      const def = getRetiredFieldDef('property_dossier', `invitation.${role}`);
      expect(def).toMatchObject({ labelKey: `audit.fields.${fields.invitation}`, enumCatalog: getAuditValueCatalog(fields.invitation) });
    }
  });
});
