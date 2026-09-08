/**
 * @fileoverview 🏆 **Η ΑΓΚΥΡΑ ΤΟΥ ΦΟΡΕΑ ΤΗΣ ΔΗΛΩΣΗΣ** — «είναι αυτό δήλωση;» χωρίς προεπιλογές.
 * @related ADR-845 §6.2.1 · §8 (Α-3 · Α-4 · Α-6) · ADR-841 §7 Α12.7
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΡΩΤΑ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΔΕΝ ΡΩΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Μπορεί σκουπίδι να περάσει για δήλωση;**
 *
 * Το `ModelPublicationDeclaration` το γράφει ρητά: *«κανένα πεδίο δεν έχει προεπιλογή — μια
 * προεπιλογή θα σήμαινε ότι **ο πρώτος που θα ξεχάσει να απαντήσει δημοσιεύει**»*. Ο αναγνώστης
 * του custom metadata είναι το **σύνορο** όπου αυτή η υπόσχεση είτε τηρείται είτε καταρρέει
 * σιωπηλά: ο πάροχος δεν υπόσχεται **τίποτα** για το περιεχόμενο μιας συμβολοσειράς.
 *
 * 🔑 **Και η δεύτερη ερώτηση, που δεν είναι η ίδια**: *«**λείπει** η δήλωση»* ⇒ `null` *(άρνηση
 * στο σύνορο)*, ενώ *«η δήλωση λέει **δεν έχω γεωμετρία**»* ⇒ **έγκυρη δήλωση** με
 * `fingerprint: null`, που ο ψήστης απορρίπτει **ονομαστικά** *(fail-closed)*. Δύο διαφορετικά
 * προβλήματα, δύο διαφορετικά μηνύματα προς τον άνθρωπο (ADR-844 §1).
 *
 * ⚠️ **ΣΥΝΑΡΤΗΣΕΙΣ, ΟΧΙ ΣΤΑΘΕΡΕΣ ΣΤΟ ΣΩΜΑ ΤΟΥ `describe`** — το σώμα τρέχει στη **συλλογή**.
 */

import {
  MODEL_DECLARATION_MAX_BYTES,
  MODEL_DECLARATION_METADATA_KEY,
  decodeModelDeclaration,
  encodeModelDeclaration,
} from '../model-declaration-metadata';
import type { ModelPublicationDeclaration } from '../listing-model-declaration';

function declaration(): ModelPublicationDeclaration {
  return {
    state: 'as-built',
    signatory: {
      name: 'Γιώργος Παγώνης',
      discipline: 'πολιτικός μηχανικός',
      studiedAt: '2026-05-02',
    },
    geometry: {
      meshCount: 3,
      triangleCount: 12_480,
      materialCount: 2,
      textureCount: 0,
      fingerprint: {
        hash: 'a'.repeat(32),
        signature: {
          vertexCount: 7_390,
          triangleCount: 12_480,
          sizeM: [12.4, 8.1, 9.7],
          centroidM: [0.2, -0.05, 4.85],
          areaM2: 431.72,
        },
      },
    },
  };
}

/** Η κωδικοποιημένη δήλωση, **παραλλαγμένη** σε ένα σημείο — ο μοχλός κάθε άγκυρας. */
function encodedWith(mutate: (draft: Record<string, unknown>) => void): string {
  const draft = JSON.parse(encodeModelDeclaration(declaration())) as Record<string, unknown>;
  mutate(draft);
  return JSON.stringify(draft);
}

// ---------------------------------------------------------------------------

describe('Δ1 — ΚΛΕΙΣΤΟΣ ΚΥΚΛΟΣ: ό,τι γράφει ο πελάτης το διαβάζει ο διακομιστής', () => {
  it('🔴 ο κύκλος επιστρέφει ΑΚΡΙΒΩΣ την ίδια δήλωση — καμία απώλεια πεδίου', () => {
    expect(decodeModelDeclaration(encodeModelDeclaration(declaration()))).toEqual(declaration());
  });

  it('🔑 το κλειδί του μεταδεδομένου γράφεται ΜΙΑ φορά, και είναι δικό μας', () => {
    // Δύο κυριολεκτικά σε δύο άκρες = τα δημοσιευμένα αντικείμενα γίνονται αόρατα στη μία.
    expect(MODEL_DECLARATION_METADATA_KEY).toBe('nestorModelDeclaration');
  });

  it('🔴 η δήλωση χωρά ΑΝΕΤΑ στο ταβάνι — το «κάτω από 1 KB» είναι μετρημένο, όχι ελπίδα', () => {
    const size = Buffer.byteLength(encodeModelDeclaration(declaration()), 'utf8');

    expect(size).toBeLessThan(1024);
    expect(MODEL_DECLARATION_MAX_BYTES).toBeLessThan(8 * 1024); // το όριο του παρόχου
  });

  it('🔴 και ό,τι ΔΕΝ χωρά πετά ΕΔΩ, με όνομα — ποτέ ανώνυμα στον πάροχο', () => {
    const bloated = declaration();
    const huge: ModelPublicationDeclaration = {
      ...bloated,
      signatory: { ...bloated.signatory, name: 'x'.repeat(MODEL_DECLARATION_MAX_BYTES) },
    };

    expect(() => encodeModelDeclaration(huge)).toThrow(RangeError);
  });
});

