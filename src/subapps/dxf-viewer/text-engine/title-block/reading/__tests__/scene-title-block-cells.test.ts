/**
 * @fileoverview Ο προσαρμογέας ζωντανής σκηνής → Λ1 (ADR-745 Φ3β).
 *
 * 🔑 **Ο κεντρικός ισχυρισμός είναι ΙΣΟΔΥΝΑΜΙΑ, όχι ορθότητα.** Η ορθότητα του Λ1 αποδεικνύεται
 * ήδη στο `title-block-reading.test.ts` πάνω στο ωμό αρχείο. Εδώ αποδεικνύεται το μόνο που
 * προσθέτει αυτός ο κρίκος: ότι η **ίδια** πινακίδα, διαβασμένη από τη σκηνή (όπου το ωμό MTEXT
 * έχει πεταχτεί και ξαναγράφεται από το AST), δίνει **το ίδιο αποτέλεσμα**.
 *
 * ⚠️ Το G753 έχει **μόνο** σχετικά `\H…x;` και κωδ. 40 στο εύρος 0,6–2,936 — **κανένα 2,5**.
 * Ένα test μόνο πάνω του θα ήταν πράσινο ακόμη κι αν ο γυρισμός άλλαζε τη μονάδα του ύψους, και
 * θα **κλείδωνε τη σύμπτωση ως συμβόλαιο**. Γι' αυτό η ισοδυναμία τρέχει **παραμετροποιημένη στο
 * ύψος**, με το 2,5 (προεπιλογή AutoCAD) ρητά μέσα.
 */

import type { Entity, TextEntity } from '../../../../types/entities';
import type { SceneLayer } from '../../../../types/scene-types';
import { parseMtext } from '../../../parser/mtext-parser';
import { tokenizeMtext } from '../../../parser/mtext-tokenizer';
import { readTitleBlocks } from '../title-block-reading';
import {
  collectTitleBlockCells,
  scanTitleBlockLayers,
  sceneCellFromTextEntity,
} from '../scene-title-block-cells';
import { G753_TITLEBLOCK_ROWS } from './fixtures/g753-titleblock.fixture';

const LAYER_ID = 'lyr_pinakaki';
const LAYER_NAME = 'PINAKAKI 500';

const layer = (id: string, name: string): SceneLayer =>
  ({ id, name, color: '#fff' }) as SceneLayer;

/**
 * Μια οντότητα σκηνής όπως ΑΚΡΙΒΩΣ την παράγει ο importer: το ωμό περνά από
 * `parseMtext(tokenizeMtext(raw), { height })` και **μόνο** το AST επιβιώνει.
 *
 * Το `id` παίρνει το πραγματικό DXF handle του fixture ώστε η σύγκριση να απομονώνει τη
 * **μεταβλητή υπό εξέταση** (το περιεχόμενο) — το ζευγάρωμα σπάει ισοπαλίες κόστους με το
 * `handle`, οπότε διαφορετικά ονόματα θα εισήγαγαν δεύτερη διαφορά.
 */
const entityFromRow = (
  row: (typeof G753_TITLEBLOCK_ROWS)[number],
  heightOverride?: number,
): TextEntity => {
  const height = heightOverride ?? row.height;
  return {
    id: row.handle,
    type: 'text',
    layerId: LAYER_ID,
    visible: true,
    position: { x: row.x, y: row.y },
    text: '',
    height,
    rotation: 0,
    alignment: 'left',
    // 🔴 Το `parseMtext` **σκληροκωδικοποιεί `attachment: 'TL'`** — βλέπει μόνο inline κωδικούς,
    // όχι τον κωδ. 71 της οντότητας. Ο πραγματικός `convertMText` το γράφει από πάνω με το
    // `MTEXT_ATTACHMENT_MAP`, και το ίδιο κάνουμε εδώ: αλλιώς το δείγμα θα δήλωνε ότι **όλα**
    // τα κελιά είναι `TL`, δηλαδή θα έσβηνε ακριβώς τη μεταβλητή που εξετάζει το ADR-762.
    textNode: { ...parseMtext(tokenizeMtext(row.raw), { height }), attachment: row.attachment },
  } as TextEntity;
};

