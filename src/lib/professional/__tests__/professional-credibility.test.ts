/**
 * ADR-841 **Φ6-Β** — Η ΑΓΚΥΡΑ ΤΗΣ ΣΥΝΘΕΣΗΣ.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΟΛΟΚΛΗΡΗ Η 5×3, ΚΕΛΙ-ΚΕΛΙ, ΚΑΙ ΟΧΙ «ΜΕΡΙΚΑ ΑΝΤΙΠΡΟΣΩΠΕΥΤΙΚΑ»
 *
 * Ο μεταγλωττιστής **δεν** ξεχωρίζει το `no-registry` από το `unexamined`: είναι
 * δύο τιμές της **ίδιας** ένωσης, και μια υλοποίηση που τα ισοπεδώνει
 * μεταγλωττίζεται μια χαρά. Τα ξεχωρίζει **μόνο** εκτελεσμένο παράδειγμα.
 *
 * Ίδιο ακριβώς μάθημα με το `isco-registry-authority.test.ts` της Φ6-Α, ένα
 * επίπεδο ψηλότερα: εκεί αποδείχθηκε ότι ο **resolver** τα ξεχωρίζει· εδώ ότι τα
 * ξεχωρίζει και η **σύνθεση**, που είναι το σημείο όπου συναντούν τον άνθρωπο.
 *
 * ⚠️ **Η ΟΘΟΝΗ δοκιμάζεται ΑΛΛΟΥ** *(`pro-credibility-screen.test.tsx`)*, και
 * επίτηδες: εκεί η μετάλλαξη που έχει σημασία είναι *«δύο κλειδιά με ίδιο
 * κείμενο»*, την οποία **αυτό** το αρχείο δεν μπορεί να δει.
 */

import { composeCredibility } from '../professional-credibility';
import type { CredibilityStatement } from '../professional-credibility';
import type { RegistryAuthorityVerdict } from '@/config/isco-registry-authority';
import type { ProfessionalAttestation } from '@/types/professional-identity';

// =============================================================================
// ΟΙ ΕΙΣΟΔΟΙ — πέντε verdicts × τρία attestations
// =============================================================================

const AUTHORITY: RegistryAuthorityVerdict = {
  kind: 'authority',
  authority: 'bar-association',
  prefix: '2611',
};
const NO_REGISTRY: RegistryAuthorityVerdict = { kind: 'no-registry', prefix: '7131' };
const UNEXAMINED: RegistryAuthorityVerdict = { kind: 'unexamined', code: '2619' };
const ABSENT: RegistryAuthorityVerdict = { kind: 'absent' };
const MALFORMED: RegistryAuthorityVerdict = { kind: 'malformed', value: 'δικηγόρος' };

const VERDICTS = [AUTHORITY, NO_REGISTRY, UNEXAMINED, ABSENT, MALFORMED] as const;

/** Ο ίδιος δικηγόρος, ΔΣΘ 1234 — αλλάζει **μόνο** το `state`. */
const BAR_REGISTRATION = {
  authorityKind: 'chapter',
  authority: 'bar-association',
  chapter: 'ΔΣΘ',
  number: '1234',
} as const;

const UNKNOWN: ProfessionalAttestation = { state: 'unknown' };
const DECLARED: ProfessionalAttestation = { state: 'declared', registration: BAR_REGISTRATION };
const VERIFIED: ProfessionalAttestation = { state: 'verified', registration: BAR_REGISTRATION };

const ATTESTATIONS = [UNKNOWN, DECLARED, VERIFIED] as const;

/** Αριθμός ΤΕΕ — άλλη αρχή από εκείνη του δικηγόρου. Για την αναντιστοιχία. */
const TEE_DECLARED: ProfessionalAttestation = {
  state: 'declared',
  registration: { authorityKind: 'national', authority: 'tee', number: '98765' },
};

