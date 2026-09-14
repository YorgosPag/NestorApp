/**
 * @jest-environment node
 *
 * @fileoverview **ΠΟΙΟ ΟΝΟΜΑ ΛΕΕΙ Η ΑΓΓΕΛΙΑ** — ADR-841 §7 Α22.
 * @related services/company/company-public-name.reader.ts · services/mandate/agency-profile.service.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ ΠΟΥ ΓΕΝΝΗΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ (2026-09-14)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η κάρτα αγγελίας έλεγε *«Από γραφείο: ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.»* και ο
 * σύνδεσμός της οδηγούσε σε βιτρίνα με τίτλο *«Δοκιμαστικό Γραφείο Ο1-Ο9»* — **ίδιο**
 * `companyId`, **δύο** πηγές ονόματος. Εδώ κλειδώνονται η **σειρά προτεραιότητας** και η
 * **σημαία** που κάνει τη δημοσίευση να ξέρει πότε να ανανεώσει τις αγγελίες.
 *
 * ⚠️ **Η βάση δεν πλάθεται**: `FakeFirestore` + ο **αληθινός** γραφέας της βιτρίνας, ώστε
 * το έγγραφο να περνά τον **ίδιο** φρουρό (`readShowcase`) που περνά και στην παραγωγή.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { ShowcaseAuthority } from '@/lib/auth/brokerage-authority';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import {
  AgencyIdentityUnavailableError,
  createAgencyIdentityResolver,
  readPublicAgencyIdentity,
} from '@/services/company/company-public-name.reader';
import {
  publishShowcase,
  withdrawAgencyProfile,
  type ShowcaseDeclaration,
} from '@/services/mandate/agency-profile.service';
import type { ClassifiedOccupation } from '@/types/agency-profile';

const COMPANY = 'comp_grafeio_a';
const LEGAL_NAME = 'ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.';
const SHOWCASE_NAME = 'Δοκιμαστικό Γραφείο Ο1-Ο9';

/** ISCO `7131` ⇒ μη ρυθμιζόμενο — **καμία** ικανότητα, καμία απόδειξη να πλαστεί. */
const PAINTER: ClassifiedOccupation = {
  escoUri: 'http://data.europa.eu/esco/occupation/painter-fixture',
  label: { el: 'ελαιοχρωματιστής', en: 'painter' },
  iscoCode: '7131',
};

const AUTHORITY: ShowcaseAuthority = { kind: 'unregulated', companyId: COMPANY };

function declaration(displayName: string, coverage: ShowcaseDeclaration['coverage'] = null): ShowcaseDeclaration {
  return {
    alias: 'pagonis',
    displayName,
    credentials: [{ occupation: PAINTER, registrationNumber: '', registrationChapter: '' }],
    place: null,
    position: null,
    coverage,
  };
}

function db(): { fake: FakeFirestore; admin: AdminFirestore } {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.COMPANIES, COMPANY, { name: LEGAL_NAME });
  return { fake, admin: fake as unknown as AdminFirestore };
}

async function published(admin: AdminFirestore, displayName: string) {
  const result = await publishShowcase(admin, AUTHORITY, declaration(displayName));
  if (result.kind !== 'published') throw new Error(`το fixture οφείλει να δημοσιεύεται: ${result.kind}`);
  return result;
}

// ============================================================================
// Π — Η ΣΕΙΡΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ
// ============================================================================

