/**
 * 🔴 **ΑΠΟ ΤΟ ΕΓΓΡΑΦΟ ΣΤΗ ΔΙΕΥΘΥΝΣΗ** — τα δύο μισά της διεξόδου, μαζί.
 * @related types/first-contact.ts (`readFirstContactTarget`) · lib/contact/first-contact-target-href
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΝΑ ΑΡΧΕΙΟ ΓΙΑ ΔΥΟ ΣΥΝΑΡΤΗΣΕΙΣ ΣΕ ΔΥΟ ΣΤΡΩΜΑΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Επειδή **μόνο μαζί** έχουν νόημα, και **μόνο μαζί** σπάνε: ο αναγνώστης παίρνει
 * ωμό έγγραφο και βγάζει στόχο· ο κατασκευαστής παίρνει στόχο και βγάζει διεύθυνση.
 * Ένα χαλαρό `readFirstContactTarget` **δεν φαίνεται** ως ελάττωμα στο δικό του
 * αρχείο — φαίνεται **εδώ**, ως `/listing/undefined` σε κουμπί που ο άνθρωπος πατά.
 *
 * ⚠️ **ΚΑΝΕΝΑ ΨΕΥΤΙΚΟ**: και οι δύο είναι καθαρές. Ό,τι ελέγχεται εδώ είναι η
 * **αλυσίδα**, όχι η μίμησή της.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΜΕΤΑΛΛΑΞΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΡΙΞΟΥΝ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 * 1. Άφησε τον αναγνώστη να ελέγχει **μόνο** το `kind` → **Β2** / **Γ1**.
 * 2. Δώσε στον `professional` μαντεμένο `/pro/${agencyCompanyId}` → **Α3**.
 * 3. Άφησε το κενό `listingId` να περνά → **Β3** / **Γ1**.
 */

import { readFirstContactTarget, type FirstContactTarget } from '@/types/first-contact';
import { firstContactTargetHref } from '../first-contact-target-href';

// ===========================================================================
// Α — Η ΔΙΕΥΘΥΝΣΗ ΤΟΥ ΣΤΟΧΟΥ
// ===========================================================================

describe('Α — ο στόχος ως δημόσια διεύθυνση', () => {
  it('🔑 Α1 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η αγγελία δίνει τη σελίδα που είδε ο άνθρωπος', () => {
    expect(firstContactTargetHref({ kind: 'listing', listingId: 'ownp_a0000001' }))
      .toBe('/listing/ownp_a0000001');
  });

  it('Α2 — και η ταυτότητα κωδικοποιείται, γιατί έρχεται από ΔΕΔΟΜΕΝΑ', () => {
    expect(firstContactTargetHref({ kind: 'listing', listingId: 'a#b' })).toBe('/listing/a%23b');
  });

  it('🔶 Α3 — Ο ΕΠΑΓΓΕΛΜΑΤΙΑΣ ΔΕΝ ΕΧΕΙ ΔΙΕΥΘΥΝΣΗ, ΚΑΙ ΤΟ ΛΕΜΕ (ADR-844 §7.1)', () => {
    // 🔴 Η βιτρίνα ζει σε `/pro/<alias>`· ο στόχος κρατά **companyId**. Ένα μαντεμένο
    //    `/pro/comp_0001` θα ήταν **404** — αδιέξοδο **με** κουμπί, χειρότερο από χωρίς.
    expect(firstContactTargetHref({ kind: 'professional', agencyCompanyId: 'comp_0001' }))
      .toBeNull();
  });
});

// ===========================================================================
// Β — Ο ΑΝΑΓΝΩΣΤΗΣ: ΤΑ ΔΕΔΟΜΕΝΑ ΕΡΧΟΝΤΑΙ ΑΠΟ ΤΗ ΒΑΣΗ, ΟΧΙ ΑΠΟ ΤΟΝ ΜΕΤΑΓΛΩΤΤΙΣΤΗ
// ===========================================================================

describe('Β — ο στόχος όπως ήρθε από τη βάση', () => {
  it('🔑 Β1 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: σωστό έγγραφο διαβάζεται, και στα δύο είδη', () => {
    expect(readFirstContactTarget({ kind: 'listing', listingId: 'ownp_1' }))
      .toEqual({ kind: 'listing', listingId: 'ownp_1' });
    expect(readFirstContactTarget({ kind: 'professional', agencyCompanyId: 'comp_1' }))
      .toEqual({ kind: 'professional', agencyCompanyId: 'comp_1' });
  });

  it('🔴 Β2 — ΣΩΣΤΟ `kind` με ΛΕΙΠΟΝ φορτίο είναι `null`, όχι μισός στόχος', () => {
    // 🔴 Ο έλεγχος «μόνο `kind`» θα περνούσε **και τα τέσσερα** — και θα γεννούσε
    //    `/listing/undefined`.
    expect(readFirstContactTarget({ kind: 'listing' })).toBeNull();
    expect(readFirstContactTarget({ kind: 'listing', listingId: 42 })).toBeNull();
    expect(readFirstContactTarget({ kind: 'professional' })).toBeNull();
    expect(readFirstContactTarget({ kind: 'listing', agencyCompanyId: 'comp_1' })).toBeNull();
  });

  it('🔴 Β3 — ΚΕΝΗ ταυτότητα δεν είναι ταυτότητα: θα έχτιζε `/listing/`, σελίδα ΑΛΛΟΥ', () => {
    expect(readFirstContactTarget({ kind: 'listing', listingId: '' })).toBeNull();
    expect(readFirstContactTarget({ kind: 'listing', listingId: '   ' })).toBeNull();
  });

  it('Β4 — ό,τι δεν είναι στόχος είναι `null`, χωρίς να πετάει', () => {
    for (const junk of [null, undefined, 'listing', 7, [], {}, { kind: 'agency' }]) {
      expect(readFirstContactTarget(junk)).toBeNull();
    }
  });
});

// ===========================================================================
// Γ — Η ΑΛΥΣΙΔΑ: ΚΑΜΙΑ ΔΙΕΥΘΥΝΣΗ ΜΕ `undefined` ΜΕΣΑ ΤΗΣ
// ===========================================================================

describe('Γ — από το ωμό έγγραφο στο κουμπί', () => {
  it('🔴 Γ1 — ΚΑΝΕΝΑ χαλασμένο έγγραφο δεν παράγει διεύθυνση', () => {
    const broken: unknown[] = [
      { kind: 'listing' },
      { kind: 'listing', listingId: '' },
      { kind: 'listing', listingId: null },
      { kind: 'professional' },
      undefined,
    ];

    for (const raw of broken) {
      const target: FirstContactTarget | null = readFirstContactTarget(raw);
      const href = target === null ? null : firstContactTargetHref(target);

      expect(href).toBeNull();
    }
  });

  it('🔑 Γ2 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: το υγιές έγγραφο φτάνει ΟΛΟ τον δρόμο', () => {
    const target = readFirstContactTarget({ kind: 'listing', listingId: 'ownp_kalamaria' });

    expect(target).not.toBeNull();
    expect(firstContactTargetHref(target as FirstContactTarget)).toBe('/listing/ownp_kalamaria');
  });
});
