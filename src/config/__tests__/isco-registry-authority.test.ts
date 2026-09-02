/**
 * **Η ΑΓΚΥΡΑ ΤΗΣ ΟΝΟΜΑΣΜΕΝΗΣ ΑΠΟΥΣΙΑΣ** — ADR-841 Α9.1 · Α9.3.
 *
 * Ερώτημα: *«ξεχωρίζει το σύστημα τον **ελαιοχρωματιστή** (δεν υπάρχει μητρώο) από
 * το επάγγελμα που **κανείς δεν εξέτασε**;»*
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΑΥΤΟ ΕΙΝΑΙ Η ΚΥΡΙΑ ΑΓΚΥΡΑ ΤΟΥ ΑΡΧΕΙΟΥ
 *
 * Η εύκολη γραφή του `resolveRegistryAuthority` επιστρέφει `RegistryAuthorityId |
 * null` και **ισοπεδώνει** τα δύο: ο ελαιοχρωματιστής παίρνει την ίδια απάντηση με
 * το επάγγελμα που δεν μπήκε ποτέ στον πίνακα. Η οθόνη τότε λέει *«δεν ξέρουμε»*
 * σε κάποιον για τον οποίο **ξέρουμε** — και του ζητά αριθμό που **δεν υπάρχει**.
 *
 * Είναι κυριολεκτικά το σχήμα **«0 = κανείς δεν κοίταξε»** που το `CLAUDE.md`
 * ονομάζει σε **N.11 · N.12 · N.18** και που οκτώ πύλες υπάρχουν για να κλείσουν.
 * Ο μεταγλωττιστής **δεν** το πιάνει: και οι δύο περιπτώσεις είναι έγκυρες τιμές
 * της ίδιας ένωσης. **Μόνο** εκτελεσμένο παράδειγμα το ξεχωρίζει.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * @see docs/centralized-systems/reference/adrs/ADR-841-public-listing-body-and-platform-verticals.md — Α9
 */

import {
  ISCO_REGISTRY_AUTHORITY,
  resolveRegistryAuthority,
} from '@/config/isco-registry-authority';
import { isChapteredRegistry, isRegistryAuthority } from '@/constants/professional-registries';