describe('🔴 Δ2 — ΤΙΠΟΤΑ ΔΕΝ ΠΕΡΝΑ ΜΕ ΠΡΟΕΠΙΛΟΓΗ', () => {
  it('η απουσία μεταδεδομένου είναι ΑΡΝΗΣΗ, όχι κενή δήλωση', () => {
    expect(decodeModelDeclaration(undefined)).toBeNull();
    expect(decodeModelDeclaration(null)).toBeNull();
    expect(decodeModelDeclaration('')).toBeNull();
  });

  it('ό,τι δεν είναι συμβολοσειρά ή δεν είναι JSON απορρίπτεται', () => {
    expect(decodeModelDeclaration(42)).toBeNull();
    expect(decodeModelDeclaration({ state: 'as-built' })).toBeNull();
    expect(decodeModelDeclaration('{όχι JSON')).toBeNull();
    expect(decodeModelDeclaration('"συμβολοσειρά, όχι αντικείμενο"')).toBeNull();
    expect(decodeModelDeclaration('[]')).toBeNull();
  });

  it('🔴 ΑΓΝΩΣΤΗ σήμανση κατάστασης ⇒ άρνηση — η Α11 έχει ΤΡΕΙΣ τιμές, όχι όποια σταλεί', () => {
    expect(decodeModelDeclaration(encodedWith((d) => { d.state = 'ό,τι να ναι'; }))).toBeNull();
    expect(decodeModelDeclaration(encodedWith((d) => { delete d.state; }))).toBeNull();
  });

  it('🔴 ΛΕΙΠΩΝ υπογράφων ⇒ άρνηση — και τα τρία πεδία του είναι υποχρεωτικά (Α10)', () => {
    expect(decodeModelDeclaration(encodedWith((d) => { delete d.signatory; }))).toBeNull();
    expect(decodeModelDeclaration(encodedWith((d) => {
      d.signatory = { name: 'Χ', discipline: 'αρχιτέκτονας' };
    }))).toBeNull();
  });

  it('🔴 ΛΕΙΠΟΝ πλήθος της λογιστικής ⇒ άρνηση — και τα τέσσερα ξαναμετριούνται (§6.2.1)', () => {
    for (const field of ['meshCount', 'triangleCount', 'materialCount', 'textureCount']) {
      const raw = encodedWith((d) => {
        delete (d.geometry as Record<string, unknown>)[field];
      });
      expect(decodeModelDeclaration(raw)).toBeNull();
    }
  });

  it('🔴 `NaN`/`Infinity` ⇒ άρνηση — το `JSON.parse` τα φέρνει ως `null`, όχι ως αριθμό', () => {
    const raw = encodedWith((d) => {
      (d.geometry as Record<string, unknown>).triangleCount = null;
    });
    expect(decodeModelDeclaration(raw)).toBeNull();
  });

  it('🔴 κακοσχηματισμένο αποτύπωμα ⇒ άρνηση — τριάδα με δύο στοιχεία δεν είναι μέγεθος', () => {
    const shortVec = encodedWith((d) => {
      const geometry = d.geometry as { fingerprint: { signature: Record<string, unknown> } };
      geometry.fingerprint.signature.sizeM = [1, 2];
    });
    const textVec = encodedWith((d) => {
      const geometry = d.geometry as { fingerprint: { signature: Record<string, unknown> } };
      geometry.fingerprint.signature.centroidM = ['a', 'b', 'c'];
    });

    expect(decodeModelDeclaration(shortVec)).toBeNull();
    expect(decodeModelDeclaration(textVec)).toBeNull();
  });
});

describe('🏆 Δ3 — «ΔΕΝ ΕΧΩ ΓΕΩΜΕΤΡΙΑ» ΕΙΝΑΙ ΕΓΚΥΡΗ ΔΗΛΩΣΗ, ΟΧΙ ΑΠΟΥΣΙΑ ΔΗΛΩΣΗΣ', () => {
  it('🔴 `fingerprint: null` γίνεται ΔΕΚΤΟ από τον αναγνώστη', () => {
    // Η διάκριση που κρατά **δύο μηνύματα για δύο προβλήματα**: εδώ η δήλωση **υπάρχει** και
    // λέει «καμία αξιοποιήσιμη γεωμετρία». Η απόρριψη ανήκει στον **ψήστη**, με το όνομά της
    // (`ledger-disagreement`), όχι στο σύνορο ανάγνωσης με το λάθος όνομα.
    const raw = encodedWith((d) => {
      (d.geometry as Record<string, unknown>).fingerprint = null;
    });
    const parsed = decodeModelDeclaration(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.geometry.fingerprint).toBeNull();
  });

  it('🔴 αλλά ΑΠΟΝ `fingerprint` ⇒ άρνηση — «δεν το είπα» δεν είναι «είπα όχι»', () => {
    const raw = encodedWith((d) => {
      delete (d.geometry as Record<string, unknown>).fingerprint;
    });

    expect(decodeModelDeclaration(raw)).toBeNull();
  });
});

describe('🔑 Δ4 — ΤΟ ΣΥΝΟΡΟ ΔΕΝ ΚΡΙΝΕΙ ΑΝ Η ΥΠΟΓΡΑΦΗ **ΑΡΚΕΙ**', () => {
  it('🔴 όνομα από κενά ΠΕΡΝΑ την ανάγνωση — το `hasSignatory` είναι που το κόβει (Α-4)', () => {
    // ⛔ Ο έλεγχος «τι μετράει ως υπογραφή» ζει σε **ένα** σημείο, και το γράφει ρητά:
    //    *«`trim()` εδώ, και ΜΟΝΟ εδώ»*. Ένας δεύτερος εδώ θα ήταν δεύτερη απάντηση,
    //    ελεύθερη να αποκλίνει — και η αιτία της άρνησης θα άλλαζε όνομα.
    const raw = encodedWith((d) => {
      d.signatory = { name: '   ', discipline: '  ', studiedAt: '2026-05-02' };
    });
    const parsed = decodeModelDeclaration(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.signatory.name).toBe('   ');
  });
});
