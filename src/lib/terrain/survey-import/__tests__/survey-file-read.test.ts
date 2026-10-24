/**
 * ADR-920 Β4.7 — αρχείο τοπογραφικού → δρόμος → σημεία mm.
 *
 *   Π1  πρόταση στηλών: επικεφαλίδες · χωρίς επικεφαλίδα ⇒ τα δεδομένα · χωρίς ένδειξη ⇒ όλα «αγνόησε»
 *   Π2  ένας ρόλος, ένας κάτοχος: η ανάθεση αποδεσμεύει την παλιά στήλη· το «αγνόησε» δεν αποδεσμεύει τίποτα
 *   Α1  UTF-8 (με BOM) · 🏆 ελληνικό Excel σε windows-1253 με «;» και υποδιαστολή «,» ⇒ ίδιος πίνακας, ίδια πρόταση
 *   Α2  αρνήσεις με όνομα: XLS · DXF binary · άγνωστο · κενό · DXF χωρίς σημεία · XLSX που δεν ανοίγει
 *   Μ1  DXF με δηλωμένη μονάδα ⇒ `declared`, ο άνθρωπος δεν ρωτιέται και η επιλογή του αγνοείται
 *   Μ2  DXF «χωρίς μονάδες» (0) ή χωρίς δήλωση ⇒ ρωτιέται ο άνθρωπος (ποτέ οι προεπιλογές του viewer)
 *   Μ3  πίνακας ΕΓΣΑ'87 ⇒ πρόταση m με αιτιολόγηση · χωρίς μονάδα ⇒ κανένα σημείο · m ⇒ ×1000
 *   Μ4  γραμμές που δεν είναι σημεία αναφέρονται, δεν χάνονται σιωπηλά
 */

import { readSurveyFile, decodeSurveyText, type SurveyFileRead } from '../survey-file-read';
import { surveyPointsOf, surveyUnitDecision } from '../survey-points';
import { assignRole, proposeColumnMapping } from '../topo-mapping-edit';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/** windows-1253: ASCII αυτούσιο, το ελληνικό μπλοκ U+0384–U+03CE στο 0xB4–0xFE (σταθερή μετατόπιση 0x2D0). */
function cp1253(text: string): Uint8Array {
  return Uint8Array.from([...text].map((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x80) return code;
    if (code >= 0x0384 && code <= 0x03ce) return code - 0x2d0;
    throw new Error(`εκτός windows-1253: ${ch}`);
  }));
}

/** Πέντε σημεία στον ΕΓΣΑ'87 σε μέτρα — ό,τι στέλνει ένας Έλληνας τοπογράφος. */
const GREEK_ROWS = [
  '1;450000,000;4200000,000;100,000',
  '2;450030,000;4200000,000;101,000',
  '3;450030,000;4200020,000;102,500',
  '4;450000,000;4200020,000;101,500',
  '5;450015,000;4200010,000;101,200',
];
const GREEK_CSV = ['ΑΑ;Χ;Ψ;Υψόμετρο', ...GREEK_ROWS].join('\r\n');

