/**
 * ADR-916 Φ-Ε1 — άγκυρες του **τρίτου είδους** της μηχανής συμμετοχής: ο φάκελος ιδιώτη.
 *
 * Κάθε `it` ονομάζει τη μετάλλαξη που πρέπει να κοκκινίσει. Καθαρές συναρτήσεις — καμία βάση, κανένα mock.
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | το σχήμα δεν ξέρει το 3ο είδος / χάνει εύρος ή διάρκεια | Σ1 |
 * | εταιρικά πεδία γίνονται δεκτά ως πεδία φακέλου (ή απαιτούνται) | Σ2 · Σ3 |
 * | ρόλος μεταβίβασης/έκδοσης σε φάκελο · πρότυπο/εύρος CDE «μαντεμένα» | Σ4 |
 * | άγνωστη καρτέλα · διπλότυπη καρτέλα · διάρκεια εκτός μενού | Σ5 |
 * | η πρόσκληση φακέλου διαβάζεται ως μεταβίβαση / κρατά πεδία γραφείου | Π1 · Π2 |
 * | `planDossierChange` αγγίζει άλλο είδος · ανανεώνει ληγμένη · γράφει ίχνος χωρίς αλλαγή | Χ1–Χ5 |
 */

import { engagementInvitationFromDocument, engagementInvitationToDocument } from '../engagement-invitation-schema';
import { activeDossierByInvitation, planDossierChange } from '../engagement-dossier-plan';
import { parseEngagement } from '../engagement-schema';
import { dossierShareExpiresAt } from '@/config/engagement-policy';
import {
  TEMPLATE_OF_SUBJECT,
  isDossierEngagement,
  type ConveyanceEngagement,
  type DeclaredCredential,
  type DossierEngagement,
} from '@/types/engagement';
import { isDossierInvitation } from '@/types/engagement-invitation';
import { personalWorkspace } from '@/types/workspace-membership';

