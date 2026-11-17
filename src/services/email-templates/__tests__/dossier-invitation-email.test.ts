/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ EMAIL ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΦΑΚΕΛΟΥ ΙΔΙΩΤΗ** (ADR-916 Φ-Ε1) — πάνω στον κοινό σκελετό.
 *
 * - **Λ** κάθε γλώσσα έχει ΟΛΑ τα λόγια (άγκυρα που εκτελείται — και τις συναρτήσεις).
 * - **Ε** λέει ρόλο · φάκελο · καρτέλες · διάρκεια.
 * - **Κ** λέει **ποιος καλεί** (όνομα κατόχου, απόφαση 2026-11-17) — χωρίς όνομα ⇒ η ανώνυμη φράση, ποτέ κενό ή email.
 * - **Ι** τα ονόματα καρτελών = οι λέξεις της σελίδας του κατόχου (τα emails κρατούν inline κείμενο by design — η
 *   ισοτιμία δένεται εδώ) — **και** σε οικόπεδο, όπου η κάτοψη λέγεται «Τοπογραφικό» (`floorplanTabKind`).
 * - **Δ** χωρίς δημόσια διεύθυνση ⇒ `null` (ποτέ σύνδεσμος που δεν οδηγεί πουθενά).
 */

jest.mock('server-only', () => ({}));

import { readFileSync } from 'fs';
import { join } from 'path';

import { PROPERTY_DOSSIER_FILE_TABS } from '@/config/upload-entry-points/entries-property-dossier';
import { HUMAN_LANGUAGES } from '@/i18n/languages';
import { dossierTabWord, type FloorplanTabKind } from '@/lib/property-dossier/property-dossier-view';
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
  ownerName: 'Γεώργιος Παγώνης',
  dossierLabel: 'Σπίτι Καλαμαριάς',
  tabs: ['documents', 'floorplan'],
  floorplanKind: 'floorplan',
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

  it('Κ — ο παραλήπτης μαθαίνει ΠΟΙΟΣ τον καλεί, στο κείμενο και (τονισμένο, escaped) στο HTML', () => {
    const { text, html } = build({ ownerName: 'Γεώργιος <Παγώνης>' });
    expect(text).toContain('Γεώργιος <Παγώνης>, κάτοχος του φακέλου Σπίτι Καλαμαριάς, σας καλεί ως δικηγόρο του ιδιοκτήτη.');
    expect(html).toContain('<strong>Γεώργιος &lt;Παγώνης&gt;</strong>');
    expect(build({ language: 'en' }).text).toContain('Γεώργιος Παγώνης, owner of the property file');
  });

  it.each([null, '   '])('Κ — χωρίς όνομα (%p) ⇒ η ανώνυμη φράση, ποτέ κενό όνομα', (ownerName) => {
    const { text } = build({ ownerName });
    expect(text).toContain('Ο κάτοχος του φακέλου Σπίτι Καλαμαριάς σας καλεί ως δικηγόρο του ιδιοκτήτη.');
    expect(text).not.toMatch(/^\s*, κάτοχος/m);
  });

  it('Ε — φάκελος που δεν διαβάστηκε ⇒ λέξη, ποτέ κενό', () => {
    expect(build({ dossierLabel: null }).subject).toContain('του ακινήτου');
  });

  it('Ι — τα ονόματα καρτελών του email είναι ΛΕΞΗ ΠΡΟΣ ΛΕΞΗ αυτά της σελίδας του κατόχου, σε κάθε γλώσσα', () => {
    // Μετάλλαξη: «Floor plan» → «Floorplan» (ή «Site survey» → «Topographic plan») στο πρότυπο ⇒ το email λέει άλλη
    // λέξη από τη σελίδα που θα ανοίξει. Μετάλλαξη: το πρότυπο αγνοεί το `floorplanKind` ⇒ οικόπεδο με «Κάτοψη».
    // (Η ισοτιμία κατόχου ↔ επαγγελματία δένεται στο `dossier-tab-vocabulary-parity.test.ts`.)
    const KINDS: readonly FloorplanTabKind[] = ['floorplan', 'topographic'];
    for (const language of HUMAN_LANGUAGES) {
      const market = JSON.parse(readFileSync(join(process.cwd(), 'src/i18n/locales', language, 'property-market.json'), 'utf8')) as {
        readonly dossier: { readonly tabs: Readonly<Record<string, string>> };
      };
      for (const floorplanKind of KINDS) {
        const expected = PROPERTY_DOSSIER_FILE_TABS.map((tab) => market.dossier.tabs[dossierTabWord(tab, floorplanKind)]).join(' · ');
        expect(build({ language, floorplanKind, tabs: PROPERTY_DOSSIER_FILE_TABS }).text).toContain(expected);
      }
    }
  });

  it('Ι — οικόπεδο: η καρτέλα κάτοψης λέγεται «Τοπογραφικό», ποτέ «Κάτοψη»', () => {
    const { text } = build({ floorplanKind: 'topographic' });
    expect(text).toContain('Έγγραφα · Τοπογραφικό');
    expect(text).not.toContain('Κάτοψη');
  });

  it('Δ — χωρίς δημόσια διεύθυνση ⇒ `null`', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(buildDossierInvitationEmail(INPUT)).toBeNull();
  });
});
