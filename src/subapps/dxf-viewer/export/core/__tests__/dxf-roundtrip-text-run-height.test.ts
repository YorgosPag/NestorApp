/**
 * ADR-737 §18 — ΤΟ ΥΨΟΣ ΠΟΥ ΕΞΑΓΕΤΑΙ ΕΙΝΑΙ ΑΥΤΟ ΠΟΥ ΒΛΕΠΕΙ Ο ΧΡΗΣΤΗΣ.
 *
 * 🐛 Η βλάβη που καρφώνει αυτή η σουίτα: μέσα στο **ίδιο αρχείο** `dxf-ascii-entity-dispatch.ts`
 * ζούσαν δύο writers κειμένου με **διαφορετική πηγή ύψους** — ο `emitMText` διάβαζε το run του
 * `textNode` (`firstRunHeight(node) ?? …`), ενώ ο αδελφός δρόμος TEXT κοιτούσε **μόνο** τα flat
 * πεδία (`e.height ?? e.fontSize`). Αποτέλεσμα: μια οντότητα της οποίας το ζωντανό ύψος έχει
 * προχωρήσει στο AST (κλίμακα εισαγωγής, grip-resize — το σχήμα «shadowed» του ADR-635)
 * εξαγόταν **σωστά ως MTEXT και λάθος ως TEXT**, στην ίδια εξαγωγή.
 *
 * ⚠️ Η επαλήθευση γίνεται με **ΔΥΟ περάσματα και σύγκριση AST**, όχι σύγκριση strings (ADR-737
 * §15/§17): το ίδιο σχέδιο έχει πολλές έγκυρες σειριοποιήσεις, οπότε ένα string diff θα ήταν
 * ταυτόχρονα θορυβώδες και τυφλό.
 */

import { describe, it, expect } from '@jest/globals';
import { writeDxfAscii } from '../dxf-ascii-writer';
import { convertText } from '../../../utils/dxf-text-converters';
import type { Entity } from '../../../types/entities';
import type { AnySceneEntity } from '../../../types/scene';
import type { DxfTextNode } from '../../../text-engine/types';

const LAYERS = { L: { name: 'TXT' } };

/** Flat `data` Record του πρώτου μπλοκ `<TYPE>` (ίδιο ιδίωμα με `dxf-roundtrip-mtext.test.ts`). */
function extractEntity(dxf: string, type: string): Record<string, string> | null {
  const t = dxf.split('\n');
  let start = -1;
  for (let i = 0; i < t.length - 1; i += 2) {
    if (t[i] === '0' && t[i + 1] === type) { start = i + 2; break; }
  }
  if (start < 0) return null;
  const data: Record<string, string> = {};
  for (let i = start; i < t.length - 1; i += 2) {
    if (t[i] === '0') break;
    data[t[i]] = t[i + 1];
  }
  return data;
}

const asEntity = (e: AnySceneEntity): Entity => e as unknown as Entity;
const nodeOf = (e: AnySceneEntity): DxfTextNode =>
  (e as unknown as { textNode: DxfTextNode }).textNode;
const runHeightOf = (e: AnySceneEntity): number | undefined =>
  (nodeOf(e).paragraphs[0].runs[0] as { style?: { height?: number } }).style?.height;

/**
 * Εισάγει TEXT ύψους 2,5 και μετά **προχωρά ΜΟΝΟ το AST** σε 7 — αφήνοντας τα flat πεδία πίσω.
 *
 * Δεν είναι τεχνητό: αυτή ακριβώς είναι η κατάσταση «shadowed» που περιγράφει το
 * `scale-entity-transform` (γι' αυτό και *πρέπει* να γράφει και τα δύο). Ο εξαγωγέας οφείλει να
 * απαντά με το ΖΩΝΤΑΝΟ ύψος, όχι με το μπαγιάτικο flat.
 */
function importedTextWithAdvancedRunHeight(): AnySceneEntity {
  const imported = convertText({ '10': '0', '20': '0', '40': '2.5', '1': 'AB' }, 'L', 0)!;
  const node = nodeOf(imported);
  const run = node.paragraphs[0].runs[0] as { style: { height: number } };
  run.style.height = 7;
  return imported;
}

