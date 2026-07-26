/**
 * ADR-375 — Object Styles tests.
 */
import { describe, it, expect } from '@jest/globals';
import { DEFAULT_OBJECT_STYLES, BIM_CATEGORY_LINE_COLORS, type BimCategory } from '../bim-object-styles';
import { PEN_COUNT } from '../bim-pen-table';

const CATEGORIES: BimCategory[] = [
  'wall', 'column', 'beam', 'slab', 'opening', 'slab-opening',
  'stair', 'roof', 'ceiling', 'dimension', 'hatch', 'grip',
];

describe('DEFAULT_OBJECT_STYLES', () => {
  it('has an entry for every BimCategory', () => {
    for (const cat of CATEGORIES) {
      expect(DEFAULT_OBJECT_STYLES[cat]).toBeDefined();
    }
  });

  it('all projectionPen values are within 1-16', () => {
    for (const cat of CATEGORIES) {
      const p = DEFAULT_OBJECT_STYLES[cat].projectionPen;
      expect(p).toBeGreaterThanOrEqual(1);
      expect(p).toBeLessThanOrEqual(PEN_COUNT);
    }
  });

  it('all cutPen values are within 1-16', () => {
    for (const cat of CATEGORIES) {
      const c = DEFAULT_OBJECT_STYLES[cat].cutPen;
      expect(c).toBeGreaterThanOrEqual(1);
      expect(c).toBeLessThanOrEqual(PEN_COUNT);
    }
  });

  it('cutPen >= projectionPen (cut lines are heavier)', () => {
    for (const cat of CATEGORIES) {
      const style = DEFAULT_OBJECT_STYLES[cat];
      expect(style.cutPen).toBeGreaterThanOrEqual(style.projectionPen);
    }
  });

  it('column cutPen (9) > wall cutPen (7) — structural hierarchy', () => {
    expect(DEFAULT_OBJECT_STYLES.column.cutPen).toBeGreaterThan(DEFAULT_OBJECT_STYLES.wall.cutPen);
  });

  it('wall cutPen > beam cutPen > opening cutPen — hierarchy', () => {
    expect(DEFAULT_OBJECT_STYLES.wall.cutPen).toBeGreaterThan(DEFAULT_OBJECT_STYLES.beam.cutPen);
    expect(DEFAULT_OBJECT_STYLES.beam.cutPen).toBeGreaterThan(DEFAULT_OBJECT_STYLES.opening.cutPen);
  });
});

