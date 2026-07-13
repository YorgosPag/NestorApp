/**
 * ADR-648 Στάδιο Ε — γραμμοσκίαση → **αποδομημένες** `<line>` records (πλήρης ταύτιση).
 *
 * ΓΙΑΤΙ (ground-truth, δείγματα Giorgio 2026-07-13 «ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ/»):
 * Το native `<hatch>` του Τέκτονα δείχνει μοτίβο από τη ΔΙΚΗ ΤΟΥ βιβλιοθήκη (`pattern.inf`),
 * που ΔΕΝ έχει αντιστοιχία με την `acad.pat`. Μετρημένο: ένα AutoCAD `SQUARE` (2 οικογένειες
 * 0°/90°, delta 0.127, dashed) = **15.318 γραμμές**· το ίδιο σχέδιο μέσω native `<hatch>`
 * (`<type>72`, scale 0.15, rotation 0) το ζωγράφισε ο Τέκτων με **43 διαγώνιες**. Καμία
 * βαθμονόμηση scale/rotation δεν γεφυρώνει αυτό — είναι άλλο σχέδιο, όχι άλλη πυκνότητα.
 *
 * ΛΥΣΗ: χτίζουμε ΕΜΕΙΣ τις γραμμές γεμίσματος και τις στέλνουμε ως `<line>` — ό,τι ακριβώς
 * κάνει ήδη ο DXF writer σε lines-mode (`dxf-ascii-hatch-writer.emitHatch`, explode=true).
 * FULL SSoT: ΙΔΙΑ κλήση στο ΙΔΙΟ `buildHatchEntitySegments` → canvas, DXF-lines και `.tek`
 * δείχνουν **τις ίδιες γραμμές**. Μηδέν pattern math εδώ.
 *
 * Το ακριβές μοτίβο του AutoCAD επιβιώνει επειδή ο import διατηρεί τον ΠΡΩΤΟΤΥΠΟ ορισμό
 * (`inlinePattern`, ADR-644 #7d) — δεν χρειάζεται κανένα name-mapping σε βιβλιοθήκη.
 *
 * ΟΡΙΑ: solid/gradient hatch → καμία γραμμή (μένει native `<hatch>`, βλ. `collectTekHatches`).
 * Πυκνά μοτίβα → dense guard (ADR-647): πάνω από το όριο ΔΕΝ αποδομούνται (fallback native)
 * + warning — ΟΧΙ σιωπηλή έκρηξη σε εκατοντάδες χιλιάδες records.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-648-dxf-tek-export-entity-coverage.md
 * @see bim/geometry/shared/hatch-pattern-geometry.ts (buildHatchEntitySegments — SSoT)
 */

import type { Entity, HatchEntity } from '../../../types/entities';
import {
  buildHatchEntitySegments, hatchMinWorldSpacing,
} from '../../../bim/geometry/shared/hatch-pattern-geometry';
import { polygonBbox } from '../../../bim/geometry/shared/polygon-utils';
import { buildLineRecordXml } from './tek-xml-writer';
import { entityColor, entityTag, toTekLine } from './dxf-to-tek';

/**
 * Μέγιστες γραμμές γεμίσματος **ανά** γραμμοσκίαση (dense guard, ADR-647). Το μετρημένο
 * AutoCAD δείγμα (`SQUARE`, 20×18 μονάδες, βήμα 0.127) δίνει 15.318 πραγματικές γραμμές
 * (εκτίμηση 22.3k) → το όριο το αφήνει να περάσει με περιθώριο. Πάνω από αυτό, το μοτίβο
 * είναι έτσι κι αλλιώς δυσδιάκριτο στο χαρτί.
 */
export const MAX_TEK_FILL_LINES_PER_HATCH = 40_000;

/**
 * Συνολικό budget γραμμών γεμίσματος σε ΕΝΑ `.tek`. Προστατεύει από «10 πυκνές γραμμοσκιάσεις
 * × 30k η καθεμία» → μη-ανοιγόμενο αρχείο. Όσες γραμμοσκιάσεις δεν χωρέσουν μένουν native.
 */
export const MAX_TEK_FILL_LINES_TOTAL = 120_000;

/**
 * **Εκτίμηση** πλήθους γραμμών γεμίσματος ΧΩΡΙΣ να τις υπολογίσουμε — ο guard ΠΡΕΠΕΙ να τρέχει
 * ΠΡΙΝ το `buildHatchEntitySegments`, αλλιώς προστατεύει μόνο το μέγεθος του αρχείου ενώ το UI
 * έχει ήδη παγώσει. (Μετρημένο: ένα 400×400 boundary με βήμα 0.127 χρειάζεται **164s** να
 * υπολογιστεί — ο post-hoc έλεγχος είναι άχρηστος.)
 *
 * Μοντέλο: εμβαδόν bbox ÷ βήμα² — μία γραμμή ανά `spacing` σε κάθε άξονα. Reuse των SSoT
 * `hatchMinWorldSpacing` (πυκνότερη οικογένεια) + `polygonBbox` — μηδέν νέα pattern math.
 * Υπερεκτιμά ~45% έναντι του πραγματικού (dashes/clipping) → ασφαλής κατεύθυνση για guard.
 */
