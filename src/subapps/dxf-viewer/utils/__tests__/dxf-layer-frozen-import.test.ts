/**
 * 🔴 **ΠΑΓΩΜΕΝΑ LAYERS ΕΜΦΑΝΙΖΟΝΤΑΝ** — ο δεύτερος μηχανισμός απόκρυψης του AutoCAD.
 *
 * **Το περιστατικό (Giorgio, 2026-07-29):** *«γιατί αυτή η μπλε γραμμή δεν φαίνεται στο
 * AutoCAD;»*. Απάντηση: το layer της (`pl`) είναι **παγωμένο** (group 70 bit 0). Το AutoCAD
 * κρύβει ένα layer με **δύο ανεξάρτητους** μηχανισμούς:
 *
 *   • **OFF**    → `62` **αρνητικό**  (το τιμούσαμε ήδη)
 *   • **FROZEN** → `70` bit 0         (**δεν το διαβάζαμε καθόλου**)
 *
 * Ο `parseLayerColors` — ο reader που τροφοδοτεί τον `DxfSceneBuilder` — διάβαζε **μόνο** τα
 * group `2` και `62`. Το `pl` έχει **θετικό** χρώμα (5 = μπλε) και είναι *μόνο* frozen, οπότε
 * γλίστρησε από τον έλεγχο προσήμου και ζωγραφιζόταν.
 *
 * ⚠️ Ολόκληρη η μηχανή του παγώματος υπήρχε ήδη και ήταν σωστή (`isLayerRenderable`,
 * `LayerFreezeCommand`, `LAYTHW`, smart filters) — **απλώς η εισαγωγή δεν γέμιζε ποτέ το
 * πεδίο**. Κλασικό «η ιδιότητα υπάρχει, κανείς δεν τη γράφει».
 *
 * Μετρημένο στο πραγματικό `47_ergasia.dxf`: **8 παγωμένα layers / ~700 οντότητες** που το
 * AutoCAD δεν δείχνει (`Point_Tax_2019` 284, `Num_Tax_2019` 244, `pl` 60, `kryfo` 38, …).
 */

import { describe, it, expect } from '@jest/globals';
import { parseLayerColors } from '../dxf-table-parsers';
import { parseLayerTable } from '../dxf-layer-table-parser';
import { DxfSceneBuilder } from '../dxf-scene-builder';
import { isLayerRenderable, isLayerOn, isLayerFrozen } from '../../config/layer-visibility';

/** TABLES section με μία εγγραφή LAYER. */
function layerTable(entry: string[]): string[] {
  return [
    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', '1',
    '0', 'LAYER', ...entry,
    '0', 'ENDTAB', '0', 'ENDSEC',
  ];
}

const parse = (entry: string[]) => parseLayerColors(layerTable(entry))['L'];

describe('εισαγωγή LAYER — πάγωμα (group 70) χωριστά από τον διακόπτη (group 62)', () => {
  it('🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ «pl» — frozen με ΘΕΤΙΚΟ χρώμα ⇒ ΔΕΝ ζωγραφίζεται', () => {
    const l = parse(['2', 'L', '62', '5', '70', '1']);
    expect(l.frozen).toBe(true);
    expect(l.visible).toBe(true);           // ο διακόπτης είναι όντως αναμμένος…
    expect(isLayerRenderable(l)).toBe(false); // …αλλά το πάγωμα το κρύβει
  });

  it('OFF (62 αρνητικό) — αμετάβλητη συμπεριφορά, και ΔΕΝ θεωρείται πάγωμα', () => {
    const l = parse(['2', 'L', '62', '-3']);
    expect(isLayerOn(l)).toBe(false);
    expect(isLayerFrozen(l)).toBe(false);
    expect(l.colorIndex).toBe(3);           // το μέτρο μένει χρώμα, το πρόσημο ήταν σήμα
    expect(isLayerRenderable(l)).toBe(false);
  });

  it('OFF ΚΑΙ frozen μαζί — και τα δύο καταγράφονται, κανένα δεν καταπίνει το άλλο', () => {
    const l = parse(['2', 'L', '62', '-50', '70', '1']);
    expect(l.visible).toBe(false);
    expect(l.frozen).toBe(true);
  });

  it('κανονικό layer ⇒ ζωγραφίζεται (καμία παρενέργεια στο κοινό μονοπάτι)', () => {
    const l = parse(['2', 'L', '62', '7']);
    expect(l.frozen).toBe(false);
    expect(isLayerRenderable(l)).toBe(true);
  });

  it('ΠΕΙΘΑΡΧΙΑ BIT — `locked` (bit 2) ΔΕΝ είναι πάγωμα', () => {
    // Φυλάει από το κλασικό ολίσθημα `flag !== 0`: ένα κλειδωμένο layer είναι **ορατό**.
    const l = parse(['2', 'L', '62', '7', '70', '4']);
    expect(l.frozen).toBe(false);
    expect(isLayerRenderable(l)).toBe(true);
  });

  it('ΠΕΙΘΑΡΧΙΑ BIT — «frozen σε ΝΕΑ viewports» (bit 1) ΔΕΝ κρύβει το model space', () => {
    const l = parse(['2', 'L', '62', '7', '70', '2']);
    expect(l.frozen).toBe(false);
    expect(isLayerRenderable(l)).toBe(true);
  });

  it('frozen + locked μαζί (70 = 5) ⇒ παγωμένο', () => {
    expect(parse(['2', 'L', '62', '7', '70', '5']).frozen).toBe(true);
  });

  it('Η ΚΑΛΩΔΙΩΣΗ — το `frozen` φτάνει στο `SceneLayer` της σκηνής, όχι μόνο στον parser', () => {
    // Χωρίς αυτό ο parser θα ήταν σωστός και **αδρανής**: το `registerLayer` έστελνε στο
    // `createSceneLayer` μόνο `visible` (και `locked: false` καρφωτό) — το `frozen` έμενε στον
    // πίνακα και δεν έφτανε ποτέ στη σκηνή που ρωτά ο renderer. Ίδιο σχήμα με το ADR-507 Φ7.
    const content = [
      ...layerTable(['2', 'PL', '62', '5', '70', '1']),
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LINE', '8', 'PL', '10', '0', '20', '0', '11', '10', '21', '10',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');

    const scene = DxfSceneBuilder.buildScene(content, 'mm');
    const layer = Object.values(scene.layersById).find(l => l.name === 'PL');
    expect(layer).toBeDefined();
    expect(layer!.frozen).toBe(true);
    expect(isLayerRenderable(layer!)).toBe(false);
  });

  it('ΟΙ ΔΥΟ PARSERS ΣΥΜΦΩΝΟΥΝ — ίδιο αρχείο, ίδια ετυμηγορία (anti-drift)', () => {
    // Δύο readers διαβάζουν τον ίδιο πίνακα: ο legacy (σκηνή) και ο πλήρης (`SceneLayer[]`).
    // Όσο η πράξη `flag & 1` ζούσε inline στον έναν και **καθόλου** στον άλλο, το ίδιο αρχείο
    // έδινε δύο διαφορετικές απαντήσεις. Τώρα και οι δύο ρωτούν το `dxf-layer-flags`.
    for (const flag of ['0', '1', '2', '4', '5', '7']) {
      const entry = ['2', 'L', '62', '5', '70', flag];
      const legacy = parseLayerColors(layerTable(entry))['L'];
      const full = parseLayerTable(layerTable(entry)).layers[0];
      expect({ frozen: legacy.frozen, visible: legacy.visible })
        .toEqual({ frozen: full.frozen, visible: full.visible });
    }
  });
});
