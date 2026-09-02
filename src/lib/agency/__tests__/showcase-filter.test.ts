/**
 * ADR-841 **Φ6-Β** — Η ΑΓΚΥΡΑ ΤΟΥ ΚΑΝΟΝΑ Φ.
 *
 * 🔴 **Ο κανόνας Φ είναι σχόλιο· αυτό το αρχείο τον κάνει ΠΥΛΗ.** Ένας κανόνας
 * που ζει μόνο σε prose είναι *«ανάθεση, όχι εγγύηση»* — το `CLAUDE.md` το έχει
 * μετρήσει να αποτυγχάνει **60 φορές** *(CHECK 3.49)*.
 *
 * Η **Ε3β** είναι η σημαντικότερη: μετρά τα **κλειδιά** του σχήματος φίλτρων.
 * Ένα `verifiedOnly` κοκκινίζει τη σουίτα **πριν** προλάβει να φτάσει σε οθόνη —
 * και είναι ακριβώς ο άξονας που εξαφανίζει τον ελαιοχρωματιστή.
 */

import {
  ALL_OCCUPATIONS,
  EMPTY_SHOWCASE_FILTERS,
  applyShowcaseFilters,
  hasActiveFilters,
  occupationOptions,
  parseShowcaseFilters,
  serializeShowcaseFilters,
} from '../showcase-filter';
import type { PublicShowcase, ShowcaseCredential } from '@/types/agency-profile';

// =============================================================================
// ΟΙ ΒΙΤΡΙΝΕΣ
// =============================================================================

const LAWYER_URI = 'http://data.europa.eu/esco/occupation/lawyer';
const PAINTER_URI = 'http://data.europa.eu/esco/occupation/painter';
const BROKER_URI = 'http://data.europa.eu/esco/occupation/broker';

function credential(escoUri: string, el: string, en: string, iscoCode: string): ShowcaseCredential {
  return {
    standing: 'self-declared',
    occupation: { escoUri, label: { el, en }, iscoCode },
    attestation: { state: 'unknown' },
  };
}

const LAWYER = credential(LAWYER_URI, 'Δικηγόρος', 'Lawyer', '2611');
const PAINTER = credential(PAINTER_URI, 'Ελαιοχρωματιστής', 'Painter', '7131');
const BROKER = credential(BROKER_URI, 'Μεσίτης', 'Broker', '3334');

/** Θεσσαλονίκη, κέντρο. */
const THESSALONIKI = { lat: 40.6403, lng: 22.9439 };
/** Αθήνα — ~300 χλμ μακριά. */
const ATHENS = { lat: 37.9838, lng: 23.7275 };

function showcase(
  companyId: string,
  displayName: string,
  credentials: readonly ShowcaseCredential[],
  position: PublicShowcase['position'] = THESSALONIKI,
): PublicShowcase {
  return {
    companyId,
    alias: companyId,
    displayName,
    credentials,
    place: null,
    position,
    publishedAt: '2026-09-01T10:00:00.000Z',
  };
}

/** ⚠️ **Ήδη ταξινομημένος** — όπως τον παραδίδει το `usePublicAgencies`. */
const ORDERED: readonly PublicShowcase[] = [
  showcase('c1', 'Αλεξίου', [LAWYER]),
  showcase('c2', 'Βασιλείου', [PAINTER]),
  showcase('c3', 'Γεωργίου', [BROKER, PAINTER]), // μικτό
  showcase('c4', 'Δημητρίου', [LAWYER], ATHENS),
  showcase('c5', 'Ευαγγέλου', [PAINTER], null), // χωρίς δηλωμένο τόπο
];

