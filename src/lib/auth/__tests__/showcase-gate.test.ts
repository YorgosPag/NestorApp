/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΦΡΟΥΡΟΣ ΤΗΣ ΒΙΤΡΙΝΑΣ** — η άγκυρα Κ-Α2 του ADR-841 Φ6-Β.
 * @related lib/auth/brokerage-gate.ts · lib/auth/brokerage-authority.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΟΝ ΓΡΑΦΕΑ — ΜΕΤΡΗΜΕΝΟ ΚΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο γραφέας δοκιμάζεται με **έτοιμη** {@link ShowcaseAuthority}, δηλαδή κάποιος
 * του λέει ήδη *ποια* παραλλαγή είναι. Η μετάλλαξη *«κάνε τα πάντα
 * `regulated`»* μέσα στον `gateShowcase` **βγήκε πράσινη** σε ολόκληρο το
 * `src/services/mandate` — γιατί εκεί κανείς δεν ρωτά **ποιος αποφασίζει την
 * παραλλαγή**.
 *
 * 🔑 Και η ερώτηση δεν είναι ακαδημαϊκή: με τον φρουρό «σε όλους», ο
 * **ελαιοχρωματιστής χρειάζεται άδεια μεσιτείας** για να εμφανιστεί στον
 * κατάλογο. Η απουσία μητρώου θα γινόταν **ποινή** *(Α9.3)*, και ο κατάλογος
 * επαγγελματιών θα ήταν κατάλογος **μεσιτών με άλλο όνομα**.
 *
 * ⚠️ **Η βάση δεν πλάθεται**: `FakeFirestore` με πραγματικές εγγραφές
 * `companies/{id}.capabilities`. Ο φρουρός εκτελεί την **αληθινή** ανάγνωση.
 */

import { NextResponse } from 'next/server';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { gateShowcase } from '@/lib/auth/brokerage-gate';
import { showcaseOwnerId } from '@/lib/auth/brokerage-authority';
import type { ClassifiedOccupation } from '@/types/agency-profile';
import type { CapabilityStatus, OrganizationCapabilities } from '@/types/organization-capability';

const COMPANY = 'comp_grafeio_a';

const BROKER: ClassifiedOccupation = {
  escoUri: 'http://data.europa.eu/esco/occupation/8ec8df02-e9dd-43b7-b416-5846ae0414ab',
  label: { el: 'μεσίτης ακίνητης περιουσίας/μεσίτρια ακίνητης περιουσίας', en: 'real estate agent' },
  iscoCode: '3334',
};
/** ISCO `7131` → `authority: null` — **ρητό** «δεν τηρείται μητρώο». */
const PAINTER: ClassifiedOccupation = {
  escoUri: 'http://data.europa.eu/esco/occupation/painter-fixture',
  label: { el: 'ελαιοχρωματιστής', en: 'painter' },
  iscoCode: '7131',
};
/** ISCO `2611` → `bar-association`: **έχει** μητρώο, **δεν** είναι ρυθμιζόμενη πράξη. */
const LAWYER: ClassifiedOccupation = {
  escoUri: 'http://data.europa.eu/esco/occupation/lawyer-fixture',
  label: { el: 'δικηγόρος', en: 'lawyer' },
  iscoCode: '2611',
};

function capabilities(status: CapabilityStatus): OrganizationCapabilities {
  return {
    brokerage_listings: {
      status,
      requirements: [],
      declaration: null,
      decidedByUserId: status === 'unrequested' ? null : 'user-super',
      decidedAt: status === 'unrequested' ? null : '2026-08-20T10:00:00.000Z',
      revocationReason: null,
    },
  };
}

/**
 * @param status `null` ⇒ ο οργανισμός **δεν έχει καθόλου** εγγραφή ικανοτήτων —
 *   η **συνηθισμένη** κατάσταση κάθε γραφείου που δεν είναι μεσιτικό.
 */
function db(status: CapabilityStatus | null): AdminFirestore {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.COMPANIES, COMPANY, {
    name: 'ΠΑΓΩΝΗΣ Ι.Κ.Ε.',
    ...(status === null ? {} : { capabilities: capabilities(status) }),
  });
  return fake as unknown as AdminFirestore;
}