/**
 * Ομοιόμορφη κλίμακα ΟΛΟΥ του σχεδίου — θέσεις **και** ύψη.
 *
 * 🔴 Το ύψος δεν αλλάζει μόνο του: το ζευγάρωμα του Λ1 μετρά το κόστος σε **ύψη κειμένου της
 * ετικέτας**, ώστε ένα κελί 0,73 και ένα 2,94 να συγκρίνονται δίκαια. Αν σμικρύνεις μόνο τα ύψη
 * κρατώντας τις θέσεις, κάθε απόσταση εκτοξεύεται σε «ύψη» και **τίποτα δεν ζευγαρώνει** — δηλαδή
 * δοκιμάζεις ένα σχέδιο που δεν υπάρχει. Ένα πραγματικό σχέδιο σε άλλη κλίμακα έχει **και τα δύο**
 * σμικρυμένα, και εκεί ο αναγνώστης οφείλει να δίνει **το ίδιο** αποτέλεσμα.
 */
const scaleRow = (row: (typeof G753_TITLEBLOCK_ROWS)[number], k: number) => ({
  ...row,
  x: row.x * k,
  y: row.y * k,
  height: row.height * k,
});

const sceneCells = (k = 1) =>
  G753_TITLEBLOCK_ROWS.map((row) => {
    const scaled = scaleRow(row, k);
    const cell = sceneCellFromTextEntity(entityFromRow(scaled));
    if (!cell) throw new Error(`Το κελί ${row.handle} χάθηκε στον προσαρμογέα`);
    return cell;
  });

/** Τα ωμά κελιά στην ίδια κλίμακα — η σύγκριση αφορά **μόνο** τη διαδρομή του κειμένου. */
const rawCells = (k = 1) =>
  G753_TITLEBLOCK_ROWS.map((row) => {
    const { x, y, height } = scaleRow(row, k);
    return { handle: row.handle, x, y, height, raw: row.raw, attachment: row.attachment };
  });

/**
 * Η κλίμακα που φέρνει το κελί των μελετητών **ακριβώς** στο 2,5.
 *
 * Το 2,5 δεν είναι τυχαίο νούμερο: είναι η **σκληροκωδικοποιημένη βάση** του serializer
 * (`createDefaultTextRunStyle`). Εκεί —και **μόνο** εκεί— ο serializer κρίνει ότι το ύψος «δεν
 * άλλαξε» και **παραλείπει** το πρώτο `\H`, οπότε η πρώτη γραμμή μένει στη βάση ενώ οι επόμενες
 * γράφονται απόλυτες. Είναι το ακριβές σημείο όπου μια αφελής υλοποίηση αντιστρέφει την κατάταξη
 * και **χάνει τον κύριο μελετητή**. Το δείγμα G753 δεν το φτάνει ποτέ από μόνο του.
 */
const DESIGNERS_HEIGHT = 0.8997600000000002;
const K_DESIGNERS_AT_2_5 = 2.5 / DESIGNERS_HEIGHT;

