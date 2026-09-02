/**
 * ADR-841 **Φ6-Β** — Η ΑΓΚΥΡΑ ΤΟΥ ΣΥΝΟΡΟΥ ΑΝΑΓΝΩΣΗΣ.
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: το `snapshot.data() as AgencyProfile` δεχόταν ό,τι γράφτηκε
 * ποτέ. Με credentials, ένα έγγραφο **χωρίς καμία απόδειξη** θα ζωγραφιζόταν ως
 * κάρτα — ο κατάλογος που το §9.9 β ονομάζει *«επικίνδυνο αντί για χρήσιμο»*.
 *
 * ⚠️ **Η μετανάστευση δοκιμάζεται ΜΕ ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΠΑΛΙΟ ΣΧΗΜΑ**, όχι με ό,τι
 * θυμάται ο συγγραφέας: `{companyId, alias, displayName, gemiNumber, place,
 * publishedAt}` — αυτολεξεί ό,τι έγραφε ο `publishAgencyProfile`.
 */

import { readShowcase } from '../showcase-read';
import { occupationNeedsCapability } from '@/lib/professional/showcase-eligibility';

const COMPANY = 'comp_9c7c1a50';

/** Το **παλιό** έγγραφο, όπως ακριβώς το έγραφε ο `publishAgencyProfile`. */
const LEGACY_DOCUMENT = {
  companyId: COMPANY,
  alias: 'pagonis',
  displayName: 'Παγώνης Ακίνητα',
  gemiNumber: '123456789000',
  place: null,
  publishedAt: '2026-09-01T10:00:00.000Z',
};

/** Ειδικότητα χωρίς μητρώο — ο ελαιοχρωματιστής (ISCO 7131). */
const PAINTER = {
  escoUri: 'http://data.europa.eu/esco/occupation/painter-fixture',
  label: { el: 'Ελαιοχρωματιστής', en: 'Painter' },
  iscoCode: '7131',
};

/** Ειδικότητα με μητρώο ανά πόλη — ο δικηγόρος (ISCO 2611). */
const LAWYER = {
  escoUri: 'http://data.europa.eu/esco/occupation/lawyer-fixture',
  label: { el: 'Δικηγόρος', en: 'Lawyer' },
  iscoCode: '2611',
};

function showcaseOf(raw: unknown) {
  const read = readShowcase(raw, COMPANY);
  if (read.outcome !== 'showcase') throw new Error(`Περίμενα showcase, πήρα ${read.outcome}`);
  return read.showcase;
}