describe('Κ-Α2 — ο φρουρός ρωτά ΤΟ ΕΠΑΓΓΕΛΜΑ, όχι τον καλούντα', () => {
  it('🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο ελαιοχρωματιστής περνά ΧΩΡΙΣ ΚΑΜΙΑ ικανότητα', async () => {
    // 🔴 **Η ΑΓΚΥΡΑ.** Αν κάποιος βάλει τον φρουρό «σε όλους», αυτό κοκκινίζει.
    const verdict = await gateShowcase(db(null), COMPANY, [PAINTER]);

    expect(verdict).not.toBeInstanceOf(NextResponse);
    expect(verdict).toEqual({ kind: 'unregulated', companyId: COMPANY });
  });

  it('🔑 Και ο ΔΙΚΗΓΟΡΟΣ επίσης — «έχει μητρώο» ΔΕΝ σημαίνει «ρυθμιζόμενη πράξη»', async () => {
    // 🔑 Η διάκριση που εύκολα ισοπεδώνεται: το `bar-association` είναι **αρχή**,
    //    αλλά η προβολή δικηγόρου δεν είναι δραστηριότητα που ρυθμίζει η
    //    πλατφόρμα. **Μόνο** το `gemi` πυροδοτεί ικανότητα.
    const verdict = await gateShowcase(db(null), COMPANY, [LAWYER]);

    expect(verdict).toEqual({ kind: 'unregulated', companyId: COMPANY });
  });

  it('🔴 Ο ΜΕΣΙΤΗΣ ΧΩΡΙΣ ΕΝΕΡΓΗ ΙΚΑΝΟΤΗΤΑ ΠΑΙΡΝΕΙ 403, με τον λόγο του', async () => {
    for (const status of ['unrequested', 'pending', 'revoked'] as const) {
      const verdict = await gateShowcase(db(status), COMPANY, [BROKER]);

      expect(verdict).toBeInstanceOf(NextResponse);
      if (verdict instanceof NextResponse) {
        expect(verdict.status).toBe(403);
        const body = await verdict.json();
        expect(body.error).toBe('BROKERAGE_NOT_ALLOWED');
        // ⚠️ Το `capabilityStatus` ταξιδεύει: τρεις καταστάσεις, **τρεις**
        //    διαφορετικές θεραπείες στην οθόνη.
        expect(body.capabilityStatus).toBe(status);
        expect(body.reason).not.toBe('');
      }
    }
  });

  it('🔑 Ο ΜΕΣΙΤΗΣ ΜΕ ΕΝΕΡΓΗ ΙΚΑΝΟΤΗΤΑ ΠΕΡΝΑ — και η απόδειξη κουβαλά ΤΟ ΔΙΚΟ ΤΟΥ κλειδί', async () => {
    const verdict = await gateShowcase(db('active'), COMPANY, [BROKER]);

    expect(verdict).not.toBeInstanceOf(NextResponse);
    if (!(verdict instanceof NextResponse)) {
      expect(verdict.kind).toBe('regulated');
      // 🔴 Το κλειδί βγαίνει **μία** φορά, από την απόδειξη — ποτέ από το σώμα.
      expect(showcaseOwnerId(verdict)).toBe(COMPANY);
    }
  });

  it('🔴 ΤΟ ΜΙΚΤΟ ΓΡΑΦΕΙΟ ΔΕΝ ΓΛΙΤΩΝΕΙ: ΕΝΑ ρυθμιζόμενο credential κρίνει ΟΛΗ τη βιτρίνα', async () => {
    // 🔑 Η ύπουλη διαφυγή: *«είμαι και διακοσμητής, άρα μη με κρίνεις»*. Ένα
    //    `every` αντί για `some` θα την άνοιγε — και ο ανακληθείς μεσίτης θα
    //    ξαναδημοσίευε βάζοντας δεύτερη, ελεύθερη ειδικότητα.
    const verdict = await gateShowcase(db('revoked'), COMPANY, [PAINTER, BROKER]);

    expect(verdict).toBeInstanceOf(NextResponse);
    if (verdict instanceof NextResponse) expect(verdict.status).toBe(403);
  });

  it('🔴 FAIL-CLOSED: μη ρυθμιζόμενη βιτρίνα ΧΩΡΙΣ οργανισμό δεν γράφεται', async () => {
    // Δομικά απίθανο (ο `withAuth` εγγυάται μισθωτή), και **γι' αυτό** ελέγχεται:
    // σιωπηλή διέλευση θα έγραφε βιτρίνα **χωρίς ιδιοκτήτη**, δηλαδή έγγραφο σε
    // κενό κλειδί.
    for (const tenant of [null, '', '   ']) {
      const verdict = await gateShowcase(db(null), tenant, [PAINTER]);

      expect(verdict).toBeInstanceOf(NextResponse);
      if (verdict instanceof NextResponse) {
        expect(verdict.status).toBe(403);
        expect((await verdict.json()).error).toBe('SHOWCASE_NO_ORGANIZATION');
      }
    }
  });

  it('🔴 ΚΑΜΙΑ ΕΙΔΙΚΟΤΗΤΑ ⇒ ΜΗ ΡΥΘΜΙΖΟΜΕΝΗ — ο φρουρός ΔΕΝ είναι ο κριτής του περιεχομένου', async () => {
    // ⚠️ Κενός πίνακας **δεν** είναι δουλειά του φρουρού: το *«βιτρίνα χωρίς
    //    ειδικότητα»* το απαντά ο **γραφέας**, ονομαστικά
    //    (`agency-profile-occupation-missing`). Ένα 403 εδώ θα έστελνε τον
    //    άνθρωπο στις **ρυθμίσεις ικανότητας** για ένα κενό πεδίο φόρμας.
    const verdict = await gateShowcase(db(null), COMPANY, []);

    expect(verdict).toEqual({ kind: 'unregulated', companyId: COMPANY });
  });
});
