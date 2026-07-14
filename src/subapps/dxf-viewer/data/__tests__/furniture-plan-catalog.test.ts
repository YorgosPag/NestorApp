/**
 * ADR-654 — Furniture plan catalog: ο SSoT της ΚΛΙΜΑΚΑΣ.
 *
 * Αυτά τα tests φυλάνε το ένα πράγμα που πήγε στραβά στον σχεδιασμό και πιάστηκε στους
 * αριθμούς: αν η κατηγορία όριζε «πλάτος» και το εφαρμόζαμε στον άξονα x, ένας ΚΑΘΕΤΑ
 * γυρισμένος διθέσιος (aspect 0.57) θα έβγαινε 2632mm ΒΑΘΥΣ. Το μοντέλο είναι «μεγάλη
 * πλευρά»: το μήκος της κατηγορίας πάει στη ΜΕΓΑΛΗ διάσταση του sprite, όποια κι αν είναι.
 */

import {
  getFurniturePlanDef,
  getFurniturePlanLabelParts,
  getFurniturePlanSizeMm,
  listFurniturePlanDefs,
  FURNITURE_PLAN_LONG_SIDE_MM,
} from '../furniture-plan-catalog';

const STYLES = new Set([
  'solid', 'floral', 'leather', 'striped', 'retro',
  'modern', 'plaid', 'checkered', 'classic', 'velvet',
]);
const KINDS = new Set(['individual', 'composition']);