export function estimateHatchFillLines(h: HatchEntity): number {
  const spacing = hatchMinWorldSpacing(h);
  if (spacing <= 0) return 0;
  const verts = (h.boundaryPaths ?? []).flat().map((v) => ({ x: v.x, y: v.y, z: 0 }));
  if (verts.length < 3) return 0;
  const bbox = polygonBbox(verts);
  const w = Math.abs(bbox.max.x - bbox.min.x);
  const hgt = Math.abs(bbox.max.y - bbox.min.y);
  return Math.ceil((w * hgt) / (spacing * spacing));
}

export interface TekHatchExplodeResult {
  /** Line records (περίγραμμα + γραμμές μοτίβου) — μπαίνουν στον line container του TEK. */
  readonly linesXml: string;
  readonly lineCount: number;
  /** ADR-608 — distinct tags (για το `<tag_visibility>` registry). */
  readonly tags: readonly string[];
  /** Ids των hatch entities που ΑΠΟΔΟΜΗΘΗΚΑΝ → ο `collectTekHatches` τα παραλείπει. */
  readonly explodedIds: ReadonlySet<string>;
  /** Παραλείψεις (dense guard) — γραμμοσκιάσεις που έμειναν native. */
  readonly warnings: readonly string[];
}

/**
 * Αποδομεί κάθε μη-solid γραμμοσκίαση σε `<line>` records: το περίγραμμα κάθε
 * `boundaryPath` + τις γραμμές μοτίβου του SSoT. Το `startId` συνεχίζει την αρίθμηση `<n>`
 * μετά τα κανονικά line records (κοινός `<line>` container → μοναδικά ids).
 * `f` = μέτρα ανά scene unit (Y-flip μέσω `toTekLine` → `sceneXYToTekMeters`).
 *
 * Solid/gradient → δεν αποδομείται (κενά segments) και ΔΕΝ μπαίνει στο `explodedIds`, ώστε
 * να βγει native `<hatch>` (type 22) — εκεί δεν υπάρχουν γραμμές να εξαχθούν.
 */
export function collectTekHatchFillLines(
  entities: readonly Entity[], f: number, startId = 1,
): TekHatchExplodeResult {
  const records: string[] = [];
  const tags = new Set<string>();
  const explodedIds = new Set<string>();
  const warnings: string[] = [];
  let id = startId;
  let budget = MAX_TEK_FILL_LINES_TOTAL;

  for (const e of entities) {
    if (e.type !== 'hatch') continue;
    const h = e as HatchEntity;
    const paths = (h.boundaryPaths ?? []).filter((p) => p.length >= 3);
    if (!paths.length) continue;

    // ⚠️ Dense guard ΠΡΙΝ τον υπολογισμό — το `buildHatchEntitySegments` σε πυκνό/μεγάλο
    // boundary είναι O(γραμμές × dashes × ακμές) και ΠΑΓΩΝΕΙ (μετρημένο: 164s σε 400×400
    // με βήμα 0.127). Εκτίμηση από bbox/βήμα → κόβουμε χωρίς να πληρώσουμε το κόστος.
    const estimate = estimateHatchFillLines(h);
    if (estimate > MAX_TEK_FILL_LINES_PER_HATCH || estimate > budget) {
      warnings.push(
        `Γραμμοσκίαση ${h.id}: ~${estimate} γραμμές μοτίβου — πάνω από το όριο αποδόμησης `
        + `(${MAX_TEK_FILL_LINES_PER_HATCH} ανά γραμμοσκίαση / ${MAX_TEK_FILL_LINES_TOTAL} συνολικά). `
        + 'Εξήχθη ως native μοτίβο του Τέκτονα (κατά προσέγγιση).',
      );
      continue; // δεν μπαίνει στο explodedIds → ο collectTekHatches το βγάζει native
    }

    // SSoT: οι ΙΔΙΕΣ γραμμές που ζωγραφίζει ο canvas και εκπέμπει το DXF lines-mode.
    const fill = buildHatchEntitySegments(h);
    if (!fill.length) continue; // solid/gradient/άγνωστο μοτίβο → μένει native `<hatch>`

    const outlineCount = paths.reduce((n, p) => n + p.length, 0);
    const color = entityColor(e);
    const tag = entityTag(e);
    // Περίγραμμα (κλειστό) κάθε path — mirror του DXF explode (emitHatch, explode=true).
    for (const path of paths) {
      for (let i = 0; i < path.length; i += 1) {
        const a = path[i];
        const b = path[(i + 1) % path.length];
        if (a.x === b.x && a.y === b.y) continue; // μηδενικού μήκους → skip
        records.push(buildLineRecordXml(toTekLine(a, b, color, id, f, tag)));
        id += 1;
      }
    }
    // Γραμμές μοτίβου.
    for (const seg of fill) {
      records.push(buildLineRecordXml(toTekLine(seg.start, seg.end, color, id, f, tag)));
      id += 1;
    }
    budget -= fill.length + outlineCount;
    explodedIds.add(h.id);
    if (tag) tags.add(tag);
  }

  return {
    linesXml: records.join('\n'),
    lineCount: records.length,
    tags: [...tags],
    explodedIds,
    warnings,
  };
}
