/**
 * 🔴 **ΚΛΕΙΔΩΜΕΝΑ LAYERS ΞΕΚΛΕΙΔΩΝΑΝ ΣΤΗΝ ΕΙΣΑΓΩΓΗ** — το τρίτο bit του group 70.
 *
 * Συνέχεια του `dxf-layer-frozen-import.test.ts`, **ίδιο σχήμα σφάλματος** (handoff #4 §0):
 *
 * > Η ιδιότητα υπήρχε. Η μηχανή που τη διαβάζει υπήρχε και ήταν σωστή. Κανείς δεν την έγραφε.
 *
 * Το `SceneLayer.locked` το ρωτούν **ήδη** τα εργαλεία τροποποίησης (trim / extend / stretch /
 * scale / offset / fillet), ο `assertCanEditLayer` και ο layer picker· ο `dxf-layer-table-writer`
 * ξέρει να το ξαναγράψει ως bit 4. Αλλά ο `registerLayer` έγραφε **καρφωτά** `locked: false`,
 * επειδή ο legacy reader (`parseLayerColors`) ρωτούσε από το group 70 **μόνο** το bit 0 (πάγωμα).
 * Αποτέλεσμα: κάθε layer κλειδωμένο στο AutoCAD γινόταν ελεύθερα επεξεργάσιμο μετά την εισαγωγή,
 * και το κλείδωμα χανόταν **και** στην εξαγωγή — ο writer ήταν σωστός, απλώς δεν είχε τι να γράψει.
 *
 * ⚠️ **ΤΟ ΚΛΕΙΔΩΜΑ ΔΕΝ ΕΙΝΑΙ ΑΠΟΚΡΥΨΗ.** Το AutoCAD κρύβει με OFF (62<0) και FREEZE (70 bit 0)·
 * το LOCK (70 bit 2) αφήνει το layer **ορατό και εκτυπώσιμο** και απαγορεύει μόνο την επεξεργασία.
 * Γι' αυτό δεν μπαίνει ΠΟΤΕ στο `isLayerRenderable` — τρεις ερωτήσεις, τρεις απαντήσεις.
 */

import { describe, it, expect } from '@jest/globals';
import { parseLayerColors } from '../dxf-table-parsers';
import { parseLayerTable } from '../dxf-layer-table-parser';
import { writeLayerTable } from '../dxf-layer-table-writer';
import { DxfSceneBuilder } from '../dxf-scene-builder';
import { isLayerRenderable } from '../../config/layer-visibility';
import { assertCanEditLayer } from '../../core/commands/text/CanEditLayerGuard';
import { CanEditLayerError } from '../../core/commands/text/types';
import type { SceneLayer } from '../../types/entities';
import type { SceneModel } from '../../types/scene-types';

/** TABLES section με μία ή περισσότερες εγγραφές LAYER. */
function layerTable(...entries: string[][]): string[] {
  return [
    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', String(entries.length),
    ...entries.flatMap(e => ['0', 'LAYER', ...e]),
    '0', 'ENDTAB', '0', 'ENDSEC',
  ];
}

const parse = (entry: string[]) => parseLayerColors(layerTable(entry))['L'];