describe('προσαρμογέας σκηνής → Λ1', () => {
  it('🔴 ΙΣΟΔΥΝΑΜΙΑ: η σκηνή διαβάζεται ΤΑΥΤΟΣΗΜΑ με το ωμό αρχείο', () => {
    expect(readTitleBlocks(LAYER_NAME, sceneCells())).toEqual(
      readTitleBlocks(LAYER_NAME, rawCells()),
    );
  });

  it('το σημείο-παγίδα υπάρχει όντως στο 2,5 — η κλίμακα δεν είναι διακοσμητική', () => {
    const designers = sceneCells(K_DESIGNERS_AT_2_5).find((c) => c.raw.includes('ΜΑΥΡΟΜΙΧΑΛΗΣ'));
    expect(designers?.height).toBeCloseTo(2.5, 9);
  });

  it.each([
    ['μισό σχέδιο', 0.5],
    ['το δείγμα ως έχει', 1],
    ['🔴 μελετητές ΑΚΡΙΒΩΣ στη βάση 2,5 του serializer', K_DESIGNERS_AT_2_5],
    ['δεκαπλάσιο σχέδιο', 10],
  ])('🔴 …και παραμένει ταυτόσημη σε κλίμακα «%s»', (_label, k) => {
    const fromScene = readTitleBlocks(LAYER_NAME, sceneCells(k));
    expect(fromScene).toEqual(readTitleBlocks(LAYER_NAME, rawCells(k)));
    // Και δεν είναι κενή ισοδυναμία: οι δύο μηχανικοί βγαίνουν, σε κάθε κλίμακα.
    const people = fromScene.flatMap((r) => r.people).map((p) => p.displayName);
    expect(people).toContain('ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ');
    expect(people).toContain('ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ');
  });

  it('η αλλαγή γραμμής \\N επιβιώνει του γυρισμού — δύο γραμμές, όχι μία', () => {
    // Ο parser γράφει το `\N` ως κυριολεκτικό '\n' μέσα στο run· χωρίς επανακωδικοποίηση στον
    // serializer οι δύο γραμμές θα ενώνονταν και η δεύτερη θα έχανε το ύψος της.
    const node = parseMtext(tokenizeMtext('ΑΛΦΑ\\NΒΗΤΑ'), { height: 1 });
    const cell = sceneCellFromTextEntity({
      id: 'x', type: 'text', layerId: LAYER_ID, position: { x: 0, y: 0 },
      text: '', height: 1, textNode: node,
    } as TextEntity);
    expect(cell?.raw).toContain('\\N');
    expect(cell?.raw).not.toMatch(/\n/);
  });

  it('χωρίς textNode πέφτει στο flat κείμενο αντί να χάσει το κελί', () => {
    const cell = sceneCellFromTextEntity({
      id: 'y', type: 'text', layerId: LAYER_ID, position: { x: 1, y: 2 },
      text: 'ΚΛΙΜΑΚΑ', height: 3,
    } as TextEntity);
    expect(cell).toEqual({ handle: 'y', x: 1, y: 2, height: 3, raw: 'ΚΛΙΜΑΚΑ' });
  });

  it('κενό κελί δεν γίνεται ποτέ κελί πινακίδας', () => {
    expect(
      sceneCellFromTextEntity({
        id: 'z', type: 'text', layerId: LAYER_ID, position: { x: 0, y: 0 },
        text: '   ', height: 1,
      } as TextEntity),
    ).toBeNull();
  });
});