const NOW = Date.parse('2026-11-17T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const ISO = (ms: number) => new Date(ms).toISOString();
const CREDENTIAL: DeclaredCredential = {
  authority: 'notary-association', number: '4321', chapter: 'Αθηνών', assurance: 'declared', declaredAt: ISO(NOW),
};

function dossierEngagement(overrides: Partial<DossierEngagement> = {}): DossierEngagement {
  return {
    ...activeDossierByInvitation({
      subject: { kind: 'property_dossier', dossierId: 'pdos_1' },
      role: 'notary',
      uid: 'u_notary',
      email: 'n@example.gr',
      invitationId: 'inv_1',
      declaredCredential: CREDENTIAL,
      actingFor: personalWorkspace('u_notary'),
      reach: { tabs: ['documents', 'floorplan'], excludedFileIds: ['file_x'] },
      shareDays: 30,
      offeredBy: 'u_owner',
      nowMs: NOW,
    }),
    ...overrides,
  };
}

const conveyance: ConveyanceEngagement = {
  id: 'eng_c', hostCompanyId: 'comp_host', projectId: 'proj_1', uid: 'u_notary', email: 'n@example.gr',
  template: 'legal', role: 'notary', subject: { kind: 'conveyance_case', caseId: 'cvc_A' },
  scopes: ['conveyance:case:view'], state: 'active', expiresAt: ISO(NOW + 30 * DAY),
  origin: { kind: 'professional_appointment', contactId: 'cont_1' }, consents: [],
  offeredBy: 'u_host', offeredAt: ISO(NOW - DAY), respondedAt: null, revokedBy: null, closedAt: null, updatedAt: ISO(NOW - DAY),
};

describe('ADR-916 Φ-Ε1 — το σχήμα της συμμετοχής φακέλου (`parseEngagement`)', () => {
  it('Σ1 — συμμετοχή φακέλου διαβάζεται ΑΥΤΟΥΣΙΑ, με εύρος και διάρκεια', () => {
    const written = dossierEngagement();
    const read = parseEngagement(JSON.parse(JSON.stringify(written)));
    expect(read).toEqual(written);
    expect(read !== null && isDossierEngagement(read)).toBe(true);
  });

  it('Σ2 — πεδία γραφείου πάνω σε φάκελο ΔΕΝ περνούν στον τύπο (ο οικοδεσπότης είναι ο γονέας της διαδρομής)', () => {
    const raw = { ...dossierEngagement(), hostCompanyId: 'comp_x', projectId: 'proj_x' };
    const read = parseEngagement(raw);
    expect(read).not.toBeNull();
    expect(read).not.toHaveProperty('hostCompanyId');
    expect(read).not.toHaveProperty('projectId');
  });

  it('Σ3 — η μεταβίβαση εξακολουθεί να ΑΠΑΙΤΕΙ τα πεδία γραφείου (αμετάβλητη)', () => {
    expect(parseEngagement(conveyance)).toEqual(conveyance);
    const { hostCompanyId: _h, ...withoutHost } = conveyance;
    expect(parseEngagement(withoutHost)).toBeNull();
    // Πεδία φακέλου σε μεταβίβαση δεν «μολύνουν» τον τύπο της.
    expect(parseEngagement({ ...conveyance, reach: { tabs: ['documents'], excludedFileIds: [] }, shareDays: 30 })).toEqual(conveyance);
  });

  it('Σ4 — ρόλος άλλου είδους · πρότυπο/εύρος CDE που ΔΕΝ παράγει το είδος ⇒ μη αναγνώσιμο', () => {
    const base = dossierEngagement();
    expect(parseEngagement({ ...base, role: 'buyer_lawyer' })).toBeNull();
    expect(parseEngagement({ ...base, template: TEMPLATE_OF_SUBJECT.document_issuance })).toBeNull();
    expect(parseEngagement({ ...base, scopes: ['conveyance:case:view'] })).toBeNull();
    expect(parseEngagement({ ...base, origin: { kind: 'professional_appointment', contactId: 'c' } })).toBeNull();
  });

  it('Σ5 — καρτέλα εκτός καταλόγου · διπλότυπη καρτέλα · διάρκεια εκτός μενού ⇒ μη αναγνώσιμο', () => {
    const base = dossierEngagement();
    expect(parseEngagement({ ...base, reach: { tabs: ['secret'], excludedFileIds: [] } })).toBeNull();
    expect(parseEngagement({ ...base, reach: { tabs: ['documents', 'documents'], excludedFileIds: [] } })).toBeNull();
    expect(parseEngagement({ ...base, reach: { tabs: ['documents'], excludedFileIds: ['f', 'f'] } })).toBeNull();
    expect(parseEngagement({ ...base, shareDays: 365 })).toBeNull();
    const { reach: _r, ...withoutReach } = base;
    expect(parseEngagement(withoutReach)).toBeNull();
  });
});

describe('ADR-916 Φ-Ε1 — το σχήμα της πρόσκλησης φακέλου', () => {
  const stored = {
    inviteeEmail: 'n@example.gr', invitedByUid: 'u_owner', nonceHash: 'hash', state: 'pending',
    createdAt: ISO(NOW), expiresAt: ISO(NOW + 7 * DAY), openedAt: null, resolvedAt: null, resolvedByUid: null,
    mailboxProvenAt: null, credentialHint: { number: null, chapter: null }, reminderDueAt: ISO(NOW + 3 * DAY),
    reminderSentAt: null, subject: { kind: 'property_dossier', dossierId: 'pdos_1' }, role: 'owner_lawyer',
    reach: { tabs: ['documents'], excludedFileIds: [] }, shareDays: 7,
  };

  it('Π1 — διαβάζεται ως φάκελος (όχι ως μεταβίβαση), και γράφεται πίσω με το `subject` του', () => {
    const invitation = engagementInvitationFromDocument(stored, 'inv_1');
    expect(invitation).not.toBeNull();
    expect(invitation !== null && isDossierInvitation(invitation)).toBe(true);
    if (invitation === null) return;
    expect(engagementInvitationToDocument(invitation)).toEqual({ ...stored, id: 'inv_1' });
  });

  it('Π2 — πεδία γραφείου πάνω σε πρόσκληση φακέλου αφαιρούνται· κανείς δεν μπορεί να τα διαβάσει', () => {
    const invitation = engagementInvitationFromDocument({ ...stored, hostCompanyId: 'comp_x', projectId: 'p', contactId: 'c' }, 'inv_1');
    expect(invitation).not.toBeNull();
    expect(invitation).not.toHaveProperty('hostCompanyId');
    expect(invitation).not.toHaveProperty('contactId');
  });

  it('Π3 — ρόλος εκτός φακέλου · καρτέλα εκτός καταλόγου · διάρκεια εκτός μενού ⇒ `null`', () => {
    expect(engagementInvitationFromDocument({ ...stored, role: 'buyer_lawyer' }, 'x')).toBeNull();
    expect(engagementInvitationFromDocument({ ...stored, reach: { tabs: ['secret'], excludedFileIds: [] } }, 'x')).toBeNull();
    expect(engagementInvitationFromDocument({ ...stored, shareDays: 14 }, 'x')).toBeNull();
  });
});

describe('ADR-916 Φ-Ε1 — οι πράξεις του κατόχου (`planDossierChange`, καθαρές)', () => {
  it('Χ1 — ανανέωση: νέα διάρκεια ΑΠΟ ΣΗΜΕΡΑ, το εύρος μένει', () => {
    const before = dossierEngagement();
    const later = NOW + 10 * DAY;
    const plan = planDossierChange(before, { kind: 'renew', shareDays: 90 }, later);
    expect(plan.outcome).toBe('changed');
    if (plan.outcome !== 'changed') return;
    expect(plan.after.expiresAt).toBe(dossierShareExpiresAt(90, later));
    expect(plan.after.shareDays).toBe(90);
    expect(plan.after.reach).toEqual(before.reach);
  });

  it('Χ2 — ανανέωση ληγμένης/ανακλημένης ⇒ `not-allowed` (ποτέ ανάσταση)', () => {
    expect(planDossierChange(dossierEngagement({ state: 'expired' }), { kind: 'renew', shareDays: 30 }, NOW).outcome).toBe('not-allowed');
    expect(planDossierChange(dossierEngagement({ state: 'revoked' }), { kind: 'renew', shareDays: 30 }, NOW).outcome).toBe('not-allowed');
  });

  it('Χ3 — αλλαγή εύρους: νέες καρτέλες/εξαιρέσεις, η λήξη ΔΕΝ μετακινείται', () => {
    const before = dossierEngagement();
    const plan = planDossierChange(before, { kind: 'reach', reach: { tabs: ['photos'], excludedFileIds: [] } }, NOW + DAY);
    expect(plan.outcome).toBe('changed');
    if (plan.outcome !== 'changed') return;
    expect(plan.after.reach).toEqual({ tabs: ['photos'], excludedFileIds: [] });
    expect(plan.after.expiresAt).toBe(before.expiresAt);
  });

  it('Χ4 — ίδιο εύρος (άλλη σειρά) ⇒ `noop`: κανένα ίχνος χωρίς αλλαγή', () => {
    const before = dossierEngagement();
    const same = { tabs: [...before.reach.tabs].reverse(), excludedFileIds: [...before.reach.excludedFileIds] };
    expect(planDossierChange(before, { kind: 'reach', reach: same }, NOW).outcome).toBe('noop');
    expect(planDossierChange(dossierEngagement({ state: 'expired' }), { kind: 'reach', reach: same }, NOW).outcome).toBe('not-allowed');
  });

  it('Χ5 — συμμετοχή ΑΛΛΟΥ είδους ⇒ `not-allowed` (η λήξη υπόθεσης γραφείου δεν «ανανεώνεται»)', () => {
    expect(planDossierChange(conveyance, { kind: 'renew', shareDays: 90 }, NOW).outcome).toBe('not-allowed');
    expect(planDossierChange(conveyance, { kind: 'reach', reach: { tabs: ['photos'], excludedFileIds: [] } }, NOW).outcome).toBe('not-allowed');
  });

  it('Χ6 — το εύρος της συμμετοχής είναι ΑΝΤΙΓΡΑΦΟ, ποτέ αναφορά στο αντικείμενο του καλούντα', () => {
    const reach = { tabs: ['photos' as const], excludedFileIds: [] as string[] };
    const plan = planDossierChange(dossierEngagement(), { kind: 'reach', reach }, NOW);
    reach.excludedFileIds.push('mutated');
    expect(plan.outcome === 'changed' && plan.after.reach.excludedFileIds).toEqual([]);
  });
});
