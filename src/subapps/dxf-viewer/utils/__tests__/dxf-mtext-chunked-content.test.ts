/**
 * ADR-635 — MTEXT >250 χαρακτήρες: επανασυναρμολόγηση των chunks (κωδικοί 3…3 + 1).
 *
 * ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΠΕΡΙΣΤΑΤΙΚΟ (47_ergasia.dxf, AutoCAD 2021, 2026-07-29):
 * το μπλοκ «ΣΤΟΙΧΕΙΑ ΕΡΕΥΝΑΣ ΙΔΙΩΤΗ ΜΗΧΑΝΙΚΟΥ» (5.317 χαρακτήρες, 21×code-3 + code-1)
 * έφτανε στη σκηνή ως `"1.3329x;\\L }"` — 12 χαρακτήρες ουράς. Δεν ζωγραφιζόταν λάθος:
 * **έλειπε**. Και το διπλανό μπλοκ των 2.824 χαρακτήρων, που είχε ουρά μόνο κενά,
 * πετιόταν ΟΛΟΚΛΗΡΟ από το empty-text guard του `convertMText`.
 *
 * Αποδεικνύει:
 *  - ο collector ενώνει ΜΟΝΟ για MTEXT, ΜΟΝΟ τους κωδικούς 1/3, με τη σειρά ροής·
 *  - `parseEntity` γράφει το ενωμένο string στο `data['1']` (σημασιολογία DXF spec)·
 *  - τα κενά στη ΡΑΦΗ των chunks επιβιώνουν (η κοπή στους 250 πέφτει μέσα σε κενά)·
 *  - end-to-end: το κείμενο φτάνει ΑΚΕΡΑΙΟ στη σκηνή, όχι η ουρά του·
 *  - ουρά από σκέτα κενά ⇒ η οντότητα ΔΕΝ χάνεται πια·
 *  - ΜΗ-MTEXT (TEXT/ATTDEF) μένουν ανέγγιχτα — το code 3 του ATTDEF είναι prompt, όχι κείμενο.
 */
import { DxfEntityParser } from '../dxf-entity-parser';
import { DxfSceneBuilder } from '../dxf-scene-builder';
import {
  createMTextContentCollector,
  isMTextEntityType,
  joinMTextChunks,
} from '../dxf-mtext-chunks';
import type { AnySceneEntity } from '../../types/scene';

type TextShape = { type: string; text: string };
const asText = (e: AnySceneEntity): TextShape => e as unknown as TextShape;

function lines(...pairs: Array<[string | number, string | number]>): string[] {
  return pairs.flatMap(([c, v]) => [String(c), String(v)]);
}

/** Minimal DXF με μόνο ENTITIES, σε mm (scale factor 1). */
function buildEntities(entities: string[]): AnySceneEntity[] {
  const content = [
    ...lines(['0', 'SECTION'], ['2', 'ENTITIES']), ...entities, ...lines(['0', 'ENDSEC']),
    ...lines(['0', 'EOF']),
  ].join('\n');
  return DxfSceneBuilder.buildScene(content, 'mm').entities;
}

// ── Unit: ο SSoT βοηθός ───────────────────────────────────────────────────────

describe('dxf-mtext-chunks (SSoT)', () => {
  it('αναγνωρίζει MTEXT / MULTILINETEXT και τίποτα άλλο', () => {
    expect(isMTextEntityType('MTEXT')).toBe(true);
    expect(isMTextEntityType('MULTILINETEXT')).toBe(true);
    expect(isMTextEntityType('TEXT')).toBe(false);
    expect(isMTextEntityType('ATTDEF')).toBe(false);
  });

  it('ενώνει ΧΩΡΙΣ διαχωριστικό και ΧΩΡΙΣ trim (byte-level split)', () => {
    expect(joinMTextChunks(['Εύοσμου, ', 'όπως'])).toBe('Εύοσμου, όπως');
    expect(joinMTextChunks([])).toBe('');
  });

  it('συλλέγει μόνο τους κωδικούς 1/3 και γράφει το `data["1"]`', () => {
    const c = createMTextContentCollector('MTEXT');
    c.take('3', 'ΜΕΡΟΣ-Α');
    c.take('7', 'STYLE1');   // text style — ΔΕΝ είναι περιεχόμενο
    c.take('3', 'ΜΕΡΟΣ-Β');
    c.take('71', '1');
    c.take('1', 'ΟΥΡΑ');
    const data: Record<string, string> = { '1': 'ΟΥΡΑ', '7': 'STYLE1' };
    c.applyTo(data);
    expect(data['1']).toBe('ΜΕΡΟΣ-ΑΜΕΡΟΣ-ΒΟΥΡΑ');
    expect(data['7']).toBe('STYLE1');
  });

  it('είναι no-op για μη-MTEXT τύπο (το ATTDEF code 3 = prompt, όχι κείμενο)', () => {
    const c = createMTextContentCollector('ATTDEF');
    c.take('3', 'Enter door id:');
    c.take('1', 'DEFAULT');
    const data: Record<string, string> = { '1': 'DEFAULT', '3': 'Enter door id:' };
    c.applyTo(data);
    expect(data['1']).toBe('DEFAULT');
  });

  it('δεν πειράζει το `data["1"]` όταν το MTEXT δεν είχε καθόλου κωδικούς 1/3', () => {
    const c = createMTextContentCollector('MTEXT');
    c.take('40', '2.5');
    const data: Record<string, string> = { '40': '2.5' };
    c.applyTo(data);
    expect(data['1']).toBeUndefined();
  });
});

