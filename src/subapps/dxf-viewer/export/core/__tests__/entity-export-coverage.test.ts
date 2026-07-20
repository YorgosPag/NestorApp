/**
 * COVERAGE GUARD — κάθε renderable type έχει ΡΗΤΗ απόφαση εξαγωγής σε DXF ΚΑΙ TEK (ADR-648 Στάδιο Δ).
 *
 * Δένει το declarative `ENTITY_EXPORT_COVERAGE` με το ζωντανό domain `RENDERABLE_ENTITY_TYPES`:
 * νέος renderable τύπος → λείπει key → σπάει το test → επιβάλλει συνειδητή απόφαση ανά format
 * (mirror `rotate-entity-coverage`). Επιπλέον καρφώνει το τρέχον `missing` backlog ώστε το κλείσιμο
 * ενός κενού να είναι σκόπιμο (ενημέρωση πίνακα + ADR-648, όχι σιωπηλό).
 */

import {
  RENDERABLE_ENTITY_TYPES,
  DXF_RENDERABLE_TYPES,
} from '../../../rendering/contract/renderable-entity-type';
import {
  ENTITY_EXPORT_COVERAGE,
  entitiesWithExportGap,
  type ExportDecision,
} from '../entity-export-coverage';

const asSorted = (xs: readonly string[]): string[] => [...xs].sort();
const VALID: ReadonlySet<ExportDecision> = new Set(['native', 'decompose', 'tessellate', 'drop', 'missing']);

describe('Entity export coverage — declarative SSoT ↔ renderable domain (ADR-648 Δ)', () => {
  it('ΚΑΘΕ renderable type έχει entry (κανένας σιωπηλά ακάλυπτος)', () => {
    const missingKeys = RENDERABLE_ENTITY_TYPES.filter((t) => !(t in ENTITY_EXPORT_COVERAGE));
    expect(missingKeys).toEqual([]);
  });

  it('κανένα extra key πέρα από το domain (ο πίνακας δεν αποκλίνει)', () => {
    const extra = Object.keys(ENTITY_EXPORT_COVERAGE).filter(
      (k) => !(RENDERABLE_ENTITY_TYPES as readonly string[]).includes(k),
    );
    expect(extra).toEqual([]);
  });

  it('κάθε απόφαση είναι έγκυρη τιμή', () => {
    for (const t of RENDERABLE_ENTITY_TYPES) {
      expect(VALID.has(ENTITY_EXPORT_COVERAGE[t].dxf)).toBe(true);
      expect(VALID.has(ENTITY_EXPORT_COVERAGE[t].tek)).toBe(true);
    }
  });

  it('τα ellipse/spline/xline/ray ΔΕΝ είναι πλέον σιωπηλό skip στο DXF (ADR-648 Στάδιο Β)', () => {
    for (const t of ['ellipse', 'spline', 'xline', 'ray'] as const) {
      expect(ENTITY_EXPORT_COVERAGE[t].dxf).toBe('native');
    }
  });

  it('όλοι οι DXF primitive τύποι εξάγονται στο DXF (κανένα missing)', () => {
    const dxfMissing = DXF_RENDERABLE_TYPES.filter((t) => ENTITY_EXPORT_COVERAGE[t].dxf === 'missing');
    // Καρφωμένο golden: τα εναπομείναντα DXF κενά είναι τα annotation measurements (ADR-648 §7)
    // + το topo-surface (ADR-662 Φ2β Stage A — renderer χωρίς exporter· 3DFACE/POLYFACE MESH TODO).
    expect(asSorted(dxfMissing)).toEqual(
      asSorted(['angle-measurement', 'opening-info-tag', 'topo-surface']),
    );
  });

  it('το τρέχον export-gap backlog είναι καρφωμένο (κλείσιμο = σκόπιμη ενημέρωση)', () => {
    // Snapshot του backlog· μειώνεται καθώς κλείνουν τα κενά (ADR-648 §7). Αν αλλάξει → ενημέρωσε ADR.
    // 27 → 29: +leader (tek, ADR-635 Φ B) +topo-surface (dxf+tek, ADR-662 Φ2β Stage A).
    // 29 → 30: +imported-mesh (tek only — ADR-683 Φ3· το TEK θέλει παραμετρικό στοιχείο,
    // το ψημένο πλέγμα δεν είναι· το 3Δ OBJ/glTF export ΔΟΥΛΕΥΕΙ κανονικά).
    expect(entitiesWithExportGap().length).toMatchInlineSnapshot(`30`);
  });
});