describe('furniture-plan-catalog — ακεραιότητα', () => {
  it('όλα τα ids είναι μοναδικά', () => {
    const ids = listFurniturePlanDefs().map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('κάθε def έχει θετικό, πεπερασμένο aspect', () => {
    for (const def of listFurniturePlanDefs()) {
      expect(Number.isFinite(def.aspect)).toBe(true);
      expect(def.aspect).toBeGreaterThan(0);
    }
  });

  it('κάθε κατηγορία του catalog έχει ορισμένο μήκος', () => {
    for (const def of listFurniturePlanDefs()) {
      expect(FURNITURE_PLAN_LONG_SIDE_MM[def.category]).toBeGreaterThan(0);
    }
  });
});

describe('getFurniturePlanSizeMm — «μεγάλη πλευρά», ΟΧΙ «πλάτος»', () => {
  it('LANDSCAPE sprite (aspect > 1): το μήκος πάει στο ΠΛΑΤΟΣ', () => {
    // furn-obj-001-1 = τριθέσιος, aspect 2.4363 → 2100 × 862
    const size = getFurniturePlanSizeMm('furn-obj-001-1');
    expect(size).not.toBeNull();
    expect(size!.widthMm).toBeCloseTo(2100, 0);
    expect(size!.heightMm).toBeCloseTo(2100 / 2.4363, 0);
    expect(size!.widthMm).toBeGreaterThan(size!.heightMm);
  });

  it('PORTRAIT sprite (aspect < 1): το μήκος πάει στο ΥΨΟΣ — ο διθέσιος ΔΕΝ γίνεται τέρας', () => {
    // furn-obj-001-2 = διθέσιος γυρισμένος κάθετα, aspect 0.571.
    // ΛΑΘΟΣ μοντέλο («πλάτος»): 1500 × 2627  ← 2.6m βάθος, αδύνατο.
    // ΣΩΣΤΟ μοντέλο («μεγάλη πλευρά»): 857 × 1500.
    const size = getFurniturePlanSizeMm('furn-obj-001-2');
    expect(size).not.toBeNull();
    expect(size!.heightMm).toBeCloseTo(1500, 0);
    expect(size!.widthMm).toBeCloseTo(1500 * 0.571, 0);
    expect(size!.widthMm).toBeLessThan(1000); // ρεαλιστικό βάθος καναπέ
  });

  it('το διπλό κρεβάτι βγαίνει σε πραγματικές διαστάσεις', () => {
    // furn-obj-120-1, aspect 0.7835, μήκος κρεβατιού 2000 → ~1567 × 2000
    const size = getFurniturePlanSizeMm('furn-obj-120-1');
    expect(size!.heightMm).toBeCloseTo(2000, 0);
    expect(size!.widthMm).toBeGreaterThan(1400);
    expect(size!.widthMm).toBeLessThan(1750);
  });

  it('οι αναλογίες του sprite διατηρούνται ΠΑΝΤΑ (μηδέν παραμόρφωση)', () => {
    for (const def of listFurniturePlanDefs()) {
      const size = getFurniturePlanSizeMm(def.id);
      expect(size).not.toBeNull();
      expect(size!.widthMm / size!.heightMm).toBeCloseTo(def.aspect, 3);
    }
  });

  it('η μεγάλη πλευρά ισούται ΠΑΝΤΑ με το μήκος της κατηγορίας', () => {
    for (const def of listFurniturePlanDefs()) {
      const size = getFurniturePlanSizeMm(def.id)!;
      const longSide = Math.max(size.widthMm, size.heightMm);
      expect(longSide).toBeCloseTo(FURNITURE_PLAN_LONG_SIDE_MM[def.category], 6);
    }
  });

  it('άγνωστο id → null (ο καλών δεν τοποθετεί σκουπίδι)', () => {
    expect(getFurniturePlanSizeMm('furn-δεν-υπάρχει')).toBeNull();
    expect(getFurniturePlanDef('furn-δεν-υπάρχει')).toBeUndefined();
  });
});

describe('faceted taxonomy — category + kind + style + series (M7 Φάση Γ)', () => {
  it('κάθε def έχει έγκυρο στυλ από το controlled λεξιλόγιο', () => {
    for (const def of listFurniturePlanDefs()) {
      expect(STYLES.has(def.facets.style)).toBe(true);
    }
  });

  it('κάθε def έχει έγκυρο kind (Μεμονωμένα ⇄ Συνθέσεις)', () => {
    for (const def of listFurniturePlanDefs()) {
      expect(KINDS.has(def.facets.kind)).toBe(true);
    }
  });

  it('κάθε def έχει series ακέραιο ≥ 1', () => {
    for (const def of listFurniturePlanDefs()) {
      expect(Number.isInteger(def.series)).toBe(true);
      expect(def.series).toBeGreaterThanOrEqual(1);
    }
  });

  it('το series είναι μοναδικό μέσα σε κάθε ζεύγος facets (category, kind, style)', () => {
    const seen = new Set<string>();
    for (const def of listFurniturePlanDefs()) {
      const key = `${def.category}/${def.facets.kind}/${def.facets.style}/${def.series}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('getFurniturePlanLabelParts δίνει i18n κλειδιά facets + series (μηδέν per-item strings)', () => {
    const def = listFurniturePlanDefs()[0];
    const parts = getFurniturePlanLabelParts(def);
    expect(parts.categoryKey).toBe(`furniturePlan.categories.${def.category}`);
    expect(parts.facetKeys.kind).toBe(`furniturePlan.kind.${def.facets.kind}`);
    expect(parts.facetKeys.style).toBe(`furniturePlan.style.${def.facets.style}`);
    expect(parts.series).toBe(def.series);
  });
});

describe('M7 Φάση Γ2 (images_4) — συνθέσεις + νέες κατηγορίες', () => {
  it('τα 379 αρχικά furn-obj/furn-rug παραμένουν στο catalog (μηδέν regression)', () => {
    const originals = listFurniturePlanDefs().filter(
      (d) => d.id.startsWith('furn-obj-') || d.id.startsWith('furn-rug-'),
    );
    expect(originals).toHaveLength(379);
    // όλα individual (τα σετ ήρθαν με το furn-set- prefix)
    expect(originals.every((d) => d.facets.kind === 'individual')).toBe(true);
  });

  it('υπάρχει ≥1 σύνθεση (composition) — Revit «Furniture Systems»', () => {
    const compositions = listFurniturePlanDefs().filter((d) => d.facets.kind === 'composition');
    expect(compositions.length).toBeGreaterThan(0);
    // κάθε composition ανήκει στα furn-set- (images_4)
    expect(compositions.every((d) => d.id.startsWith('furn-set-'))).toBe(true);
  });

  it('οι 17 νέες κατηγορίες images_4 έχουν ορισμένο μήκος + τουλάχιστον ένα sprite', () => {
    const newCats = [
      'diningSet', 'diningTable', 'desk', 'tvUnit', 'loungeSet', 'sideTable', 'umbrella',
      'bathtub', 'sunLounger', 'cooktop', 'tray', 'piano', 'toilet', 'kitchenSink', 'shower', 'stove',
      'centerpiece', // 9 floral-tray centerpieces (ήταν «plants», διακοσμητικά)
    ] as const;
    const present = new Set(listFurniturePlanDefs().map((d) => d.category));
    for (const cat of newCats) {
      expect(FURNITURE_PLAN_LONG_SIDE_MM[cat]).toBeGreaterThan(0);
      expect(present.has(cat)).toBe(true);
    }
  });
});