describe('ADR-841 Φ6-Β — η σύνθεση των δύο ερωτημάτων', () => {
  // ===========================================================================
  // Ε1α — ΤΟ ΑΜΕΤΑΒΛΗΤΟ: η οθόνη ΔΕΝ ΣΩΠΑΙΝΕΙ ΠΟΤΕ
  // ===========================================================================

  describe('Ε1α — και τα 15 κελιά λένε κάτι', () => {
    it('κανένα κελί δεν επιστρέφει «τίποτα να δείξω»', () => {
      const silent: string[] = [];

      for (const verdict of VERDICTS) {
        for (const attestation of ATTESTATIONS) {
          const statement = composeCredibility(verdict, attestation);
          if (statement.claim === null && statement.note === null) {
            silent.push(`${verdict.kind} × ${attestation.state}`);
          }
        }
      }

      // 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΜΕΤΡΙΕΤΑΙ: αν ο βρόχος δεν έτρεξε 15 φορές, το «κανένα
      //    σιωπηλό» θα ήταν πράσινο επειδή κανείς δεν κοίταξε (N.12).
      expect(VERDICTS.length * ATTESTATIONS.length).toBe(15);
      expect(silent).toEqual([]);
    });
  });

  // ===========================================================================
  // Ε1β — Ο ΚΑΝΟΝΑΣ ΤΟΥ ΕΛΑΙΟΧΡΩΜΑΤΙΣΤΗ
  // ===========================================================================

  describe('Ε1β — ο ισχυρισμός ΣΩΠΑΙΝΕΙ όταν το επάγγελμα δεν έχει μητρώο', () => {
    it('ο ελαιοχρωματιστής που δεν δήλωσε ακούει «ΔΕΝ ΥΠΑΡΧΕΙ», όχι «δεν δήλωσες»', () => {
      expect(composeCredibility(NO_REGISTRY, UNKNOWN)).toEqual<CredibilityStatement>({
        claim: null,
        note: { kind: 'registry-absent-by-nature' },
      });
    });

    it('ο δικηγόρος που σιωπά ακούει «τηρείται μητρώο» — ΑΛΛΗ πρόταση, ίδιο `unknown`', () => {
      expect(composeCredibility(AUTHORITY, UNKNOWN)).toEqual<CredibilityStatement>({
        claim: null,
        note: { kind: 'registry-exists-undeclared', authority: 'bar-association' },
      });
    });

    /**
     * 🔴 ΑΥΤΟ ΤΟ TEST ΕΙΝΑΙ Η ΑΠΟΔΕΙΞΗ ΟΤΙ Η ΣΥΝΘΕΣΗ ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΗ.
     *
     * Ίδιο `attestation` *(`unknown`)*, **δύο** διαφορετικά σημειώματα. Αν το
     * σημείωμα ήταν συνάρτηση μόνο του attestation, θα ήταν το ίδιο — και ο
     * ελαιοχρωματιστής θα διαβαζόταν σαν τον δικηγόρο που κρύβεται.
     */
    it('ΙΔΙΟ attestation, ΔΙΑΦΟΡΕΤΙΚΟ σημείωμα — η σύνθεση δεν είναι διακοσμητική', () => {
      const painter = composeCredibility(NO_REGISTRY, UNKNOWN).note;
      const lawyer = composeCredibility(AUTHORITY, UNKNOWN).note;
      expect(painter?.kind).not.toBe(lawyer?.kind);
    });
  });

  // ===========================================================================
  // Ε1γ — ΤΡΙΑ ΥΠΟΚΕΙΜΕΝΑ, ΤΡΕΙΣ ΠΡΟΤΑΣΕΙΣ
  // ===========================================================================

  describe('Ε1γ — ΓΝΩΣΗ ≠ ΑΓΝΟΙΑ ≠ ΣΙΩΠΗ', () => {
    it('τα τρία σημειώματα του «κανείς δεν δήλωσε» είναι ΤΡΙΑ, όχι ένα', () => {
      const kinds = [
        composeCredibility(NO_REGISTRY, UNKNOWN).note?.kind, // το ΕΠΑΓΓΕΛΜΑ
        composeCredibility(UNEXAMINED, UNKNOWN).note?.kind, // ΕΜΕΙΣ
        composeCredibility(AUTHORITY, UNKNOWN).note?.kind, // ΑΥΤΟΣ
      ];

      expect(new Set(kinds).size).toBe(3);
      expect(kinds).toEqual([
        'registry-absent-by-nature',
        'registry-unexamined',
        'registry-exists-undeclared',
      ]);
    });

    it('το «δεν το εξετάσαμε» παραμένει αληθές ΚΑΙ δίπλα σε δηλωμένο αριθμό', () => {
      // ⚠️ Δεύτερο σημείωμα εδώ θα ήταν δύο διατυπώσεις της ΙΔΙΑΣ άγνοιας.
      for (const attestation of ATTESTATIONS) {
        expect(composeCredibility(UNEXAMINED, attestation).note).toEqual({
          kind: 'registry-unexamined',
        });
      }
    });
  });

  // ===========================================================================
  // Ε1δ — ΤΟ `declared` ΔΕΝ ΕΙΝΑΙ ΤΟ `verified`
  // ===========================================================================

  describe('Ε1δ — δηλωμένο ≠ επαληθευμένο, ΠΟΤΕ boolean', () => {
    it('ίδιο registration, ΔΙΑΦΟΡΕΤΙΚΟ state — η διάκριση φτάνει στον καταναλωτή', () => {
      const declared = composeCredibility(AUTHORITY, DECLARED);
      const verified = composeCredibility(AUTHORITY, VERIFIED);

      expect(declared.claim?.state).toBe('declared');
      expect(verified.claim?.state).toBe('verified');
      expect(declared.claim?.registration).toEqual(verified.claim?.registration);
    });

    it('όταν η αρχή ταιριάζει, ΚΑΜΙΑ υποσημείωση — η σιωπή εδώ είναι πληροφορία', () => {
      // 🔑 Ένα «όλα καλά» σημείωμα θα ήταν ακριβώς η επιβεβαίωση που ΔΕΝ έχουμε
      //    κάνει (Σ5). Η απουσία σημειώματος λέει «δεν υπάρχει τίποτα να
      //    επισημανθεί», όχι «το ελέγξαμε».
      expect(composeCredibility(AUTHORITY, DECLARED).note).toBeNull();
    });
  });

  // ===========================================================================
  // Ε1ε — ΟΙ ΔΥΟ ΑΝΑΝΤΙΣΤΟΙΧΙΕΣ
  // ===========================================================================

  describe('Ε1ε — ο αριθμός που δεν ταιριάζει στο επάγγελμα', () => {
    it('αριθμός ΤΕΕ σε βιτρίνα δικηγόρου ⇒ αναντιστοιχία, με την ΑΝΑΜΕΝΟΜΕΝΗ αρχή', () => {
      const statement = composeCredibility(AUTHORITY, TEE_DECLARED);

      // ⚠️ Ο ισχυρισμός ΜΕΝΕΙ ΟΡΑΤΟΣ: μπορεί κάλλιστα να ασκεί ΔΥΟ ιδιότητες.
      expect(statement.claim?.state).toBe('declared');
      expect(statement.note).toEqual({
        kind: 'authority-mismatch',
        expected: 'bar-association',
      });
    });

    it('αριθμός σε επάγγελμα χωρίς μητρώο ⇒ ΔΙΚΟ ΤΟΥ σημείωμα, ο αριθμός μένει', () => {
      const statement = composeCredibility(NO_REGISTRY, DECLARED);

      expect(statement.claim?.registration).toEqual(BAR_REGISTRATION);
      expect(statement.note).toEqual({ kind: 'registry-absent-yet-declared' });
    });
  });

  // ===========================================================================
  // Ε1στ — Η ΔΙΚΗ ΜΑΣ ΒΛΑΒΗ
  // ===========================================================================

  describe('Ε1στ — όταν σπάει η ΔΙΚΗ ΜΑΣ ταξινομία', () => {
    it('«absent» και «malformed» δίνουν το ΙΔΙΟ σημείωμα — ίδια θεραπεία επισκέπτη', () => {
      for (const attestation of ATTESTATIONS) {
        expect(composeCredibility(ABSENT, attestation).note).toEqual({
          kind: 'classification-unreadable',
        });
        expect(composeCredibility(MALFORMED, attestation).note).toEqual({
          kind: 'classification-unreadable',
        });
      }
    });

    it('ο ισχυρισμός ΔΕΝ χάνεται όταν φταίμε εμείς', () => {
      // 🔴 Ο άνθρωπος δεν κατηγορείται για δικό μας σφάλμα ανάγνωσης, και δεν
      //    χάνει ό,τι δήλωσε.
      expect(composeCredibility(MALFORMED, DECLARED).claim?.registration).toEqual(
        BAR_REGISTRATION,
      );
    });
  });
});