// ── parseEntity: εκεί που ζει η επανασυναρμολόγηση ────────────────────────────

describe('DxfEntityParser.parseEntity — MTEXT chunks', () => {
  it('ενώνει 3…3 + 1 στο `data["1"]` (το flat data κρατούσε μόνο την ουρά)', () => {
    const raw = lines(
      ['0', 'MTEXT'], ['8', 'ΠΕΡΙΓΡΑΦΗ'], ['10', 0], ['20', 0], ['40', 0.8],
      ['3', 'ΚΟΜΜΑΤΙ-1|'], ['3', 'ΚΟΜΜΑΤΙ-2|'], ['3', 'ΚΟΜΜΑΤΙ-3|'], ['1', 'ΟΥΡΑ'],
      ['0', 'ENDSEC'],
    );
    const e = DxfEntityParser.parseEntity(raw, 0);
    expect(e).not.toBeNull();
    expect(e!.data['1']).toBe('ΚΟΜΜΑΤΙ-1|ΚΟΜΜΑΤΙ-2|ΚΟΜΜΑΤΙ-3|ΟΥΡΑ');
    // Το flat `data['3']` παραμένει ό,τι ήταν πάντα (τελευταίο) — δεν αλλάζουμε σημασιολογία.
    expect(e!.data['3']).toBe('ΚΟΜΜΑΤΙ-3|');
    expect(e!.layer).toBe('ΠΕΡΙΓΡΑΦΗ');
  });

  it('διατηρεί τα κενά στη ΡΑΦΗ των chunks (trim θα κολλούσε τις λέξεις)', () => {
    const raw = [
      '0', 'MTEXT', '8', '0', '10', '0', '20', '0', '40', '0.8',
      '3', 'των Δήμων Εύοσμου, ',   // ← το κενό στο τέλος ΕΙΝΑΙ περιεχόμενο
      '3', 'όπως ',
      '1', 'ισχύει',
      '0', 'ENDSEC',
    ];
    const e = DxfEntityParser.parseEntity(raw, 0);
    expect(e!.data['1']).toBe('των Δήμων Εύοσμου, όπως ισχύει');
  });

  it('MTEXT χωρίς chunks (<250 χαρακτήρες) μένει ακριβώς ως έχει', () => {
    const raw = lines(['0', 'MTEXT'], ['8', '0'], ['10', 0], ['20', 0], ['1', 'Σύντομο'], ['0', 'ENDSEC']);
    expect(DxfEntityParser.parseEntity(raw, 0)!.data['1']).toBe('Σύντομο');
  });

  it('ΔΕΝ αγγίζει το TEXT (κωδικός 1 μόνο, καμία συνένωση)', () => {
    const raw = lines(['0', 'TEXT'], ['8', '0'], ['10', 0], ['20', 0], ['1', 'ΑΠΛΟ'], ['0', 'ENDSEC']);
    expect(DxfEntityParser.parseEntity(raw, 0)!.data['1']).toBe('ΑΠΛΟ');
  });
});

// ── End-to-end: το πραγματικό σφάλμα ──────────────────────────────────────────