const dxf = (insunits: string | null, body: string): string => [
  ...(insunits === null ? [] : ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', insunits, '0', 'ENDSEC']),
  '0', 'SECTION', '2', 'ENTITIES', body, '0', 'ENDSEC', '0', 'EOF',
].join('\n');
const POINTS = ['0', 'POINT', '8', '0', '10', '1', '20', '2', '30', '3', '0', 'POINT', '8', '0', '10', '41', '20', '32', '30', '4'].join('\n');

function tableOf(read: SurveyFileRead) {
  if (read.road !== 'table') throw new Error(`αναμενόταν πίνακας, ήρθε ${read.road}`);
  return read;
}

describe('Π — η αντιστοίχιση ως επεξεργασία', () => {
  it('Π1 επικεφαλίδες · δεδομένα · τίποτα', () => {
    expect(proposeColumnMapping({ headers: ['ΑΑ', 'Χ', 'Ψ', 'Υψόμετρο'], rows: [['1', '2', '3', '4']] }))
      .toStrictEqual(['pointId', 'x', 'y', 'z']);
    const headless = { headers: [], rows: GREEK_ROWS.map((row) => row.split(';')) };
    expect(proposeColumnMapping(headless)).toStrictEqual(['pointId', 'x', 'y', 'z']);
    expect(proposeColumnMapping({ headers: [], rows: [['α', 'β']] })).toStrictEqual(['ignore', 'ignore']);
  });

  it('Π2 ο ρόλος μετακομίζει, δεν διπλασιάζεται', () => {
    expect(assignRole(['x', 'y', 'z'], 2, 'x')).toStrictEqual(['ignore', 'y', 'x']);
    expect(assignRole(['x', 'y', 'z'], 0, 'ignore')).toStrictEqual(['ignore', 'y', 'z']);
  });
});

describe('Α — η ανάγνωση', () => {
  it('Α1 το ίδιο ελληνικό αρχείο σε UTF-8 (με BOM) και σε windows-1253 δίνει τον ίδιο πίνακα', async () => {
    expect(decodeSurveyText(cp1253('Υψόμετρο'))).toBe('Υψόμετρο');
    const fromUtf8 = tableOf(await readSurveyFile('survey.csv', utf8(`﻿${GREEK_CSV}`)));
    const fromCp1253 = tableOf(await readSurveyFile('survey.csv', cp1253(GREEK_CSV)));

    expect(fromCp1253.table).toStrictEqual(fromUtf8.table);
    expect(fromCp1253.table.headers).toStrictEqual(['ΑΑ', 'Χ', 'Ψ', 'Υψόμετρο']);
    expect(fromCp1253.proposedMapping).toStrictEqual(['pointId', 'x', 'y', 'z']);
  });

  it.each([
    ['old.xls', Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 1, 2]), 'xls-legacy'],
    ['plot.dxf', utf8('AutoCAD Binary DXF\r\n\u001a\u0000'), 'dxf-binary'],
    ['photo.png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0]), 'unsupported'],
    ['empty.csv', utf8('# μόνο σχόλιο\n'), 'empty'],
    ['nothing.dxf', utf8(dxf('6', '')), 'empty'],
    ['broken.xlsx', Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 9, 9, 9]), 'unreadable'],
  ])('Α2 %s ⇒ %s', async (name, bytes, refusal) => {
    expect(await readSurveyFile(name, bytes)).toStrictEqual({ road: 'refused', refusal });
  });
});

describe('Μ — μονάδα και σημεία', () => {
  it('Μ1 DXF σε μέτρα: η μονάδα είναι δηλωμένη και η επιλογή του ανθρώπου δεν την αλλάζει', async () => {
    const read = await readSurveyFile('plot.dxf', utf8(dxf('6', POINTS)));
    expect(surveyUnitDecision(read, [])).toStrictEqual({ kind: 'declared', insunits: 6, scaleToMm: 1000 });
    expect(surveyPointsOf(read, [], 'mm').points[0]).toStrictEqual({ x: 1000, y: 2000, z: 3000 });
  });

  it.each([['0'], [null]])('Μ2 DXF με $INSUNITS %p ⇒ ρωτιέται ο άνθρωπος', async (insunits) => {
    const read = await readSurveyFile('plot.dxf', utf8(dxf(insunits, POINTS)));
    expect(surveyUnitDecision(read, []).kind).toBe('to-confirm');
    expect(surveyPointsOf(read, [], null).points).toStrictEqual([]);
    expect(surveyPointsOf(read, [], 'm').points[1]).toStrictEqual({ x: 41_000, y: 32_000, z: 4000 });
  });

  it('Μ3 πίνακας ΕΓΣΑ’87: πρόταση m με αιτιολόγηση · χωρίς μονάδα κανένα σημείο · m ⇒ mm', async () => {
    const read = tableOf(await readSurveyFile('survey.csv', cp1253(GREEK_CSV)));
    const mapping = read.proposedMapping;

    expect(surveyUnitDecision(read, mapping)).toStrictEqual({ kind: 'to-confirm', suggestion: { unit: 'm', evidence: 'greek-grid' } });
    expect(surveyPointsOf(read, mapping, null).points).toStrictEqual([]);
    expect(surveyPointsOf(read, mapping, 'm').points[0]).toStrictEqual({ x: 450_000_000, y: 4_200_000_000, z: 100_000, pointNumber: '1' });
  });

  it('Μ4 η γραμμή που δεν είναι σημείο αναφέρεται με τον αριθμό της', async () => {
    const read = tableOf(await readSurveyFile('survey.csv', cp1253([GREEK_CSV, 'Σύνολο;;;'].join('\r\n'))));
    const result = surveyPointsOf(read, read.proposedMapping, 'm');
    expect(result.points).toHaveLength(5);
    expect(result.skippedRows).toStrictEqual([6]);
  });
});
