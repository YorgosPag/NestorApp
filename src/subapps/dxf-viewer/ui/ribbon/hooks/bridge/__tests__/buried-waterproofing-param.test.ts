/**
 * ADR-715 — το bridge στεγάνωσης του «Κοντόστυλου» (Properties panel), κλειδωμένο.
 *
 * Τρία πράγματα που αν σπάσουν είναι **αόρατα στην οθόνη** και εμφανίζονται στην επιμέτρηση:
 *   1. η ανάγνωση είναι **resolved** (έργο χωρίς spec δείχνει το πραγματικό default, όχι κενό),
 *   2. η γραφή είναι **merge** (αλλαγή υλικού δεν σβήνει τον διακόπτη),
 *   3. τα options είναι **παράγωγα** του καταλόγου (νέο υλικό εμφανίζεται χωρίς να το θυμηθεί κανείς).
 *
 * @see ../buried-waterproofing-param.ts
 */

import {
  BURIED_WATERPROOFING_ENABLED_OPTIONS,
  BURIED_WATERPROOFING_MATERIAL_OPTIONS,
  readBuriedWaterproofingValue,
  applyBuriedWaterproofingParam,
} from '../buried-waterproofing-param';
import {
  BURIED_WATERPROOFING_CATALOG,
  DEFAULT_BURIED_WATERPROOFING_MATERIAL,
  WATERPROOF_MEMBRANE_MATERIAL,
} from '../../../../../bim/finishes/buried-waterproofing';

describe('ADR-715 — ανάγνωση (πάντα resolved, ποτέ κενό)', () => {
  it('απόν spec → «ενεργό» + ασφαλτική επάλειψη (ADR-713 §2.3: ό,τι θάβεται στεγανώνεται)', () => {
    // Κενό control εδώ θα διάβαζε ως «καμία στεγάνωση» — ψέμα: εφαρμόζεται ήδη αυτόματα.
    expect(readBuriedWaterproofingValue(undefined, 'enabled')).toBe('on');
    expect(readBuriedWaterproofingValue(undefined, 'materialId')).toBe(DEFAULT_BURIED_WATERPROOFING_MATERIAL);
  });

  it('ρητό `enabled:false` → «off» (ο μηχανικός το έκλεισε συνειδητά)', () => {
    expect(readBuriedWaterproofingValue({ enabled: false }, 'enabled')).toBe('off');
  });

  it('ρητό υλικό διαβάζεται αυτούσιο', () => {
    expect(readBuriedWaterproofingValue({ materialId: WATERPROOF_MEMBRANE_MATERIAL }, 'materialId'))
      .toBe(WATERPROOF_MEMBRANE_MATERIAL);
  });
});

describe('ADR-715 — γραφή (merge, όχι replace)', () => {
  it('αλλαγή υλικού ΔΕΝ αγγίζει… και μάλιστα ΕΝΕΡΓΟΠΟΙΕΙ ρητά τη στεγάνωση', () => {
    // Διαλέγοντας μεμβράνη σε κλειστή στεγάνωση, η πρόθεση είναι «στεγάνωσε με μεμβράνη» —
    // αλλιώς ο χρήστης θα διάλεγε υλικό που δεν εφαρμόζεται πουθενά και θα το ανακάλυπτε
    // μόνο από την απούσα γραμμή επιμέτρησης.
    const next = applyBuriedWaterproofingParam({ enabled: false }, 'materialId', WATERPROOF_MEMBRANE_MATERIAL);
    expect(next).toEqual({ enabled: true, materialId: WATERPROOF_MEMBRANE_MATERIAL });
  });

  it('αλλαγή διακόπτη ΔΕΝ σβήνει το επιλεγμένο υλικό', () => {
    const next = applyBuriedWaterproofingParam({ materialId: WATERPROOF_MEMBRANE_MATERIAL }, 'enabled', 'off');
    expect(next).toEqual({ enabled: false, materialId: WATERPROOF_MEMBRANE_MATERIAL });
  });

  it('άγνωστο υλικό → `null` (no-op)', () => {
    // Fail-closed: υλικό εκτός καταλόγου δεν λύνεται σε άρθρο ΑΤΟΕ, άρα δεν επιμετρείται —
    // γράφοντάς το θα δημιουργούσαμε στεγάνωση χωρίς τιμή.
    expect(applyBuriedWaterproofingParam(undefined, 'materialId', 'mat-brick')).toBeNull();
  });

  it('άκυρη τιμή διακόπτη → `null` (no-op)', () => {
    expect(applyBuriedWaterproofingParam(undefined, 'enabled', 'maybe')).toBeNull();
  });
});

describe('ADR-715 — τα options είναι ΠΑΡΑΓΩΓΑ του καταλόγου', () => {
  it('ίδιο πλήθος και ίδια σειρά με τον κατάλογο (συχνότερο πρώτα)', () => {
    expect(BURIED_WATERPROOFING_MATERIAL_OPTIONS.map((o) => o.value))
      .toEqual(BURIED_WATERPROOFING_CATALOG.map((o) => o.id));
  });

  it('κάθε ετικέτα είναι i18n key `constructionMaterials.<id>` — ποτέ ωμό id στην οθόνη', () => {
    // ADR-713 πρόσθεσε 3 υλικά και ΞΕΧΑΣΕ τις ετικέτες (§5.2). Το CHECK 3.8 δεν το πιάνει
    // (δυναμικό κλειδί), άρα η δικλείδα είναι εδώ.
    for (const option of BURIED_WATERPROOFING_MATERIAL_OPTIONS) {
      expect(option.labelKey).toBe(`constructionMaterials.${option.value}`);
      expect(option.isLiteralLabel).toBe(false);
    }
  });

  it('η ομαδοποίηση αντιστοιχεί στο `kind` του καταλόγου (επάλειψη vs μεμβράνη)', () => {
    for (const [index, option] of BURIED_WATERPROOFING_MATERIAL_OPTIONS.entries()) {
      const expectedKind = BURIED_WATERPROOFING_CATALOG[index].kind;
      expect(option.groupLabelKey).toContain(expectedKind === 'coating' ? 'kindCoating' : 'kindMembrane');
    }
  });

  it('οι ομάδες είναι ΣΥΝΕΧΟΜΕΝΕΣ (αλλιώς το Radix θα έδειχνε την ίδια κεφαλίδα δύο φορές)', () => {
    const groups = BURIED_WATERPROOFING_MATERIAL_OPTIONS.map((o) => o.groupLabelKey);
    const transitions = groups.filter((g, i) => i > 0 && g !== groups[i - 1]).length;
    expect(transitions).toBe(1); // coating… → membrane…, μία μόνο μετάβαση
  });

  it('ο διακόπτης είναι δυαδικός on/off', () => {
    expect(BURIED_WATERPROOFING_ENABLED_OPTIONS.map((o) => o.value)).toEqual(['on', 'off']);
  });
});