describe('Π — ποιο όνομα φεύγει στην αγγελία', () => {
  it('🔴 Π1 — ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ: δημοσιευμένη βιτρίνα ⇒ το όνομα ΤΗΣ ΒΙΤΡΙΝΑΣ, όχι της εταιρείας', async () => {
    const { admin } = db();
    await published(admin, SHOWCASE_NAME);

    const identity = await readPublicAgencyIdentity(admin, COMPANY);

    expect(identity).toEqual({ id: COMPANY, name: SHOWCASE_NAME });
    // Ο παρονομαστής: η επωνυμία **υπάρχει** στη βάση — και παρ' όλα αυτά δεν φεύγει.
    expect(identity.name).not.toBe(LEGAL_NAME);
  });

  it('🔑 Π2 — ΧΩΡΙΣ βιτρίνα ⇒ η επωνυμία της εταιρείας (συμπεριφορά Α1, αμετάβλητη)', async () => {
    const { admin } = db();

    await expect(readPublicAgencyIdentity(admin, COMPANY)).resolves.toEqual({ id: COMPANY, name: LEGAL_NAME });
  });

  it('🔴 Π3 — ΑΠΟΣΥΡΣΗ ⇒ ξανά η επωνυμία: κανένα όνομα βιτρίνας που δεν υπάρχει πια', async () => {
    const { admin } = db();
    await published(admin, SHOWCASE_NAME);
    await withdrawAgencyProfile(admin, COMPANY);

    await expect(readPublicAgencyIdentity(admin, COMPANY)).resolves.toEqual({ id: COMPANY, name: LEGAL_NAME });
  });

  it('🔴 Π4 — ΑΓΝΩΣΤΟ ≠ ΚΕΝΟ: βιτρίνα που δεν διαβάστηκε ⇒ ΠΕΤΑ, ποτέ «πάρε την επωνυμία»', async () => {
    const { fake, admin } = db();
    await published(admin, SHOWCASE_NAME);
    fake.failReads = true;

    await expect(readPublicAgencyIdentity(admin, COMPANY)).rejects.toBeInstanceOf(AgencyIdentityUnavailableError);
  });

  it('Π5 — χωρίς ταυτότητα γραφείου ⇒ καμία ανάγνωση, καμία ταυτότητα', async () => {
    const { admin } = db();

    await expect(readPublicAgencyIdentity(admin, null)).resolves.toEqual({ id: null, name: null });
  });

  it('🔑 Π6 — ο επιλυτής του περάσματος δίνει ΤΟ ΙΔΙΟ όνομα σε κάθε αγγελία της εταιρείας', async () => {
    const { admin } = db();
    await published(admin, SHOWCASE_NAME);
    const resolve = createAgencyIdentityResolver(admin);

    const [first, second] = await Promise.all([resolve(COMPANY), resolve(COMPANY)]);

    expect(first).toEqual({ id: COMPANY, name: SHOWCASE_NAME });
    expect(second).toBe(first);
  });
});

// ============================================================================
// Σ — Η ΣΗΜΑΙΑ: ΠΟΤΕ ΧΡΕΙΑΖΕΤΑΙ ΑΝΑΝΕΩΣΗ ΤΩΝ ΑΓΓΕΛΙΩΝ
// ============================================================================

describe('Σ — `publicNameChanged`: ο γραφέας ξέρει αν άλλαξε το δημόσιο όνομα', () => {
  it('🔴 Σ1 — ΠΡΩΤΗ δημοσίευση ⇒ `true`: οι αγγελίες έλεγαν μέχρι τώρα την επωνυμία', async () => {
    const { admin } = db();

    expect((await published(admin, SHOWCASE_NAME)).publicNameChanged).toBe(true);
  });

  it('🔑 Σ2 — ΙΔΙΟ όνομα (επαναποθήκευση για άλλο πεδίο) ⇒ `false`: καμία επανασύνθεση της αγοράς', async () => {
    const { admin } = db();
    await published(admin, SHOWCASE_NAME);

    expect((await published(admin, SHOWCASE_NAME)).publicNameChanged).toBe(false);
  });

  it('🔴 Σ3 — ΜΕΤΟΝΟΜΑΣΙΑ ⇒ `true`', async () => {
    const { admin } = db();
    await published(admin, SHOWCASE_NAME);

    expect((await published(admin, LEGAL_NAME)).publicNameChanged).toBe(true);
  });

  it('🔑 Σ4 — κενά γύρω από το ίδιο όνομα ⇒ `false`: συγκρίνεται ό,τι ΓΡΑΦΤΗΚΕ, όχι ό,τι πληκτρολογήθηκε', async () => {
    const { admin } = db();
    await published(admin, SHOWCASE_NAME);

    expect((await published(admin, `  ${SHOWCASE_NAME}  `)).publicNameChanged).toBe(false);
  });
});