describe('συλλογή κελιών ανά layer', () => {
  const entities = (): Entity[] => [
    ...G753_TITLEBLOCK_ROWS.map((r) => entityFromRow(r)),
    { id: 'ln_1', type: 'line', layerId: LAYER_ID, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as unknown as Entity,
    { ...entityFromRow(G753_TITLEBLOCK_ROWS[0]), id: 'other_1', layerId: 'lyr_other' } as Entity,
  ];

  it('κρατά μόνο κείμενο του ζητούμενου layer', () => {
    const cells = collectTitleBlockCells(entities(), LAYER_ID);
    expect(cells).toHaveLength(G753_TITLEBLOCK_ROWS.length);
    expect(cells.every((c) => c.raw.length > 0)).toBe(true);
  });

  it('🔴 δεν φιλτράρει σε dxfSourceType — οι απλές TEXT είναι ΠΕΡΙΣΣΟΤΕΡΕΣ στο δείγμα (308/266)', () => {
    // Καμία οντότητα του fixture δεν σφραγίζεται ως mtext εδώ· αν το κριτήριο ήταν το
    // `dxfSourceType`, το layer θα έβγαινε άδειο και η πινακίδα «δεν θα υπήρχε».
    const plain = collectTitleBlockCells(entities(), LAYER_ID);
    expect(plain.length).toBeGreaterThan(0);
  });
});

describe('κατάταξη layers — καμία εικασία από το όνομα', () => {
  const noise = (i: number): Entity =>
    ({
      id: `noise_${i}`, type: 'text', layerId: 'lyr_noise', position: { x: i * 50, y: i * 50 },
      text: `ΚΟΡΥΦΗ ${i}`, height: 1,
    }) as unknown as Entity;

  const scene = () => ({
    entities: [
      ...G753_TITLEBLOCK_ROWS.map((r) => entityFromRow(r)),
      ...Array.from({ length: 6 }, (_, i) => noise(i)),
    ] as Entity[],
    layersById: {
      [LAYER_ID]: layer(LAYER_ID, LAYER_NAME),
      lyr_noise: layer('lyr_noise', 'Pinakas-Syntetagmenon'),
    },
  });

  it('η πινακίδα κερδίζει επειδή ΑΠΟΔΙΔΕΙ, όχι επειδή λέγεται PINAKAKI', () => {
    const { candidates } = scanTitleBlockLayers(scene().entities, scene().layersById);
    expect(candidates[0].layerName).toBe(LAYER_NAME);
    expect(candidates[0].fieldCount).toBeGreaterThanOrEqual(7);
    expect(candidates[0].personCount).toBe(2);
  });

  it('layer με ετικέτες κορυφών δεν παράγει υποψήφιο πεδίο', () => {
    const { candidates } = scanTitleBlockLayers(scene().entities, scene().layersById);
    expect(candidates.map((c) => c.layerName)).not.toContain('Pinakas-Syntetagmenon');
  });

  it('η κατάταξη είναι ντετερμινιστική — η σειρά των οντοτήτων δεν αλλάζει τον νικητή', () => {
    const s = scene();
    const forward = scanTitleBlockLayers(s.entities, s.layersById).candidates.map((c) => c.layerName);
    const reversed = scanTitleBlockLayers([...s.entities].reverse(), s.layersById).candidates.map((c) => c.layerName);
    expect(reversed).toEqual(forward);
  });

  /**
   * 🔴 Η ισοπαλία είναι το ΜΟΝΟ σενάριο όπου το σπάσιμο κατ' όνομα μετράει — και ένα σχέδιο με
   * δύο ίδιες πινακίδες (π.χ. δύο φύλλα του ίδιου τοπογράφου) δεν είναι εξωτικό. Η `Array.sort`
   * του V8 είναι **σταθερή**, οπότε χωρίς ρητό σπάσιμο ο νικητής θα ήταν όποιος τύχαινε να μπει
   * πρώτος στο `layersById` — δηλαδή ο άνθρωπος θα έβλεπε **άλλη** πρόταση σε κάθε άνοιγμα.
   */
  it('🔴 σε ΙΣΟΠΑΛΙΑ κερδίζει το όνομα — όχι η σειρά των κλειδιών του layersById', () => {
    const twin = (id: string, dx: number): Entity[] =>
      G753_TITLEBLOCK_ROWS.map((r) => ({
        ...entityFromRow({ ...r, x: r.x + dx }),
        id: `${id}_${r.handle}`,
        layerId: id,
      })) as Entity[];

    const entities = [...twin('lyr_alpha', 0), ...twin('lyr_beta', 5000)];
    const alpha = layer('lyr_alpha', 'ALPHA');
    const beta = layer('lyr_beta', 'BETA');

    const first = scanTitleBlockLayers(entities, { lyr_beta: beta, lyr_alpha: alpha });
    const second = scanTitleBlockLayers(entities, { lyr_alpha: alpha, lyr_beta: beta });

    // Πρώτα βεβαιωνόμαστε ότι υπάρχει ΟΝΤΩΣ ισοπαλία — αλλιώς το test δεν δοκιμάζει τίποτα.
    expect(first.candidates).toHaveLength(2);
    expect(first.candidates[0].fieldCount).toBe(first.candidates[1].fieldCount);
    expect(first.candidates[0].personCount).toBe(first.candidates[1].personCount);

    expect(first.candidates.map((c) => c.layerName)).toEqual(['ALPHA', 'BETA']);
    expect(second.candidates.map((c) => c.layerName)).toEqual(['ALPHA', 'BETA']);
  });

  it('layer με ένα μόνο κελί αγνοείται χωρίς να δηλωθεί παράλειψη — δεν υπάρχει ζεύγος', () => {
    const { candidates, skipped } = scanTitleBlockLayers(
      [entityFromRow(G753_TITLEBLOCK_ROWS[0])],
      { [LAYER_ID]: layer(LAYER_ID, LAYER_NAME) },
    );
    expect(candidates).toHaveLength(0);
    expect(skipped).toHaveLength(0);
  });

  it('🔴 layer που ΔΕΝ εξετάστηκε λόγω μεγέθους δηλώνεται ρητά — ποτέ σιωπηλή παράλειψη', () => {
    const many = Array.from({ length: 801 }, (_, i) => noise(i));
    const { candidates, skipped } = scanTitleBlockLayers(many, {
      lyr_noise: layer('lyr_noise', 'HUGE'),
    });
    expect(candidates).toHaveLength(0);
    expect(skipped).toEqual([
      { layerId: 'lyr_noise', layerName: 'HUGE', reason: 'too-many-cells', cellCount: 801 },
    ]);
  });
});