/** Πλήρες DXF: ο πίνακας + μία LINE στο δοσμένο layer, ώστε να χτιστεί σκηνή. */
function sceneWithLayer(entry: string[], layerName: string): SceneModel {
  const content = [
    ...layerTable(entry),
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'LINE', '8', layerName, '10', '0', '20', '0', '11', '10', '21', '10',
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
  return DxfSceneBuilder.buildScene(content, 'mm');
}

const layerNamed = (scene: SceneModel, name: string): SceneLayer | undefined =>
  Object.values(scene.layersById).find(l => l.name === name);

describe('εισαγωγή LAYER — κλείδωμα (group 70 bit 2) χωριστά από πάγωμα και διακόπτη', () => {
  it('🔴 ΤΟ ΚΕΝΟ — `70 = 4` ⇒ το layer εισάγεται ΚΛΕΙΔΩΜΕΝΟ', () => {
    expect(parse(['2', 'L', '62', '7', '70', '4']).locked).toBe(true);
  });

  it('ΚΛΕΙΔΩΜΕΝΟ ≠ ΚΡΥΜΜΕΝΟ — μένει ορατό και εκτυπώσιμο', () => {
    // Ο κλασικός εννοιολογικός συμψηφισμός: «δεν το πειράζω» ≠ «δεν το βλέπω». Αν το κλείδωμα
    // γλιστρήσει ποτέ στο `isLayerRenderable`, αυτό το test το πιάνει.
    const l = parse(['2', 'L', '62', '7', '70', '4']);
    expect(l.locked).toBe(true);
    expect(l.visible).toBe(true);
    expect(l.frozen).toBe(false);
    expect(isLayerRenderable(l)).toBe(true);
  });

  it('ΠΕΙΘΑΡΧΙΑ BIT — το πάγωμα (bit 0) ΔΕΝ είναι κλείδωμα', () => {
    const l = parse(['2', 'L', '62', '7', '70', '1']);
    expect(l.frozen).toBe(true);
    expect(l.locked).toBe(false);
  });

  it('ΠΕΙΘΑΡΧΙΑ BIT — «frozen σε ΝΕΑ viewports» (bit 1) δεν είναι ούτε το ένα ούτε το άλλο', () => {
    const l = parse(['2', 'L', '62', '7', '70', '2']);
    expect(l.frozen).toBe(false);
    expect(l.locked).toBe(false);
  });

  it('ΟΛΟΣ Ο ΠΙΝΑΚΑΣ ΑΛΗΘΕΙΑΣ του group 70 — κάθε bit απαντά μόνο στη δική του ερώτηση', () => {
    const truth: ReadonlyArray<readonly [string, boolean, boolean]> = [
      // flag, frozen, locked
      ['0', false, false],
      ['1', true,  false],
      ['2', false, false],
      ['3', true,  false],
      ['4', false, true ],
      ['5', true,  true ],
      ['6', false, true ],
      ['7', true,  true ],
    ];
    for (const [flag, frozen, locked] of truth) {
      const l = parse(['2', 'L', '62', '7', '70', flag]);
      expect({ flag, frozen: l.frozen, locked: l.locked }).toEqual({ flag, frozen, locked });
    }
  });

  it('απουσία group 70 ⇒ ξεκλείδωτο (μηδέν regression στο κοινό μονοπάτι)', () => {
    expect(parse(['2', 'L', '62', '7']).locked).toBe(false);
  });

  it('Η ΚΑΛΩΔΙΩΣΗ — το `locked` φτάνει στο `SceneLayer` της σκηνής, όχι μόνο στον parser', () => {
    // Χωρίς αυτό ο parser θα ήταν σωστός και **αδρανής**: το `registerLayer` έγραφε καρφωτά
    // `locked: false`, οπότε η σωστή ανάγνωση πετιόταν μία γραμμή μετά.
    const layer = layerNamed(sceneWithLayer(['2', 'PL', '62', '5', '70', '4'], 'PL'), 'PL');
    expect(layer).toBeDefined();
    expect(layer!.locked).toBe(true);
    expect(isLayerRenderable(layer!)).toBe(true);
  });

  it('ΤΙ ΣΗΜΑΙΝΕΙ — ο πραγματικός φύλακας επεξεργασίας απορρίπτει το κλειδωμένο layer', () => {
    // Όχι «η τιμή είναι true», αλλά «η μηχανή που τη ρωτά αλλάζει απόφαση». Χωρίς την εισαγωγή
    // του bit, ο `assertCanEditLayer` περνούσε αθόρυβα σε κάθε κλειδωμένο layer του αρχείου.
    const layer = layerNamed(sceneWithLayer(['2', 'PL', '62', '5', '70', '4'], 'PL'), 'PL')!;
    const provider = { getLayer: () => layer, canUnlockLayer: false };
    expect(() => assertCanEditLayer({ layerName: 'PL', provider })).toThrow(CanEditLayerError);

    // …και ο χρήστης με το δικαίωμα ξεκλειδώματος περνά (το bit δεν είναι φράγμα, είναι δήλωση).
    expect(() => assertCanEditLayer({
      layerName: 'PL', provider: { getLayer: () => layer, canUnlockLayer: true },
    })).not.toThrow();
  });

  it('ΚΥΚΛΟΣ ΕΙΣΑΓΩΓΗΣ→ΕΞΑΓΩΓΗΣ — το κλείδωμα επιστρέφει ως bit 4 στο group 70', () => {
    // Ο writer ήξερε ήδη να γράψει το bit· απλώς του έφτανε πάντα `false`. Το αρχείο έβγαινε
    // ξεκλείδωτο, δηλαδή **σιωπηλή απώλεια δεδομένων** στο round-trip.
    const layer = layerNamed(sceneWithLayer(['2', 'PL', '62', '5', '70', '5'], 'PL'), 'PL')!;
    const tokens = writeLayerTable({ layers: [layer], customLinetypes: [] });
    const recovered = parseLayerTable(tokens).layers.find(l => l.name === 'PL');
    expect(recovered).toBeDefined();
    expect(recovered!.locked).toBe(true);
    expect(recovered!.frozen).toBe(true);
  });

  it('ΟΙ ΔΥΟ PARSERS ΣΥΜΦΩΝΟΥΝ και για το κλείδωμα (anti-drift)', () => {
    // Ο πλήρης parser ρωτούσε ήδη το `isLockedFlag`· ο legacy όχι. Για το ΙΔΙΟ αρχείο έδιναν
    // διαφορετική απάντηση — ακριβώς η απόκλιση που το `dxf-layer-flags` υπάρχει να αποτρέπει.
    for (const flag of ['0', '1', '2', '4', '5', '6', '7']) {
      const entry = ['2', 'L', '62', '5', '70', flag];
      const legacy = parseLayerColors(layerTable(entry))['L'];
      const full = parseLayerTable(layerTable(entry)).layers[0];
      expect({ flag, locked: legacy.locked, frozen: legacy.frozen })
        .toEqual({ flag, locked: full.locked, frozen: full.frozen });
    }
  });
});

/**
 * Το layer «0» ήταν το **μοναδικό** layer εξαιρεμένο από τον πίνακα: ο `buildScene` το έφτιαχνε
 * πριν από κάθε `registerLayer`, με `visible: true` / `locked: false` καρφωτά — και επειδή ο
 * `registerLayer` κάνει `if (!layers[name])`, δεύτερη ευκαιρία δεν υπήρχε ποτέ. Ένα αρχείο που
 * δηλώνει το «0» σβηστό, παγωμένο ή κλειδωμένο εισαγόταν ως απολύτως κανονικό.
 */
describe('εισαγωγή LAYER — το «0» δεν είναι πια εξαιρεμένο από τον πίνακα', () => {
  const zeroLayer = (flags: string[]) =>
    layerNamed(sceneWithLayer(['2', '0', '62', '7', ...flags], '0'), '0');

  it('🔴 το «0» κλειδωμένο στο αρχείο εισάγεται κλειδωμένο', () => {
    expect(zeroLayer(['70', '4'])!.locked).toBe(true);
  });

  it('🔴 το «0» παγωμένο στο αρχείο εισάγεται παγωμένο', () => {
    const l = zeroLayer(['70', '1'])!;
    expect(l.frozen).toBe(true);
    expect(isLayerRenderable(l)).toBe(false);
  });

  it('🔴 το «0» σβηστό (62 αρνητικό) εισάγεται σβηστό', () => {
    const l = layerNamed(sceneWithLayer(['2', '0', '62', '-7'], '0'), '0')!;
    expect(l.visible).toBe(false);
  });

  it('αρχείο ΧΩΡΙΣ πίνακα LAYER ⇒ το «0» κρατά τα ιστορικά defaults', () => {
    // Το «0» πρέπει να υπάρχει πάντα (κάθε νέο BIM entity καρφώνεται στο id του), και χωρίς
    // εγγραφή στον πίνακα δεν υπάρχει τίποτα να τιμήσουμε — ορατό, άπαγο, ξεκλείδωτο.
    const content = [
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LINE', '8', '0', '10', '0', '20', '0', '11', '10', '21', '10',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');
    const l = layerNamed(DxfSceneBuilder.buildScene(content, 'mm'), '0')!;
    expect({ visible: l.visible, frozen: l.frozen, locked: l.locked })
      .toEqual({ visible: true, frozen: false, locked: false });
  });
});