describe('ADR-737 §18 — group 40 της εξαγωγής TEXT ακολουθεί το run, όχι τα flat πεδία', () => {
  it('TEXT με run 7 και flat 2,5 ⇒ group 40 = 7', () => {
    const e = importedTextWithAdvancedRunHeight();
    expect((e as unknown as { height?: number }).height).toBe(2.5); // flat: μπαγιάτικο, επίτηδες

    const data = extractEntity(writeDxfAscii([asEntity(e)], { layersById: LAYERS }), 'TEXT')!;
    expect(parseFloat(data['40'])).toBe(7);
    expect(parseFloat(data['40'])).not.toBe(2.5); // ήταν αυτό πριν το §18
  });

  it('ΔΥΟ ΠΕΡΑΣΜΑΤΑ: export → import → export → import είναι σταθερό σημείο στο AST', () => {
    const first = importedTextWithAdvancedRunHeight();

    const dxf1 = writeDxfAscii([asEntity(first)], { layersById: LAYERS });
    const back1 = convertText(extractEntity(dxf1, 'TEXT')!, 'L', 1)!;

    const dxf2 = writeDxfAscii([asEntity(back1)], { layersById: LAYERS });
    const back2 = convertText(extractEntity(dxf2, 'TEXT')!, 'L', 2)!;

    // Το ύψος επέζησε και των δύο κύκλων — καμία σιωπηλή ολίσθηση προς το flat 2,5.
    expect(runHeightOf(back1)).toBe(7);
    expect(runHeightOf(back2)).toBe(7);
    // Και μετά την πρώτη επανεισαγωγή τα flat πεδία ΣΥΜΦΩΝΟΥΝ ξανά με το AST (ο importer
    // γράφει την ίδια τιμή και στα τρία σημεία από το group 40) ⇒ η σκιά έκλεισε.
    expect((back1 as unknown as { height?: number }).height).toBe(7);
    expect((back1 as unknown as { fontSize?: number }).fontSize).toBe(7);
    // Σύγκριση AST, ΟΧΙ strings: δομική ταυτότητα των δύο περασμάτων.
    expect(nodeOf(back2)).toEqual(nodeOf(back1));
  });

  it('οι δύο δρόμοι του ΙΔΙΟΥ αρχείου συμφωνούν: TEXT και MTEXT γράφουν το ίδιο group 40', () => {
    // Η ασυμμετρία που έκλεισε: ο `emitMText` διάβαζε ΗΔΗ το run· ο δρόμος TEXT όχι.
    const asText = importedTextWithAdvancedRunHeight();
    const asMText = importedTextWithAdvancedRunHeight();
    (asMText as unknown as { dxfSourceType: string }).dxfSourceType = 'mtext';

    const textData = extractEntity(writeDxfAscii([asEntity(asText)], { layersById: LAYERS }), 'TEXT')!;
    const mtextData = extractEntity(writeDxfAscii([asEntity(asMText)], { layersById: LAYERS }), 'MTEXT')!;

    expect(parseFloat(textData['40'])).toBe(parseFloat(mtextData['40']));
    expect(parseFloat(textData['40'])).toBe(7);
  });

  it('ο Τέκτων (`explode`) γράφει κι αυτός το ζωντανό ύψος — ίδιος SSoT, όχι τρίτη διατύπωση', () => {
    // Ο minimal parser του Τέκτονα διαβάζει μόνο TEXT, οπότε το MTEXT υποβαθμίζεται εδώ.
    // Πριν το §18 αυτός ο δρόμος διάβαζε `e.height ?? e.fontSize` — δηλαδή το ομώνυμο πεδίο
    // που στο MTEXT σήμαινε **ύψος πλαισίου**.
    const e = importedTextWithAdvancedRunHeight();
    (e as unknown as { dxfSourceType: string }).dxfSourceType = 'mtext';

    const dxf = writeDxfAscii([asEntity(e)], { layersById: LAYERS, lineMode: 'lines' });
    expect(dxf).toContain('0\nTEXT\n');
    expect(parseFloat(extractEntity(dxf, 'TEXT')!['40'])).toBe(7);
  });

  it('ΑΡΝΗΤΙΚΟ: TEXT χωρίς AST εξάγει το flat ύψος — καμία παλινδρόμηση στη συνήθη διαδρομή', () => {
    const imported = convertText({ '10': '0', '20': '0', '40': '3.5', '1': 'plain' }, 'L', 0)!;
    delete (imported as unknown as { textNode?: DxfTextNode }).textNode;

    const data = extractEntity(writeDxfAscii([asEntity(imported)], { layersById: LAYERS }), 'TEXT')!;
    expect(parseFloat(data['40'])).toBe(3.5);
  });
});