describe('ADR-841 Φ6-Β — ΚΑΝΟΝΑΣ Φ: φίλτρο ≠ κατάταξη', () => {
  // ===========================================================================
  // Φ1 — Ο ΑΞΟΝΑΣ ΕΙΝΑΙ ΔΗΛΩΣΗ ΤΟΥ ΙΔΙΟΥ
  // ===========================================================================

  describe('Ε3β — Φ1 ΔΟΜΙΚΑ: η άγκυρα του antitrust', () => {
    /**
     * 🔴 ΑΥΤΟ ΤΟ TEST ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΥΠΑΡΧΕΙ Η ΣΟΥΙΤΑ.
     *
     * Δεν ελέγχει συμπεριφορά — ελέγχει **ποια ερωτήματα επιτρέπεται να
     * υπάρχουν**. Κάθε νέος άξονας πρέπει να περάσει από εδώ, δηλαδή από
     * άνθρωπο που θα διαβάσει τον Φ1 πριν προσθέσει τη γραμμή.
     *
     * ⚠️ Ένα `verifiedOnly` έχει **άψογη** διατύπωση πρόθεσης και **εξαφανίζει**
     * τον ελαιοχρωματιστή — κάνει την απουσία μητρώου **ποινή** (Α9.3).
     */
    it('το σχήμα φίλτρων έχει ΑΚΡΙΒΩΣ δύο άξονες, και είναι αυτοί', () => {
      expect(Object.keys(EMPTY_SHOWCASE_FILTERS).sort()).toEqual(['near', 'occupation']);
    });

    it('και οι δύο άξονες κόβουν πάνω σε ΔΗΛΩΣΗ του επαγγελματία', () => {
      // ειδικότητα → `credentials[].occupation` (τη διάλεξε ο ίδιος)
      // περιοχή    → `position` (τον τόπο τον δήλωσε ο ίδιος)
      // ⛔ Κανένα από τα δύο δεν είναι μέτρηση της πλατφόρμας γι' αυτόν.
      const sample = ORDERED[0];
      expect(sample).toHaveProperty('credentials');
      expect(sample).toHaveProperty('position');
      expect(sample).not.toHaveProperty('rating');
      expect(sample).not.toHaveProperty('responseTimeHours');
      expect(sample).not.toHaveProperty('listingCount');
    });
  });

  // ===========================================================================
  // Φ2 — Η ΠΡΟΕΠΙΛΟΓΗ ΕΙΝΑΙ «ΟΛΑ»
  // ===========================================================================

  describe('Φ2 — η προεπιλογή είναι «ΟΛΑ», και επιστρέφεται με μία ενέργεια', () => {
    it('κενή διεύθυνση ⇒ κανένα ενεργό φίλτρο', () => {
      expect(parseShowcaseFilters(new URLSearchParams(''))).toEqual(EMPTY_SHOWCASE_FILTERS);
      expect(hasActiveFilters(EMPTY_SHOWCASE_FILTERS)).toBe(false);
    });

    it('χωρίς φίλτρα, ΚΑΝΕΙΣ δεν φεύγει — ούτε ο άτοπος, ούτε ο αμήτρωτος', () => {
      expect(applyShowcaseFilters(ORDERED, EMPTY_SHOWCASE_FILTERS)).toEqual(ORDERED);
    });

    it('το sentinel «all» ΔΕΝ διαρρέει στην κατάσταση — μεταφράζεται στο σύνορο', () => {
      const params = new URLSearchParams(`occupation=${ALL_OCCUPATIONS}`);
      expect(parseShowcaseFilters(params).occupation).toBeNull();
    });

    it('«καθαρισμός» = μία ενέργεια: η κενή κατάσταση γράφει κενή διεύθυνση', () => {
      expect(serializeShowcaseFilters(EMPTY_SHOWCASE_FILTERS).toString()).toBe('');
    });
  });

  // ===========================================================================
  // Φ3 — ΥΠΑΚΟΛΟΥΘΙΑ, ΠΟΤΕ ΑΝΑΤΑΞΙΝΟΜΗΣΗ
  // ===========================================================================

  describe('Ε3α — Φ3: το φιλτραρισμένο είναι ΥΠΑΚΟΛΟΥΘΙΑ του ταξινομημένου', () => {
    /**
     * 🔑 **Η ΣΕΙΡΑ, ΟΧΙ ΜΟΝΟ ΤΟ ΣΥΝΟΛΟ.** Ένα test που συγκρίνει `Set` θα ήταν
     * πράσινο και με «συνάφεια» μέσα στο φίλτρο — δηλαδή με κατάταξη κρυμμένη
     * εκεί που κανείς δεν την ψάχνει.
     */
    it('η σειρά της εξόδου είναι η σειρά της εισόδου', () => {
      const filtered = applyShowcaseFilters(ORDERED, {
        occupation: PAINTER_URI,
        near: null,
      });

      const positionsInInput = filtered.map((s) => ORDERED.indexOf(s));
      const ascending = [...positionsInInput].sort((a, b) => a - b);
      expect(positionsInInput).toEqual(ascending);
      expect(filtered.map((s) => s.displayName)).toEqual([
        'Βασιλείου',
        'Γεωργίου',
        'Ευαγγέλου',
      ]);
    });
  });

  // ===========================================================================
  // Ο ΑΞΟΝΑΣ ΤΗΣ ΕΙΔΙΚΟΤΗΤΑΣ
  // ===========================================================================

  describe('ο άξονας της ειδικότητας', () => {
    it('το ΜΙΚΤΟ γραφείο βρίσκεται ΚΑΙ ως μεσίτης ΚΑΙ ως τεχνικό', () => {
      // 🔑 Ένα `credentials[0]` θα έκρυβε τη μισή του ταυτότητα.
      const asBroker = applyShowcaseFilters(ORDERED, { occupation: BROKER_URI, near: null });
      const asPainter = applyShowcaseFilters(ORDERED, { occupation: PAINTER_URI, near: null });

      expect(asBroker.map((s) => s.companyId)).toContain('c3');
      expect(asPainter.map((s) => s.companyId)).toContain('c3');
    });
  });

  // ===========================================================================
  // Ο ΑΞΟΝΑΣ ΤΗΣ ΠΕΡΙΟΧΗΣ
  // ===========================================================================

  describe('ο άξονας της περιοχής', () => {
    it('30 χλμ γύρω από τη Θεσσαλονίκη αφήνει έξω την Αθήνα', () => {
      const near = { center: THESSALONIKI, radiusKm: 30 };
      const ids = applyShowcaseFilters(ORDERED, { occupation: null, near }).map(
        (s) => s.companyId,
      );

      expect(ids).toEqual(['c1', 'c2', 'c3']);
      expect(ids).not.toContain('c4'); // Αθήνα
    });

    /**
     * ⚠️ Η ΕΝΑΛΛΑΚΤΙΚΗ ΘΑ ΑΝΤΑΜΕΙΒΕ ΤΗ ΣΙΩΠΗ: αν η βιτρίνα χωρίς δηλωμένο τόπο
     * εμφανιζόταν σε **κάθε** αναζήτηση περιοχής, τότε το «μη δηλώνεις τόπο» θα
     * ήταν στρατηγική **καθολικής ορατότητας**.
     */
    it('βιτρίνα χωρίς δηλωμένο τόπο ΔΕΝ εμφανίζεται σε αναζήτηση περιοχής', () => {
      const near = { center: THESSALONIKI, radiusKm: 30 };
      const ids = applyShowcaseFilters(ORDERED, { occupation: null, near }).map(
        (s) => s.companyId,
      );
      expect(ids).not.toContain('c5');
    });

    it('χωρίς φίλτρο περιοχής, η ίδια βιτρίνα ΕΜΦΑΝΙΖΕΤΑΙ κανονικά', () => {
      // 🔑 Ο παρονομαστής: η απουσία τόπου δεν είναι αποκλεισμός από τον κατάλογο.
      expect(applyShowcaseFilters(ORDERED, EMPTY_SHOWCASE_FILTERS).map((s) => s.companyId))
        .toContain('c5');
    });
  });

  // ===========================================================================
  // ΔΙΕΥΘΥΝΣΗ ⇄ ΚΑΤΑΣΤΑΣΗ
  // ===========================================================================

  describe('η διεύθυνση είναι αναγνώσιμη και από τους δύο', () => {
    it('ό,τι γράφεται, ξαναδιαβάζεται ταυτόσημα', () => {
      const filters = {
        occupation: LAWYER_URI,
        near: { center: THESSALONIKI, radiusKm: 25 },
      };
      expect(parseShowcaseFilters(serializeShowcaseFilters(filters))).toEqual(filters);
    });

    it('μισό γεωγραφικό ζεύγος αγνοείται — δεν «διορθώνεται» σε σημείο', () => {
      // ⚠️ `lat` χωρίς `lng` = σημείο στον Ατλαντικό, που ο χάρτης θα ζωγράφιζε
      //    με απόλυτη σιγουριά. Ο έλεγχος ζει στο `readGeoFilter`, μία φορά.
      expect(parseShowcaseFilters(new URLSearchParams('lat=40.64')).near).toBeNull();
    });
  });

  // ===========================================================================
  // ΟΙ ΕΠΙΛΟΓΕΣ — παράγονται από τον πληθυσμό
  // ===========================================================================

  describe('οι επιλογές ΕΙΝΑΙ ο πληθυσμός', () => {
    it('καμία επιλογή δεν οδηγεί σε κενό αποτέλεσμα — δομικά', () => {
      const options = occupationOptions(ORDERED, 'el');

      for (const option of options) {
        const matches = applyShowcaseFilters(ORDERED, {
          occupation: option.escoUri,
          near: null,
        });
        expect(matches.length).toBeGreaterThan(0);
      }
      expect(options.length).toBeGreaterThan(0);
    });

    it('κάθε ειδικότητα εμφανίζεται ΜΙΑ φορά, όσες βιτρίνες κι αν την έχουν', () => {
      const uris = occupationOptions(ORDERED, 'el').map((o) => o.escoUri);
      expect(new Set(uris).size).toBe(uris.length);
      expect(uris).toHaveLength(3); // δικηγόρος · ελαιοχρωματιστής · μεσίτης
    });

    it('αλφαβητικά κατά ετικέτα, ΑΝΑ ΓΛΩΣΣΑ — ποτέ «κατά πλήθος»', () => {
      // ⚠️ Το «κατά πλήθος» θα ήταν κατάταξη ΕΠΑΓΓΕΛΜΑΤΩΝ μέσα στο χειριστήριο.
      //    Ο ελαιοχρωματιστής έχει 3 βιτρίνες, ο δικηγόρος 2 — αν η σειρά ήταν
      //    κατά πλήθος, θα ήταν πρώτος. Στα ελληνικά είναι δεύτερος.
      expect(occupationOptions(ORDERED, 'el').map((o) => o.label.el)).toEqual([
        'Δικηγόρος',
        'Ελαιοχρωματιστής',
        'Μεσίτης',
      ]);
      expect(occupationOptions(ORDERED, 'en').map((o) => o.label.en)).toEqual([
        'Broker',
        'Lawyer',
        'Painter',
      ]);
    });

    it('άδειος κατάλογος ⇒ καμία επιλογή, όχι εξαίρεση', () => {
      expect(occupationOptions([], 'el')).toEqual([]);
    });
  });
});
