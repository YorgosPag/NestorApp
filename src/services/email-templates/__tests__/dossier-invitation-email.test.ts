/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ EMAIL ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΦΑΚΕΛΟΥ ΙΔΙΩΤΗ** (ADR-916 Φ-Ε1) — πάνω στον κοινό σκελετό.
 *
 * - **Λ** κάθε γλώσσα έχει ΟΛΑ τα λόγια (άγκυρα που εκτελείται — και τις συναρτήσεις).
 * - **Ε** λέει ρόλο · φάκελο · καρτέλες · διάρκεια — και **κανένα** στοιχείο του κατόχου.
 * - **Δ** χωρίς δημόσια διεύθυνση ⇒ `null` (ποτέ σύνδεσμος που δεν οδηγεί πουθενά).
 */

jest.mock('server-only', () => ({}));

import {
  buildDossierInvitationEmail,
  everyLanguageHasDossierInvitationWording,
  type DossierInvitationEmailInput,
} from '../dossier-invitation-email';

const ORIGIN = 'https://nestorconstruct.gr';
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_APP_URL = ORIGIN; });
afterAll(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

const INPUT: DossierInvitationEmailInput = {
  language: 'el',
  role: 'owner_lawyer',
  dossierLabel: 'Σπίτι Καλαμαριάς',
  tabs: ['documents', 'floorplan'],
  shareDays: 30,
  expiresAt: '2026-11-24T10:00:00.000Z',
  token: 'tok/+=',
};

const build = (patch: Partial<DossierInvitationEmailInput> = {}) => {
  const email = buildDossierInvitationEmail({ ...INPUT, ...patch });
  if (email === null) throw new Error('αναμενόταν email');
  return email;
};

describe('ADR-916 Φ-Ε1 — το email της πρόσκλησης φακέλου', () => {
  it('Λ — κάθε γλώσσα έχει όλα τα λόγια', () => {
    expect(everyLanguageHasDossierInvitationWording()).toBe(true);
  });

  it('Ε — ρόλος και φάκελος στο θέμα· καρτέλες και διάρκεια στο σώμα', () => {
    const { subject, text } = build();
    expect(subject).toContain('δικηγόρο του ιδιοκτήτη');
    expect(subject).toContain('Σπίτι Καλαμαριάς');
    expect(text).toContain('Έγγραφα · Κάτοψη');
    expect(text).toContain('30 ημέρες');
    expect(build({ language: 'en' }).subject).toContain("the owner's lawyer");
  });

  it('Ε — φάκελος που δεν διαβάστηκε ⇒ λέξη, ποτέ κενό', () => {
    expect(build({ dossierLabel: null }).subject).toContain('του ακινήτου');
  });

  it('Δ — χωρίς δημόσια διεύθυνση ⇒ `null`', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(buildDossierInvitationEmail(INPUT)).toBeNull();
  });
});
