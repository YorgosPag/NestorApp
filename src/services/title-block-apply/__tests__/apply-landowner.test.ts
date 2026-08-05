/**
 * @fileoverview 🔴 Οι τρεις θεραπείες απώλειας δεδομένων των οικοπεδούχων (ADR-745 Φ3β Γ4/Γ5/Γ6).
 *
 * Οργανωμένα κατά **αναλλοίωτο**, όχι κατά συνάρτηση: κάθε test ονομάζει το σενάριο απώλειας
 * που αποτρέπει, ώστε όποιος το κοκκινίσει να διαβάσει τι σπάει και όχι ποια γραμμή άλλαξε.
 */

const patched: Record<string, unknown>[] = [];

jest.mock('@/services/projects/project-mutation-gateway', () => ({
  __esModule: true,
  updateProjectWithPolicy: jest.fn(async ({ updates }: { updates: Record<string, unknown> }) => {
    patched.push(updates);
    return { success: true };
  }),
}));

jest.mock('../project-snapshot', () => ({
  __esModule: true,
  readProjectSnapshot: jest.fn(async () => ({
    id: 'proj_1',
    landowners: [
      {
        contactId: 'cont_existing',
        name: 'ΠΑΠΠΑΣ ΝΙΚΟΣ',
        landOwnershipPct: 50,
        allocatedShares: 500,
        // Δηλώθηκε στην καρτέλα ΑΦΟΥ άνοιξε η παλέτα. Αν γραφτεί πίσω το στιγμιότυπο, χάνεται.
        acquisitionStatus: 'under_contract',
      },
    ],
    addresses: [],
  })),
}));

import { applyLandownerTarget } from '../apply-landowner';
import type { BindingTarget } from '@/types/title-block-binding';

const target = {
  kind: 'landowner',
  projectId: 'proj_1',
  contactId: 'cont_new',
  acquisitionStatus: 'prospective',
} as Extract<BindingTarget, { kind: 'landowner' }>;

const ctx = (over: Record<string, unknown> = {}) => ({
  userId: 'u1',
  companyId: 'c1',
  snapshotValue: 'ΖΕΡΒΑ ΓΕΩΡΓΙΑ',
  landOwnershipPct: 50,
  ...over,
});

beforeEach(() => { patched.length = 0; });

describe('🔴 Γ4 — ΤΑ ΤΡΙΑ ΠΕΔΙΑ ΤΑΞΙΔΕΥΟΥΝ ΜΑΖΙ', () => {
  it('γράφεται το landownerContactIds — ο φύλακας διαγραφής επαφών το διαβάζει', async () => {
    // Χωρίς αυτό, οικοπεδούχος γραμμένος από τον καμβά είναι **αόρατος** στον
    // `contact-dependency-registry` (`array-contains`, `deletion: { mode: 'block' }`): η επαφή
    // διαγράφεται χωρίς προειδοποίηση και το πληρωμένο τοπογραφικό δείχνει σε ανύπαρκτο πρόσωπο.
    await applyLandownerTarget(target, ctx());
    expect(patched).toHaveLength(1);
    expect(patched[0].landownerContactIds).toEqual(['cont_existing', 'cont_new']);
  });
});

describe('🔴 ΤΡΙΤΗ ΑΠΩΛΕΙΑ — ΤΟ bartexPercentage ΠΟΥ Ο ΚΑΜΒΑΣ ΔΕΝ ΞΕΡΕΙ', () => {
  it('το κλειδί ΠΑΡΑΛΕΙΠΕΤΑΙ εντελώς — ποτέ `null`', async () => {
    // `updateProjectClient` προωθεί το payload **αυτούσιο** στο `apiClient.patch`· το φιλτράρισμα
    // `undefined` αφορά **μόνο** το realtime dispatch. Ένα `bartexPercentage: null` εδώ θα έσβηνε
    // την τιμή που δήλωσε ο χρήστης στην καρτέλα — audit-tracked, και τροφοδοτεί το
    // `ownership-calculation-engine`. Το `'preserve'` είναι ο φύλακας· αυτό το test είναι ο μάρτυράς του.
    await applyLandownerTarget(target, ctx());
    expect(Object.keys(patched[0])).not.toContain('bartexPercentage');
  });
});

describe('🔴 Γ5 — LOST UPDATE: ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΠΙΣΩ', () => {
  it('ο υπάρχων οικοπεδούχος ΕΠΙΒΙΩΝΕΙ με την κατάστασή του άθικτη', async () => {
    // Τα Firestore arrays αντικαθίστανται ΟΛΟΚΛΗΡΑ και το gateway δεν έχει συναλλαγή. Ο Λ2
    // πήρε στιγμιότυπο όταν άνοιξε η παλέτα· ο άνθρωπος κλικάρει λεπτά αργότερα.
    await applyLandownerTarget(target, ctx());
    const owners = patched[0].landowners as { contactId: string; acquisitionStatus?: string }[];
    const existing = owners.find((o) => o.contactId === 'cont_existing');
    expect(existing?.acquisitionStatus).toBe('under_contract');
  });

  it('ιδεοδύναμο: ο ΗΔΗ δηλωμένος δεν ξαναγράφεται — καμία υποβάθμιση υπογραφής', async () => {
    const already = { ...target, contactId: 'cont_existing' } as typeof target;
    const result = await applyLandownerTarget(already, ctx());
    expect(result.success).toBe(true);
    expect(patched).toHaveLength(0);
  });
});

describe('🔴 Γ6 — Η ΠΙΝΑΚΙΔΑ ΑΠΟΔΕΙΚΝΥΕΙ ΟΝΟΜΑ, ΠΟΤΕ ΜΕΡΙΔΙΟ', () => {
  it.each([
    ['απόν', undefined],
    ['μηδέν', 0],
    ['αρνητικό', -5],
    ['πάνω από 100', 140],
    ['NaN', Number.NaN],
  ])('ποσοστό %s ⇒ ΚΑΜΙΑ εγγραφή', async (_name, pct) => {
    const result = await applyLandownerTarget(target, ctx({ landOwnershipPct: pct }));
    expect(result.success).toBe(false);
    expect(patched).toHaveLength(0);
  });

  it('τα χιλιοστά ξαναμοιράζονται σε ΟΛΗ τη λίστα, όχι ανά γραμμή', async () => {
    // Κατανομή ανά γραμμή έδινε 999‰ σε τρία αδέλφια (changelog 2026-08-05). Ο νέος με 50%
    // δίπλα στον υπάρχοντα 50% ⇒ 500 + 500.
    await applyLandownerTarget(target, ctx());
    const owners = patched[0].landowners as { allocatedShares: number }[];
    expect(owners.reduce((s, o) => s + o.allocatedShares, 0)).toBe(1000);
  });
});