describe('ADR-375 C.9 — Revit-grade προκαθορισμένα χρώματα γραμμής (παλέτα A)', () => {
  it('εξωτ. τοίχος = parent wall χρώμα (σκούρο/βαρύ)', () => {
    expect(DEFAULT_OBJECT_STYLES.wall.projectionColor).toBe(BIM_CATEGORY_LINE_COLORS.wallExterior);
    expect(DEFAULT_OBJECT_STYLES.wall.cutColor).toBe(BIM_CATEGORY_LINE_COLORS.wallExterior);
  });

  it('εσωτ. τοίχος = subcategory wall:interior (γκρι)', () => {
    const sub = DEFAULT_OBJECT_STYLES.wall.subcategories?.['interior'];
    expect(sub?.projectionColor).toBe(BIM_CATEGORY_LINE_COLORS.wallInterior);
    expect(sub?.cutColor).toBe(BIM_CATEGORY_LINE_COLORS.wallInterior);
  });

  it('κολώνα = parent column (slate)· τοιχίο = subcategory column:shear-wall', () => {
    expect(DEFAULT_OBJECT_STYLES.column.projectionColor).toBe(BIM_CATEGORY_LINE_COLORS.column);
    const sub = DEFAULT_OBJECT_STYLES.column.subcategories?.['shear-wall'];
    expect(sub?.projectionColor).toBe(BIM_CATEGORY_LINE_COLORS.shearWall);
    expect(sub?.cutColor).toBe(BIM_CATEGORY_LINE_COLORS.shearWall);
  });

  it('πλάκα = taupe (parent)', () => {
    expect(DEFAULT_OBJECT_STYLES.slab.projectionColor).toBe(BIM_CATEGORY_LINE_COLORS.slab);
    expect(DEFAULT_OBJECT_STYLES.slab.cutColor).toBe(BIM_CATEGORY_LINE_COLORS.slab);
  });

  it('πόρτα = πορτοκαλί σε όλα τα door-* subcategories', () => {
    const doorKeys = ['door-opening', 'door-frame', 'door-glass', 'door-plan-swing', 'wall-cutout-jambs', 'sliding-track'];
    for (const k of doorKeys) {
      expect(DEFAULT_OBJECT_STYLES.opening.subcategories?.[k]?.cutColor).toBe(BIM_CATEGORY_LINE_COLORS.door);
    }
  });

  it('παράθυρο = μπλε σε όλα τα window-* subcategories', () => {
    const winKeys = ['window-opening', 'window-frame', 'window-glass'];
    for (const k of winKeys) {
      expect(DEFAULT_OBJECT_STYLES.opening.subcategories?.[k]?.cutColor).toBe(BIM_CATEGORY_LINE_COLORS.window);
    }
  });

  /**
   * ADR-375 C.9 — καμία **ΑΚΟΥΣΙΑ** σύγκρουση απόχρωσης. Ο έλεγχος δεν είναι «όλα διαφορετικά»:
   * υπάρχει **ΜΙΑ σκόπιμη** κοινή απόχρωση, το `MEP_TEAL_COLOR` (`color-config.ts`), που μοιράζονται
   * ο ηλεκτρικός πίνακας (equipment teal) και ο θερμικός χώρος (analytical teal) — δύο κατηγορίες
   * που δεν συνυπάρχουν ποτέ στην ίδια όψη (η μία είναι εξοπλισμός, η άλλη αναλυτικό κέλυφος).
   *
   * Γι' αυτό η δικλείδα μετρά **ομάδες** αντί για τιμές: κάθε απόχρωση επιτρέπεται να
   * χρησιμοποιείται από όσα κλειδιά δηλώνει ρητά το {@link SHARED_HUES}. Έτσι μια νέα, **ακούσια**
   * σύγκρουση (δύο κατηγορίες που κατέληξαν τυχαία στο ίδιο hex) εξακολουθεί να ΚΟΚΚΙΝΙΖΕΙ — που
   * είναι όλο το νόημα του ελέγχου. Ένα σκέτο `Set(palette).size === palette.length` ήταν
   * **μονίμως κόκκινο** από το commit `7eb1cc05` (2026-07-12), όταν μπήκε το δεύτερο teal: μια
   * δικλείδα που αντιφάσκει με τεκμηριωμένη απόφαση δεν προστατεύει τίποτα, απλώς αγνοείται.
   */
  const SHARED_HUES: Readonly<Record<string, readonly string[]>> = {
    // teal — ADR-408 Φ3 (electricalPanel) + ADR-422/571 (thermalSpace). Δηλωμένο στο color-config.
    '#0d9488': ['electricalPanel', 'thermalSpace'],
  };

  it('καμία ΑΚΟΥΣΙΑ σύγκρουση απόχρωσης (οι σκόπιμα κοινές δηλώνονται ρητά)', () => {
    const byHue = new Map<string, string[]>();
    for (const [key, hue] of Object.entries(BIM_CATEGORY_LINE_COLORS)) {
      byHue.set(hue, [...(byHue.get(hue) ?? []), key]);
    }
    for (const [hue, keys] of byHue) {
      const allowed = SHARED_HUES[hue];
      // Χωρίς ρητή δήλωση, μια απόχρωση ανήκει σε ΜΙΑ κατηγορία.
      expect(keys).toEqual(allowed ? [...allowed] : [keys[0]]);
    }
  });

  it('η σκόπιμη κοινή απόχρωση παραμένει τεκμηριωμένη (ΟΧΙ σιωπηλή διαγραφή)', () => {
    // Αν κάποιος δώσει ξεχωριστό teal στον θερμικό χώρο, ΑΥΤΟ το test κοκκινίζει και ζητά να
    // αφαιρεθεί η εγγραφή από το `SHARED_HUES` — δηλαδή η απόφαση αλλάζει ρητά, όχι κατά λάθος.
    expect(BIM_CATEGORY_LINE_COLORS.electricalPanel).toBe(BIM_CATEGORY_LINE_COLORS.thermalSpace);
  });
});
