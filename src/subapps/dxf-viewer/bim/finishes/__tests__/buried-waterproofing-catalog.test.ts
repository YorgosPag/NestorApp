/**
 * ADR-714 — Ο κατάλογος στεγάνωσης θαμμένων επιφανειών είναι ΠΛΗΡΗΣ σε ΚΑΘΕ επίπεδο.
 *
 * Ένα υλικό στεγάνωσης δεν είναι ένα string. Για να υπάρχει πραγματικά χρειάζεται **τέσσερα**
 * ανεξάρτητα κομμάτια, σε τέσσερα διαφορετικά αρχεία:
 *
 *   1. εγγραφή στον κατάλογο (`buried-waterproofing.ts`)
 *   2. χρώμα 3Δ (`material-catalog-defs.ts`)          → αλλιώς **αόρατο** / λάθος απόδοση
 *   3. άρθρο ΑΤΟΕ (`material-to-atoe-mapping.ts`)     → αλλιώς **ατιμολόγητο** στην επιμέτρηση
 *   4. ετικέτα i18n σε **el ΚΑΙ en**                  → αλλιώς **ανώνυμο** στο UI (παραβίαση N.11)
 *
 * Το ADR-713 πρόσθεσε 3 υλικά και **ξέχασε το (4)**: `mat-waterproof-*` δεν είχαν καμία ετικέτα
 * σε κανένα locale. Δεν φάνηκε επειδή τα υλικά εφαρμόζονταν μόνο **αυτόματα** — κανείς δεν τα
 * είδε ποτέ σε λίστα. Μόλις μπουν σε επιλογέα, θα εμφανίζονταν ως ωμά ids.
 *
 * ⚠️ Το CHECK 3.8 (missing i18n keys) **ΔΕΝ** θα το έπιανε: ψάχνει `t('key')` σε κώδικα, ενώ εδώ
 * το κλειδί συντίθεται δυναμικά (`constructionMaterialLabelKey(id)`). Το «0 violations» του N.11
 * σημαίνει «κανείς δεν κοίταξε», όχι «καθαρό» — αυτό το suite είναι το «κάποιος κοίταξε».
 */

import {
  BURIED_WATERPROOFING_CATALOG,
  BURIED_WATERPROOFING_MATERIALS,
  DEFAULT_BURIED_WATERPROOFING_MATERIAL,
  buriedWaterproofingByKind,
} from '../buried-waterproofing';
import { getMaterialColorById } from '../../materials/material-color-registry';
import { resolveMaterialAtoeMapping } from '../../config/material-to-atoe-mapping';
import { constructionMaterialLabelKey } from '../../materials/construction-materials';
import el from '@/i18n/locales/el/dxf-viewer-shell.json';
import en from '@/i18n/locales/en/dxf-viewer-shell.json';

/** Η ετικέτα ενός υλικού σε ένα locale bundle, μέσω του ΠΡΑΓΜΑΤΙΚΟΥ key builder. */
function labelIn(bundle: Record<string, unknown>, materialId: string): string | undefined {
  // `constructionMaterialLabelKey` → `constructionMaterials.<id>`· διασχίζουμε το path ώστε το
  // test να σπάει κι αν αλλάξει ο builder (δεν ξαναγράφουμε το prefix με το χέρι).
  const path = constructionMaterialLabelKey(materialId).split('.');
  let node: unknown = bundle;
  for (const part of path) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

describe('ADR-714 — κάθε υλικό στεγάνωσης είναι πλήρες (4/4 κομμάτια)', () => {
  it('ο κατάλογος έχει τα 8 υλικά, χωρίς διπλότυπα ids', () => {
    expect(BURIED_WATERPROOFING_CATALOG).toHaveLength(8);
    expect(new Set(BURIED_WATERPROOFING_MATERIALS).size).toBe(BURIED_WATERPROOFING_MATERIALS.length);
  });

  it.each(BURIED_WATERPROOFING_MATERIALS)('%s — έχει χρώμα 3Δ (αλλιώς αποδίδεται λάθος)', (id) => {
    expect(getMaterialColorById(id)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it.each(BURIED_WATERPROOFING_MATERIALS)('%s — έχει άρθρο ΑΤΟΕ σε m² (αλλιώς δεν τιμολογείται)', (id) => {
    const mapping = resolveMaterialAtoeMapping(id);
    expect(mapping).not.toBeNull();
    expect(mapping!.unit).toBe('m2');
    expect(mapping!.quantityKind).toBe('area');
  });

  it.each(BURIED_WATERPROOFING_MATERIALS)('%s — έχει ετικέτα ΚΑΙ στα ελληνικά ΚΑΙ στα αγγλικά', (id) => {
    for (const [locale, bundle] of [['el', el], ['en', en]] as const) {
      const label = labelIn(bundle as unknown as Record<string, unknown>, id);
      expect(`${locale}:${label ?? 'ΛΕΙΠΕΙ'}`).not.toContain('ΛΕΙΠΕΙ');
      expect((label ?? '').trim().length).toBeGreaterThan(0);
      // Ένα «label» ίσο με το id σημαίνει ότι κάποιος γέμισε το κενό με copy-paste του κλειδιού.
      expect(label).not.toBe(id);
    }
  });

  it('ΚΑΘΕ τεχνική έχει ΔΙΚΟ ΤΗΣ άρθρο — κοινός κωδικός = λάθος προϋπολογισμός', () => {
    const codes = BURIED_WATERPROOFING_MATERIALS.map((id) => resolveMaterialAtoeMapping(id)!.categoryCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('τα ΥΠΑΡΧΟΝΤΑ άρθρα δεν μετακινήθηκαν (υπάρχοντα έργα έχουν γραμμές πάνω τους)', () => {
    // Αλλαγή κωδικού σε υπάρχον υλικό = σιωπηλή αλλαγή τιμολόγησης σε ήδη παραδομένες μελέτες.
    expect(resolveMaterialAtoeMapping('mat-waterproof-bitumen')!.categoryCode).toBe('OIK-10.20');
    expect(resolveMaterialAtoeMapping('mat-waterproof-cementitious')!.categoryCode).toBe('OIK-10.21');
    expect(resolveMaterialAtoeMapping('mat-waterproof-membrane')!.categoryCode).toBe('OIK-10.22');
  });

  it('το default υλικό ανήκει στον κατάλογο (αλλιώς η αυτόματη στεγάνωση δείχνει σε κενό)', () => {
    expect(BURIED_WATERPROOFING_MATERIALS).toContain(DEFAULT_BURIED_WATERPROOFING_MATERIAL);
  });

  it('οι δύο κατηγορίες εφαρμογής ΔΙΑΜΕΡΙΖΟΥΝ τον κατάλογο (καμία επιλογή δεν χάνεται στο UI)', () => {
    const coatings = buriedWaterproofingByKind('coating');
    const membranes = buriedWaterproofingByKind('membrane');
    expect(coatings.length).toBeGreaterThan(0);
    expect(membranes.length).toBeGreaterThan(0);
    expect([...coatings, ...membranes].sort()).toEqual([...BURIED_WATERPROOFING_MATERIALS].sort());
  });
});
