/**
 * ADR-748 Φάση 2 — ANCHOR TEST για τον διακόπτη ειδικότητας.
 *
 * Δύο δουλειές:
 *  1. **ΟΛΙΚΟΤΗΤΑ** (Υ-4): καμία μόνιμη καρτέλα δεν μένει αδήλωτη, και καμία
 *     δήλωση δεν δείχνει σε ανύπαρκτη καρτέλα. Νέο ribbon tab χωρίς ανάθεση
 *     ⇒ **κόκκινο**. Πρότυπο: ADR-587 capability anchors.
 *  2. **ΤΑ ΜΕΤΡΗΜΕΝΑ ΠΛΗΘΗ** του ADR-748 §5.1: 7 / 7 / 12 / 7 / 5 / 16.
 *     Δεν είναι διακοσμητικά — είναι ο ορισμός του «τελείωσε» της φάσης.
 *
 * ⚠️ Αν ένα από αυτά κοκκινίσει επειδή πρόσθεσες καρτέλα, η σωστή κίνηση είναι
 * να **δηλώσεις πού ανήκει** (και να ενημερώσεις το §5.1 + το πλήθος εδώ) —
 * ΟΧΙ να χαλαρώσεις τον έλεγχο.
 */

import { DEFAULT_RIBBON_TAB_ORDER, DEFAULT_RIBBON_TABS } from '../ribbon-default-tabs';
import {
  RIBBON_SPECIALTY_ALL,
  RIBBON_SPECIALTY_LABEL_KEY,
  RIBBON_SPECIALTY_ORDER,
  RIBBON_TAB_SPECIALTIES,
  SPECIALTY_DISCIPLINES,
  countHiddenTabs,
  isRibbonSpecialtySelection,
  resolveVisibleTabIds,
  type RibbonSpecialtyId,
} from '../ribbon-tab-specialties';
import { MODEL_DISCIPLINES } from '../../../../bim/discipline/bim-discipline';

/**
 * Το πλήθος των μόνιμων καρτελών.
 *
 * 🔴 ΕΙΝΑΙ **15**, ΟΧΙ 16 — μετρημένο στον κώδικα 2026-08-02 από αυτό ακριβώς
 * το anchor test, την πρώτη φορά που έτρεξε. Το ADR-748 έγραφε «16» σε **πέντε**
 * σημεία (§2.5, §5.1, §14.0, §14.3 και στον handoff), αλλά ο ίδιος ο πίνακας
 * του §2.5 απαριθμεί 15 γραμμές: 1 home + 1 structural + 1 architecture +
 * 6 ΗΛΜ + 1 topography + 5 κοινά. Λάθος άθροιση που αντιγράφηκε από έγγραφο σε
 * έγγραφο χωρίς κανείς να ανοίξει το αρχείο — ακριβώς ο κανόνας N.12.
 *
 * ⚠️ ΜΗΝ το «διορθώσεις» πίσω σε 16. Αν κάποτε γίνει 16, θα είναι επειδή
 * προστέθηκε καρτέλα — και τότε η καρτέλα θέλει **ανάθεση**, όχι αλλαγή αριθμού.
 */
const PERMANENT_TAB_COUNT = 15;

/** Τα μετρημένα πλήθη του ADR-748 §5.1 — η προδιαγραφή, όχι το αποτέλεσμα. */
const EXPECTED_TAB_COUNT: Readonly<Record<string, number>> = {
  architectural: 7,
  structural: 7,
  mep: 12,
  topographic: 7,
  presentation: 5,
  all: PERMANENT_TAB_COUNT,
};

