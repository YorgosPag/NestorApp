/**
 * ADR-716 Φ4 — το readout δεν επιτρέπεται να δείξει ωμό κλειδί ούτε λάθος στρογγυλοποίηση.
 *
 * ⚠️ Τα κλειδιά του readout είναι **δυναμικά** (`t(decision.evidenceKey)`), άρα το CHECK 3.8
 * (που σαρώνει `t('literal')`) είναι **τυφλό** σε αυτά: αν λείπει μετάφραση, ο μηχανικός θα δει
 * `floorplanImport.drawingUnits.evidence.geodetic` στην οθόνη και κανένα gate δεν θα το πιάσει.
 * Αυτό το τεστ είναι το μόνο όργανο που τα βλέπει — και τα ελέγχει σε **ΚΑΙ τις δύο** γλώσσες.
 */

import el from '@/i18n/locales/el/files-media.json';
import en from '@/i18n/locales/en/files-media.json';
import { formatMetres, UNIT_LABEL_KEY } from '../UnitEvidenceReadout';
import { UNIT_EVIDENCE_KEYS, type UnitConfidence } from '@/subapps/dxf-viewer/utils/import-unit-decision';
import type { SceneUnits } from '@/subapps/dxf-viewer/utils/scene-units';

const LOCALES: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ['el', el as unknown as Record<string, unknown>],
  ['en', en as unknown as Record<string, unknown>],
];

/** Διασχίζει ένα i18n κλειδί με τελείες. Επιστρέφει `undefined` αν λείπει οποιοδήποτε σκαλί. */
function lookup(bundle: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    bundle,
  );
}

const ALL_CONFIDENCES: readonly UnitConfidence[] = ['explicit', 'identified', 'declared', 'weak', 'default'];
const ALL_UNITS: readonly SceneUnits[] = ['mm', 'cm', 'm', 'in', 'ft'];

describe('ADR-716 Φ4 — κάθε δυναμικό κλειδί του readout υπάρχει σε el ΚΑΙ en', () => {
  it.each(LOCALES)('%s: όλα τα κλειδιά τεκμηρίου αναλύονται σε κείμενο', (_lang, bundle) => {
    for (const confidence of ALL_CONFIDENCES) {
      const value = lookup(bundle, UNIT_EVIDENCE_KEYS[confidence]);
      expect(typeof value).toBe('string');
      expect(value).not.toBe('');
    }
  });

  it.each(LOCALES)('%s: όλες οι ετικέτες μονάδων αναλύονται σε κείμενο', (_lang, bundle) => {
    for (const unit of ALL_UNITS) {
      expect(typeof lookup(bundle, UNIT_LABEL_KEY[unit])).toBe('string');
    }
  });

  it.each(LOCALES)('%s: οι δύο γραμμές του readout υπάρχουν με ICU placeholders', (_lang, bundle) => {
    const resolved = lookup(bundle, 'floorplanImport.drawingUnits.resolved');
    const extent = lookup(bundle, 'floorplanImport.drawingUnits.extent');
    expect(String(resolved)).toContain('{unit}');
    expect(String(extent)).toContain('{width}');
    expect(String(extent)).toContain('{height}');
    // CHECK 3.9 — ICU θέλει ΜΟΝΑ άγκιστρα· `{{var}}` δεν αντικαθίσταται ποτέ.
    expect(String(extent)).not.toContain('{{');
  });

  it('κάθε confidence έχει ΔΙΚΟ του κλειδί — καμία σιωπηλή επικάλυψη τεκμηρίων', () => {
    const keys = ALL_CONFIDENCES.map(c => UNIT_EVIDENCE_KEYS[c]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('ADR-716 §8.1 — η στρογγυλοποίηση δεν επιτρέπεται να κρύψει ένα ×100', () => {
  it('τοπογραφικό: ακέραια μέτρα (587, όχι 586,8)', () => {
    expect(formatMetres(586.8003)).toBe('587');
    expect(formatMetres(487.94)).toBe('488');
  });

  it('το ίδιο σχέδιο με ×100 σφάλμα παραμένει ΟΡΑΤΑ διαφορετικό (5,9 — όχι «6»)', () => {
    expect(formatMetres(5.868)).toBe('5.9');
  });

  it('μικρά σχέδια κρατούν δεκαδικό — 12,5 m δεν γίνεται 13', () => {
    expect(formatMetres(12.5)).toBe('12.5');
    expect(formatMetres(99.94)).toBe('99.9');
    expect(formatMetres(100.4)).toBe('100');
  });
});