describe('ADR-841 Α9 — ποια αρχή κρατά μητρώο για κάθε επάγγελμα', () => {
  describe('η διάκριση που ΔΕΝ είναι εκφράσιμη σε τύπους', () => {
    it('ο ελαιοχρωματιστής παίρνει «no-registry» — ΓΝΩΣΗ, όχι άγνοια', () => {
      // 7131 = Painters and related workers. Ονομάζεται ρητά στο ADR-841 Α9.1.
      expect(resolveRegistryAuthority('7131')).toEqual({
        kind: 'no-registry',
        prefix: '7131',
      });
    });

    it('επάγγελμα εκτός πίνακα παίρνει «unexamined» — ΑΓΝΟΙΑ, και το λέει', () => {
      // 5223 = Shop sales assistants. Κανείς δεν το εξέτασε, και δεν προσποιούμαστε.
      expect(resolveRegistryAuthority('5223')).toEqual({
        kind: 'unexamined',
        code: '5223',
      });
    });

    it('τα δύο ΔΕΝ συγχέονται — η ίδια βλάβη που η άγκυρα υπάρχει για να πιάσει', () => {
      const known = resolveRegistryAuthority('7131');
      const unknown = resolveRegistryAuthority('5223');
      expect(known.kind).not.toBe(unknown.kind);
    });
  });

  describe('οι αρχές, εκεί που υπάρχουν', () => {
    it('ο δικηγόρος δείχνει σε αρχή ΜΕ παραρτήματα — «1234» χωρίς «ΔΣΘ» δεν επαληθεύεται', () => {
      expect(resolveRegistryAuthority('2611')).toEqual({
        kind: 'authority',
        authority: 'bar-association',
        prefix: '2611',
      });
    });

    it('κάθε ειδικότητα μηχανικού απαντά ΤΕΕ μέσω του προθέματος — ο μακρύτερος νικά', () => {
      // 2142 πολιτικός · 2144 μηχανολόγος: κανένα δεν έχει δική του γραμμή, και
      // ΔΕΝ χρειάζεται — το «214» απαντά για ολόκληρη την ελάσσονα ομάδα.
      for (const code of ['2142', '2144', '2149']) {
        expect(resolveRegistryAuthority(code)).toEqual({
          kind: 'authority',
          authority: 'tee',
          prefix: '214',
        });
      }
      // Το 2151 (ηλεκτρολόγος μηχανικός) ΔΕΝ είναι απόγονος του 214 — δικό του πρόθεμα.
      expect(resolveRegistryAuthority('2151')).toEqual({
        kind: 'authority',
        authority: 'tee',
        prefix: '215',
      });
    });

    it('ο διακοσμητής ΔΕΝ κληρονομεί την αρχή του αρχιτέκτονα', () => {
      // Άλλο επάγγελμα, άλλη απάντηση: 3432 ≠ 2161.
      expect(resolveRegistryAuthority('3432').kind).toBe('no-registry');
      expect(resolveRegistryAuthority('2161')).toEqual({
        kind: 'authority',
        authority: 'tee',
        prefix: '2161',
      });
    });

    it('ο γραφίστας ΔΕΝ παίρνει ΤΕΕ — το γονικό «216» δεν δηλώνεται επίτηδες', () => {
      // 2166 = Graphic and multimedia designers. Αν κάποιος «απλοποιήσει» τον
      // πίνακα δηλώνοντας «216», αυτό εδώ κοκκινίζει — και σωστά.
      expect(resolveRegistryAuthority('2166').kind).toBe('unexamined');
    });
  });

  describe('το ΑΝΟΙΧΤΟ ΠΟΥ ΕΚΛΕΙΣΕ — η άγνοια που δηλώθηκε, θεραπεύτηκε (Φ6-Β)', () => {
    /**
     * 🔴 ΑΥΤΟ ΤΟ TEST ΕΛΕΓΕ ΤΟ ΑΝΤΙΘΕΤΟ, ΚΑΙ ΕΙΧΕ ΔΙΚΙΟ ΤΟΤΕ.
     *
     * Η Φ6-Α έγραφε: *«υδραυλικός και ηλεκτρολόγος είναι unexamined, ΟΧΙ
     * no-registry»* — με τον σωστό λόγο ότι *«ένα no-registry θα έλεγε “δεν
     * υπάρχει τίποτα” ενώ υπάρχει»*. Η Φ6-Β **ερεύνησε τι ακριβώς υπάρχει**:
     * τηρείται **ενιαίο μητρώο ασκούντων τεχνικά επαγγέλματα του ν.3982/2011**,
     * από τη **Διεύθυνση Ανάπτυξης** κάθε **Περιφερειακής Ενότητας**.
     *
     * 🔑 Το `unexamined` **δεν ήταν χρέος — ήταν η τίμια ενδιάμεση κατάσταση**.
     * Ακριβώς επειδή η άγνοια ήταν **δηλωμένη**, κάποιος μπόρεσε να τη
     * θεραπεύσει. Άγνοια που σιωπά δεν θεραπεύεται ποτέ.
     */
    it('υδραυλικός και ηλεκτρολόγος δείχνουν πλέον στην αρχή της Περιφέρειας', () => {
      expect(resolveRegistryAuthority('7126')).toEqual({
        kind: 'authority',
        authority: 'regional-authority',
        prefix: '7126',
      });
      expect(resolveRegistryAuthority('7411')).toEqual({
        kind: 'authority',
        authority: 'regional-authority',
        prefix: '7411',
      });
    });

    /**
     * ⚠️ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η αρχή δηλώθηκε ανά **τετραψήφιο**, όχι ως πρόθεμα «74».
     * Η ελάσσων ομάδα 742 περιέχει εγκαταστάτες/επισκευαστές ηλεκτρονικού
     * εξοπλισμού, που **ΔΕΝ** αδειοδοτούνται από την Περιφέρεια. Αν κάποιος
     * «απλοποιήσει» τον πίνακα σε «74», αυτό εδώ κοκκινίζει — και σωστά.
     */
    it('ο επισκευαστής ηλεκτρονικών (7422) ΔΕΝ κληρονομεί την άδεια', () => {
      expect(resolveRegistryAuthority('7422').kind).toBe('unexamined');
    });

    /**
     * 🔑 ΚΑΙ Η ΑΡΧΗ ΕΙΝΑΙ `chapter`, ΟΧΙ `national` — δηλαδή ο μεταγλωττιστής
     * απαιτεί την Περιφερειακή Ενότητα δίπλα στον αριθμό. Ένα «12345» χωρίς
     * «Π.Ε. Θεσσαλονίκης» δεν επαληθεύεται από κανέναν (Α9.1).
     */
    it('η άδεια Περιφέρειας δηλώνεται ΜΕ τον εκδότη της', () => {
      expect(isChapteredRegistry('regional-authority')).toBe(true);
    });
  });

  describe('τα ΔΥΟ ΑΝΟΙΧΤΑ ΠΟΥ ΜΕΝΟΥΝ, δηλωμένα αντί να μαντευτούν', () => {
    it('το 2619 (νομικοί NEC) μένει αδήλωτο — δεν είναι ΜΟΝΟ συμβολαιογράφοι', () => {
      expect(resolveRegistryAuthority('2619').kind).toBe('unexamined');
    });

    it('το 2162 (αρχιτέκτονες τοπίου) μένει αδήλωτο — δεν επαληθεύτηκε το ΤΕΕ', () => {
      expect(resolveRegistryAuthority('2162').kind).toBe('unexamined');
    });
  });

  describe('τα σύνορα', () => {
    it('ελεύθερο κείμενο χωρίς κωδικό είναι «absent», όχι σφάλμα', () => {
      expect(resolveRegistryAuthority(null)).toEqual({ kind: 'absent' });
      expect(resolveRegistryAuthority(undefined)).toEqual({ kind: 'absent' });
      expect(resolveRegistryAuthority('')).toEqual({ kind: 'absent' });
    });

    it('τιμή που δεν είναι κωδικός ISCO είναι «malformed» — fail-closed ΚΑΙ ορατό', () => {
      expect(resolveRegistryAuthority('δικηγόρος')).toEqual({
        kind: 'malformed',
        value: 'δικηγόρος',
      });
      expect(resolveRegistryAuthority('21x4').kind).toBe('malformed');
    });

    it('η αναζήτηση προθέματος είναι δομικά ασφαλής — καμία κληρονομημένη ιδιότητα', () => {
      // Ο φρουρός μορφής (μόνο ψηφία) εγγυάται ότι κανένα πρόθεμα δεν γίνεται
      // ποτέ «constructor»/«__proto__» — ασφάλεια εκ κατασκευής, όχι κατά σύμβαση.
      expect(resolveRegistryAuthority('constructor').kind).toBe('malformed');
      expect(resolveRegistryAuthority('__proto__').kind).toBe('malformed');
    });
  });

  describe('η ακεραιότητα του πίνακα', () => {
    it('κάθε γραμμή δείχνει σε γνωστή αρχή ή σε ρητό null, και έχει λόγο', () => {
      for (const [prefix, entry] of Object.entries(ISCO_REGISTRY_AUTHORITY)) {
        expect(prefix).toMatch(/^\d{1,4}$/);
        if (entry.authority !== null) {
          expect(isRegistryAuthority(entry.authority)).toBe(true);
        }
        // Ο λόγος δεν είναι διακοσμητικός: είναι ό,τι διαβάζει ο επόμενος πριν
        // «διορθώσει» μια γραμμή που φαίνεται λάθος και δεν είναι.
        expect(entry.why.trim().length).toBeGreaterThan(20);
      }
    });
  });
});