describe('ADR-748 §5.1 — ανάθεση ribbon καρτελών σε θέσεις ειδικότητας', () => {
  describe('ολικότητα (Υ-4: gate για αδήλωτη καρτέλα)', () => {
    it('κάθε μόνιμη καρτέλα του DEFAULT_RIBBON_TAB_ORDER είναι δηλωμένη', () => {
      const undeclared = DEFAULT_RIBBON_TAB_ORDER.filter(
        (id) => RIBBON_TAB_SPECIALTIES[id] === undefined,
      );
      expect(undeclared).toEqual([]);
    });

    it('καμία δήλωση δεν δείχνει σε ανύπαρκτη καρτέλα', () => {
      const known = new Set<string>(DEFAULT_RIBBON_TAB_ORDER);
      const orphans = Object.keys(RIBBON_TAB_SPECIALTIES).filter(
        (id) => !known.has(id),
      );
      expect(orphans).toEqual([]);
    });

    it('κάθε καρτέλα ανήκει σε τουλάχιστον μία θέση (καμία μόνιμα αόρατη)', () => {
      const orphaned = Object.entries(RIBBON_TAB_SPECIALTIES)
        .filter(([, specialties]) => specialties.length === 0)
        .map(([id]) => id);
      expect(orphaned).toEqual([]);
    });

    it('το DEFAULT_RIBBON_TAB_ORDER έχει 15 μόνιμες καρτέλες (μετρημένο, βλ. σχόλιο)', () => {
      expect(DEFAULT_RIBBON_TAB_ORDER).toHaveLength(PERMANENT_TAB_COUNT);
    });

    it('κάθε δηλωμένο id αντιστοιχεί σε υπαρκτό RibbonTab', () => {
      const definedIds = new Set(DEFAULT_RIBBON_TABS.map((tab) => tab.id));
      const missing = Object.keys(RIBBON_TAB_SPECIALTIES).filter(
        (id) => !definedIds.has(id),
      );
      expect(missing).toEqual([]);
    });
  });

  describe('τα μετρημένα πλήθη του §5.1 — 7 / 7 / 12 / 7 / 5 / 16', () => {
    it.each(RIBBON_SPECIALTY_ORDER)('«%s» δείχνει το σωστό πλήθος', (specialty) => {
      const visible = resolveVisibleTabIds(DEFAULT_RIBBON_TAB_ORDER, specialty);
      expect(visible).toHaveLength(EXPECTED_TAB_COUNT[specialty]);
    });

    it('«Όλα» = ακριβώς η σημερινή συμπεριφορά, χωρίς καμία αφαίρεση', () => {
      expect(resolveVisibleTabIds(DEFAULT_RIBBON_TAB_ORDER, RIBBON_SPECIALTY_ALL))
        .toEqual(DEFAULT_RIBBON_TAB_ORDER);
    });

    it('τα Αρχιτεκτονικά κρατούν architecture και ΟΧΙ structural/ΗΛΜ', () => {
      const visible = resolveVisibleTabIds(DEFAULT_RIBBON_TAB_ORDER, 'architectural');
      expect(visible).toContain('architecture');
      expect(visible).not.toContain('structural');
      expect(visible).not.toContain('electrical');
      expect(visible).not.toContain('topography');
    });

    it('τα ΗΛΜ κρατούν και τις έξι μελέτες Η/Μ (ADR-444)', () => {
      const visible = resolveVisibleTabIds(DEFAULT_RIBBON_TAB_ORDER, 'mep');
      for (const tab of ['electrical', 'water', 'drainage', 'heating', 'hvac', 'fire-gas']) {
        expect(visible).toContain(tab);
      }
    });

    it('η Παρουσίαση αφαιρεί «Ανάλυση» και «Ρυθμίσεις», κρατά «Προβολή»', () => {
      const visible = resolveVisibleTabIds(DEFAULT_RIBBON_TAB_ORDER, 'presentation');
      expect(visible).not.toContain('analyze');
      expect(visible).not.toContain('settings');
      expect(visible).toContain('view');
      expect(visible).toContain('annotate');
    });

    it('η «Αρχική» επιβιώνει σε ΚΑΘΕ θέση — ποτέ κενή γραμμή καρτελών', () => {
      for (const specialty of RIBBON_SPECIALTY_ORDER) {
        expect(resolveVisibleTabIds(DEFAULT_RIBBON_TAB_ORDER, specialty)).toContain('home');
      }
    });

    it('η σειρά των καρτελών διατηρείται μετά το φιλτράρισμα', () => {
      const visible = resolveVisibleTabIds(DEFAULT_RIBBON_TAB_ORDER, 'structural');
      const expectedOrder = DEFAULT_RIBBON_TAB_ORDER.filter((id) => visible.includes(id));
      expect(visible).toEqual(expectedOrder);
    });
  });

  describe('ο δείκτης «Χ κρυμμένες» (Α-3 — ποτέ σιωπηλή απόκρυψη)', () => {
    it('«Όλα» ⇒ μηδέν κρυμμένες', () => {
      expect(countHiddenTabs(RIBBON_SPECIALTY_ALL)).toBe(0);
    });

    it.each(['architectural', 'structural', 'mep', 'topographic', 'presentation'] as const)(
      '«%s» ⇒ ο δείκτης ισούται με το σύνολο μείον τις ορατές',
      (specialty) => {
        expect(countHiddenTabs(specialty)).toBe(
          PERMANENT_TAB_COUNT - EXPECTED_TAB_COUNT[specialty],
        );
      },
    );

    it('κάθε θέση εκτός του «Όλα» κρύβει όντως κάτι (αλλιώς ο διακόπτης λέει ψέματα)', () => {
      for (const specialty of RIBBON_SPECIALTY_ORDER) {
        if (specialty === RIBBON_SPECIALTY_ALL) continue;
        expect(countHiddenTabs(specialty)).toBeGreaterThan(0);
      }
    });
  });

  describe('η γέφυρα με το λεξιλόγιο Discipline του ADR-405 (κανένα 5ο λεξιλόγιο)', () => {
    it('κάθε discipline που δηλώνεται υπάρχει στο ADR-405', () => {
      const known = new Set<string>([
        'architectural', 'structural', 'electrical', 'mechanical',
        'plumbing', 'fire', 'civil', 'telecom', 'interior', 'general',
      ]);
      for (const disciplines of Object.values(SPECIALTY_DISCIPLINES)) {
        for (const discipline of disciplines) expect(known.has(discipline)).toBe(true);
      }
    });

    it('κάθε ΤΟΠΟΘΕΤΗΣΙΜΗ discipline καλύπτεται από κάποια θέση του διακόπτη', () => {
      const covered = new Set(Object.values(SPECIALTY_DISCIPLINES).flat());
      const uncovered = MODEL_DISCIPLINES.filter((d) => !covered.has(d));
      expect(uncovered).toEqual([]);
    });

    it('η «Παρουσίαση» δεν είναι ειδικότητα — καμία discipline, επίτηδες', () => {
      expect(SPECIALTY_DISCIPLINES.presentation).toEqual([]);
    });
  });

  describe('type guard — τιμή από localStorage δεν εμπιστεύεται ποτέ', () => {
    it.each(RIBBON_SPECIALTY_ORDER)('δέχεται την έγκυρη τιμή «%s»', (specialty) => {
      expect(isRibbonSpecialtySelection(specialty)).toBe(true);
    });

    it.each(['', 'ALL', 'architecture', 'mep ', 'null', '{}'])(
      'απορρίπτει το άκυρο «%s»',
      (raw) => {
        expect(isRibbonSpecialtySelection(raw)).toBe(false);
      },
    );
  });

  describe('fail-open για αδήλωτη καρτέλα (το φίλτρο είναι UX, όχι ασφάλεια)', () => {
    it('άγνωστο id παραμένει ορατό αντί να εξαφανιστεί σιωπηλά', () => {
      const withUnknown = [...DEFAULT_RIBBON_TAB_ORDER, 'a-brand-new-tab'];
      expect(resolveVisibleTabIds(withUnknown, 'structural')).toContain('a-brand-new-tab');
    });
  });

  describe('i18n (N.11) — μηδέν ωμό αλφαριθμητικό', () => {
    it('κάθε θέση έχει κλειδί ετικέτας', () => {
      for (const specialty of RIBBON_SPECIALTY_ORDER) {
        expect(RIBBON_SPECIALTY_LABEL_KEY[specialty]).toMatch(/^ribbon\.specialty\.names\./);
      }
    });

    it('τα κλειδιά είναι μοναδικά ανά θέση', () => {
      const keys = RIBBON_SPECIALTY_ORDER.map((s) => RIBBON_SPECIALTY_LABEL_KEY[s]);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  describe('χρυσός κανόνας §5 — το φίλτρο μόνο ΑΦΑΙΡΕΙ', () => {
    it('καμία θέση δεν εμφανίζει καρτέλα εκτός του DEFAULT_RIBBON_TAB_ORDER', () => {
      const known = new Set<string>(DEFAULT_RIBBON_TAB_ORDER);
      for (const specialty of RIBBON_SPECIALTY_ORDER) {
        for (const id of resolveVisibleTabIds(DEFAULT_RIBBON_TAB_ORDER, specialty)) {
          expect(known.has(id)).toBe(true);
        }
      }
    });

    it('κάθε θέση παράγει υποσύνολο του «Όλα»', () => {
      const all = new Set(resolveVisibleTabIds(DEFAULT_RIBBON_TAB_ORDER, RIBBON_SPECIALTY_ALL));
      for (const specialty of RIBBON_SPECIALTY_ORDER) {
        for (const id of resolveVisibleTabIds(DEFAULT_RIBBON_TAB_ORDER, specialty)) {
          expect(all.has(id)).toBe(true);
        }
      }
    });
  });
});

describe('ADR-748 — SPECIALTY_DISCIPLINES δεν επικαλύπτεται ανά μελέτη', () => {
  it('καμία discipline δεν ανήκει σε δύο θέσεις (πλην κενής Παρουσίασης)', () => {
    const seen = new Map<string, RibbonSpecialtyId>();
    for (const [specialty, disciplines] of Object.entries(SPECIALTY_DISCIPLINES)) {
      for (const discipline of disciplines) {
        expect(seen.has(discipline)).toBe(false);
        seen.set(discipline, specialty as RibbonSpecialtyId);
      }
    }
  });
});