describe('ADR-841 Φ6-Β — το σύνορο ανάγνωσης της βιτρίνας', () => {
  // ===========================================================================
  // Ε5β — Η ΜΕΤΑΝΑΣΤΕΥΣΗ ΕΙΝΑΙ ΣΥΜΠΕΡΑΣΜΑ, ΟΧΙ ΜΑΝΤΕΨΙΑ
  // ===========================================================================

  describe('Ε5β — το παλιό έγγραφο διαβάζεται, χωρίς script', () => {
    it('χωρίς credentials ΜΕ ΓΕΜΗ ⇒ ρυθμιζόμενο credential μεσίτη', () => {
      const showcase = showcaseOf(LEGACY_DOCUMENT);

      expect(showcase.credentials).toHaveLength(1);
      const [credential] = showcase.credentials;
      expect(credential.standing).toBe('regulated');
      expect(credential.occupation.iscoCode).toBe('3334');
      expect(credential.attestation).toEqual({
        state: 'declared',
        registration: { authorityKind: 'national', authority: 'gemi', number: '123456789000' },
      });
    });

    /**
     * 🔴 Ο ΕΛΕΓΧΟΣ ΣΥΜΦΩΝΙΑΣ ΠΟΥ ΤΟ ΣΧΟΛΙΟ ΥΠΟΣΧΕΤΑΙ, **ΕΚΤΕΛΕΣΜΕΝΟΣ**.
     *
     * Το `BROKER_OCCUPATION.iscoCode` πρέπει να είναι ο **ίδιος** κωδικός που ο
     * `occupationNeedsCapability` αναγνωρίζει ως ρυθμιζόμενο. Αν κάποιος αλλάξει
     * τον έναν χωρίς τον άλλο, ο μεταναστευμένος μεσίτης θα γινόταν σιωπηλά
     * `self-declared` — δηλαδή θα **έχανε τον φρουρό του ΓΕΜΗ** χωρίς κανένα
     * σφάλμα πουθενά. Σχόλιο που ζητά προσοχή δεν το πιάνει· αυτό το πιάνει.
     */
    it('η ειδικότητα της μετανάστευσης ΕΙΝΑΙ αυτή που θέλει ικανότητα', () => {
      const [credential] = showcaseOf(LEGACY_DOCUMENT).credentials;
      expect(occupationNeedsCapability(credential.occupation.iscoCode)).toBe(true);
    });

    it('χωρίς credentials ΚΑΙ χωρίς ΓΕΜΗ ⇒ «unreadable», ΠΟΤΕ κάρτα', () => {
      const { gemiNumber: _dropped, ...withoutProof } = LEGACY_DOCUMENT;
      expect(readShowcase(withoutProof, COMPANY)).toEqual({
        outcome: 'unreadable',
        companyId: COMPANY,
      });
    });
  });

  // ===========================================================================
  // Ο ΦΡΟΥΡΟΣ ΤΟΥ ΓΕΜΗ, ΤΩΡΑ ΩΣ ΤΥΠΟΣ
  // ===========================================================================

  describe('η ρυθμιζόμενη δραστηριότητα ΔΕΝ μπαίνει χωρίς απόδειξη', () => {
    it('μεσίτης με «unknown» απορρίπτεται — «δεν μπαίνεις χωρίς αυτόν»', () => {
      const broker = {
        ...LEGACY_DOCUMENT,
        gemiNumber: undefined,
        credentials: [
          {
            occupation: { ...PAINTER, iscoCode: '3334' },
            attestation: { state: 'unknown' },
          },
        ],
      };
      expect(readShowcase(broker, COMPANY).outcome).toBe('unreadable');
    });

    /** 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο ελαιοχρωματιστής με το ΙΔΙΟ «unknown» **ΜΠΑΙΝΕΙ**. */
    it('ο ελαιοχρωματιστής με «unknown» ΜΠΑΙΝΕΙ — η απουσία δεν είναι ποινή', () => {
      const painter = {
        ...LEGACY_DOCUMENT,
        gemiNumber: undefined,
        credentials: [{ occupation: PAINTER, attestation: { state: 'unknown' } }],
      };
      const [credential] = showcaseOf(painter).credentials;
      expect(credential.standing).toBe('self-declared');
      expect(credential.attestation).toEqual({ state: 'unknown' });
    });
  });

  // ===========================================================================
  // Η Α9.1 ΣΤΟ ΣΥΝΟΡΟ
  // ===========================================================================

  describe('ο αριθμός χωρίς τον εκδότη του δεν περνά το σύνορο', () => {
    it('δικηγόρος με αριθμό ΧΩΡΙΣ σύλλογο απορρίπτεται', () => {
      const lawyer = {
        ...LEGACY_DOCUMENT,
        gemiNumber: undefined,
        credentials: [
          {
            occupation: LAWYER,
            attestation: {
              state: 'declared',
              registration: { authorityKind: 'chapter', authority: 'bar-association', number: '1234' },
            },
          },
        ],
      };
      expect(readShowcase(lawyer, COMPANY).outcome).toBe('unreadable');
    });

    it('ο ίδιος δικηγόρος ΜΕ σύλλογο περνά', () => {
      const lawyer = {
        ...LEGACY_DOCUMENT,
        gemiNumber: undefined,
        credentials: [
          {
            occupation: LAWYER,
            attestation: {
              state: 'declared',
              registration: {
                authorityKind: 'chapter',
                authority: 'bar-association',
                chapter: 'ΔΣΘ',
                number: '1234',
              },
            },
          },
        ],
      };
      const [credential] = showcaseOf(lawyer).credentials;
      expect(credential.standing).toBe('self-declared');
    });

    it('άγνωστη αρχή απορρίπτεται — το Firestore επιστρέφει string, όχι υπόσχεση', () => {
      const bogus = {
        ...LEGACY_DOCUMENT,
        gemiNumber: undefined,
        credentials: [
          {
            occupation: LAWYER,
            attestation: {
              state: 'declared',
              registration: { authorityKind: 'national', authority: 'ΕΦΕΥΡΕΘΗΚΕ', number: '1' },
            },
          },
        ],
      };
      expect(readShowcase(bogus, COMPANY).outcome).toBe('unreadable');
    });
  });

  // ===========================================================================
  // ΤΟ ΜΙΚΤΟ ΓΡΑΦΕΙΟ — ο λόγος που το σχήμα είναι πίνακας
  // ===========================================================================

  describe('το μικτό γραφείο ΕΙΝΑΙ εκφράσιμο (ADR-824 §4.1)', () => {
    it('μεσιτική άδεια ΚΑΙ τεχνική ιδιότητα, στο ίδιο έγγραφο', () => {
      const mixed = {
        ...LEGACY_DOCUMENT,
        gemiNumber: undefined,
        credentials: [
          {
            occupation: { ...PAINTER, iscoCode: '3334' },
            attestation: {
              state: 'declared',
              registration: { authorityKind: 'national', authority: 'gemi', number: '999' },
            },
          },
          { occupation: PAINTER, attestation: { state: 'unknown' } },
        ],
      };

      const showcase = showcaseOf(mixed);
      expect(showcase.credentials.map((c) => c.standing)).toEqual([
        'regulated',
        'self-declared',
      ]);
    });
  });

  // ===========================================================================
  // ΤΑ ΣΥΝΟΡΑ ΤΩΝ ΠΕΔΙΩΝ
  // ===========================================================================

  describe('τα σύνορα', () => {
    it('ειδικότητα με ελληνική ετικέτα και ΧΩΡΙΣ αγγλική απορρίπτεται', () => {
      // ⚠️ Ακριβώς η βλάβη που το `EscoBilingualText` υπάρχει να κλείσει: ο
      //    αγγλόφωνος επισκέπτης θα έβλεπε κενό ή ελληνικά.
      const halfTranslated = {
        ...LEGACY_DOCUMENT,
        gemiNumber: undefined,
        credentials: [
          {
            occupation: { ...PAINTER, label: { el: 'Ελαιοχρωματιστής', en: '  ' } },
            attestation: { state: 'unknown' },
          },
        ],
      };
      expect(readShowcase(halfTranslated, COMPANY).outcome).toBe('unreadable');
    });

    it('το «position» διαβάζεται μόνο ως ζεύγος πεπερασμένων αριθμών', () => {
      expect(showcaseOf({ ...LEGACY_DOCUMENT, position: { lat: 40.64, lng: 22.94 } }).position)
        .toEqual({ lat: 40.64, lng: 22.94 });
      expect(showcaseOf({ ...LEGACY_DOCUMENT, position: { lat: '40', lng: 22 } }).position)
        .toBeNull();
      expect(showcaseOf({ ...LEGACY_DOCUMENT, position: { lat: NaN, lng: 22 } }).position)
        .toBeNull();
    });

    it('σκουπίδια στη θέση του εγγράφου δίνουν «unreadable», όχι εξαίρεση', () => {
      for (const rubbish of [null, undefined, 42, 'έγγραφο', []]) {
        expect(readShowcase(rubbish, COMPANY).outcome).toBe('unreadable');
      }
    });
  });
});