describe('MTEXT chunked content → σκηνή (regression 47_ergasia.dxf)', () => {
  /** 250-χαρακτήρων chunk όπως το γράφει το AutoCAD. */
  const chunk = (head: string): string => head + 'Χ'.repeat(250 - head.length);

  it('το κείμενο φτάνει ΑΚΕΡΑΙΟ — όχι μόνο η ουρά του', () => {
    const c1 = chunk('ΣΤΟΙΧΕΙΑ ΕΡΕΥΝΑΣ ΙΔΙΩΤΗ ΜΗΧΑΝΙΚΟΥ ');
    const c2 = chunk('Β. ΠΡΑΞΕΙΣ ΤΑΚΤΟΠΟΙΗΣΗΣ ');
    const es = buildEntities(lines(
      ['0', 'MTEXT'], ['8', 'ΠΕΡΙΓΡΑΦΗ'], ['10', 100], ['20', 200], ['40', 0.8], ['71', 1],
      ['3', c1], ['3', c2], ['1', 'ΤΕΛΟΣ'],
    ));

    const texts = es.filter(e => e.type === 'text').map(asText);
    expect(texts).toHaveLength(1);
    expect(texts[0].text).toContain('ΣΤΟΙΧΕΙΑ ΕΡΕΥΝΑΣ ΙΔΙΩΤΗ ΜΗΧΑΝΙΚΟΥ');
    expect(texts[0].text).toContain('Β. ΠΡΑΞΕΙΣ ΤΑΚΤΟΠΟΙΗΣΗΣ');
    expect(texts[0].text).toContain('ΤΕΛΟΣ');
    expect(texts[0].text.length).toBe(c1.length + c2.length + 'ΤΕΛΟΣ'.length);
  });

  it('ουρά (code 1) από σκέτα κενά ⇒ ούτε πετιέται, ούτε κρατά μόνο το τελευταίο chunk', () => {
    // ⚠️ ΔΥΟ chunks επίτηδες: με ΕΝΑ, το `|| data['3']` δίχτυ του convertMText θα «έσωζε»
    // το test κατά τύχη και η ρωγμή θα έμενε αόρατη — η ουσία είναι ότι ΟΛΑ τα chunks μένουν.
    const es = buildEntities(lines(
      ['0', 'MTEXT'], ['8', 'ΠΕΡΙΓΡΑΦΗ'], ['10', 100], ['20', 200], ['40', 0.8], ['71', 1],
      ['3', chunk('ΠΑΡΑΤΗΡΗΣΕΙΣ ')], ['3', chunk('ΤΟ ΔΙΑΓΡΑΜΜΑ ')], ['1', '                    '],
    ));

    const texts = es.filter(e => e.type === 'text').map(asText);
    expect(texts).toHaveLength(1);
    expect(texts[0].text).toContain('ΠΑΡΑΤΗΡΗΣΕΙΣ');
    expect(texts[0].text).toContain('ΤΟ ΔΙΑΓΡΑΜΜΑ');
  });

  it('MTEXT μέσα σε ορισμό BLOCK περνά από την ΙΔΙΑ διαδρομή (κοινό parseEntity)', () => {
    const c1 = chunk('ΤΙΤΛΟΣ ΙΔΙΟΚΤΗΣΙΑΣ ');
    const content = [
      ...lines(['0', 'SECTION'], ['2', 'BLOCKS']),
      ...lines(
        ['0', 'BLOCK'], ['2', 'TITLE'], ['10', 0], ['20', 0], ['30', 0],
        ['0', 'MTEXT'], ['8', '0'], ['10', 0], ['20', 0], ['40', 0.8], ['71', 1],
        ['3', c1], ['1', 'ΟΥΡΑ'],
        ['0', 'ENDBLK'],
      ),
      ...lines(['0', 'ENDSEC']),
      ...lines(['0', 'SECTION'], ['2', 'ENTITIES']),
      ...lines(['0', 'INSERT'], ['2', 'TITLE'], ['10', 100], ['20', 100]),
      ...lines(['0', 'ENDSEC'], ['0', 'EOF']),
    ].join('\n');

    const es = DxfSceneBuilder.buildScene(content, 'mm').entities;
    const block = es.find(e => e.type === 'block') as unknown as
      { entities?: Array<{ type: string; text?: string }> } | undefined;
    const child = block?.entities?.find(x => x.type === 'text');
    expect(child?.text).toContain('ΤΙΤΛΟΣ ΙΔΙΟΚΤΗΣΙΑΣ');
    expect(child?.text).toContain('ΟΥΡΑ');
  });
});
