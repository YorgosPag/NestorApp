/**
 * ADR-736 — **κάθε τύπος που μπορεί να γεννήσει η εισαγωγή DXF πρέπει να μετατοπίζεται.**
 *
 * ── Η κλάση σφάλματος που κλειδώνει αυτό το αρχείο ──────────────────────────────────────────
 * Το `normalizeEntityPositions` φέρνει το εισαγόμενο σχέδιο στην αρχή των αξόνων. Όποιος τύπος
 * λείπει από αυτό το πέρασμα **δεν σπάει** — μένει στις ωμές (συχνά γεωαναφερμένες, ~4×10⁸ mm)
 * συντεταγμένες ενώ όλοι οι αδελφοί του μετακινούνται. Η οντότητα υπάρχει στη σκηνή, ο renderer
 * την καλεί κανονικά, και ζωγραφίζεται εκατοντάδες χιλιάδες pixel εκτός καμβά. Καμία εξαίρεση,
 * καμία προειδοποίηση, κανένα κόκκινο test: **απλώς «δεν φαίνεται»**.
 *
 * Έχει συμβεί ήδη δύο φορές, με διαφορά μηνών:
 *   · ADR-635 Φ C.23 — έλειπε το `hatch` («γραμμές & γραμμοσκίαση σε μεγάλες αποστάσεις»)·
 *   · ADR-736 — έλειπαν `image` (10) **και** `dimension` (9) στο πραγματικό τοπογραφικό
 *     Ο.Τ. 47· τα 2.660 tests της υλοποίησης ήταν όλα πράσινα και δεν φαινόταν ούτε ένα υπόβαθρο.
 *
 * ── Γιατί ΑΥΤΟΣ ο έλεγχος και όχι «ένα test ανά διόρθωση» ──────────────────────────────────
 * Ένα test για το `hatch` δεν έπιασε το `image`· ένα test για το `image` δεν θα έπιανε τον
 * επόμενο. Ο πίνακας παρακάτω είναι το **πεδίο ορισμού**: ό,τι μπορεί να βγάλει το
 * `routeEntityToConverter`. Νέος converter ⇒ νέα γραμμή εδώ, αλλιώς ο τύπος είναι ακάλυπτος
 * (και αν κάποιος προσθέσει converter χωρίς γραμμή, το `dxf-import-emitted-types` παρακάτω
 * τον πιάνει: συγκρίνει τον πίνακα με τα πραγματικά `case` labels της πηγής).
 */

import * as fs from 'fs';
import * as path from 'path';
import { normalizeEntityPositions, type MutableBoundsEntity } from '../bounds-entity';

const DX = -1000;
const DY = -2000;

/** Ένα δείγμα ανά τύπο + πώς διαβάζεται ΕΝΑ σημείο του, ώστε να ελεγχθεί ότι όντως κουνήθηκε. */
interface Row {
  readonly type: string;
  readonly make: () => MutableBoundsEntity;
  readonly probe: (e: MutableBoundsEntity) => { x: number; y: number };
}

const P = { x: 5000, y: 7000 } as const;
const pt = (e: unknown, pick: (o: Record<string, unknown>) => unknown) =>
  pick(e as Record<string, unknown>) as { x: number; y: number };

const ROWS: readonly Row[] = [
  { type: 'line', make: () => ({ type: 'line', start: { ...P }, end: { x: 5100, y: 7100 } }),
    probe: (e) => pt(e, (o) => o.start) },
  { type: 'polyline', make: () => ({ type: 'polyline', vertices: [{ ...P }, { x: 5100, y: 7100 }] }),
    probe: (e) => pt(e, (o) => (o.vertices as unknown[])[0]) },
  { type: 'circle', make: () => ({ type: 'circle', center: { ...P }, radius: 10 }),
    probe: (e) => pt(e, (o) => o.center) },
  { type: 'arc', make: () => ({ type: 'arc', center: { ...P }, radius: 10, startAngle: 0, endAngle: 90 }),
    probe: (e) => pt(e, (o) => o.center) },
  { type: 'text', make: () => ({ type: 'text', position: { ...P }, text: 'A', height: 2 }),
    probe: (e) => pt(e, (o) => o.position) },
  { type: 'point', make: () => ({ type: 'point', position: { ...P } }),
    probe: (e) => pt(e, (o) => o.position) },
  { type: 'block', make: () => ({ type: 'block', position: { ...P }, name: 'B', entities: [] }),
    probe: (e) => pt(e, (o) => o.position) },
  { type: 'hatch', make: () => ({ type: 'hatch', boundaryPaths: [[{ ...P }, { x: 5100, y: 7000 }, { x: 5100, y: 7100 }]] }),
    probe: (e) => pt(e, (o) => ((o.boundaryPaths as unknown[])[0] as unknown[])[0]) },
  // 🔴 ADR-736 — οι δύο που έλειπαν στο πραγματικό τοπογραφικό.
  { type: 'image', make: () => ({ type: 'image', position: { ...P }, width: 100, height: 50, url: '' }),
    probe: (e) => pt(e, (o) => o.position) },
  { type: 'dimension', make: () => ({ type: 'dimension', defPoints: [{ ...P }, { x: 5100, y: 7000 }], textMidpoint: { x: 5050, y: 7050 } }),
    probe: (e) => pt(e, (o) => (o.defPoints as unknown[])[0]) },
  // Καλύπτονται από το ίδιο SSoT· μπαίνουν εδώ γιατί ΜΠΟΡΕΙ να τους γεννήσει η εισαγωγή.
  { type: 'leader', make: () => ({ type: 'leader', vertices: [{ ...P }, { x: 5100, y: 7100 }] }),
    probe: (e) => pt(e, (o) => (o.vertices as unknown[])[0]) },
  { type: 'xline', make: () => ({ type: 'xline', basePoint: { ...P }, direction: { x: 1, y: 0 } }),
    probe: (e) => pt(e, (o) => o.basePoint) },
  { type: 'ray', make: () => ({ type: 'ray', basePoint: { ...P }, direction: { x: 1, y: 0 } }),
    probe: (e) => pt(e, (o) => o.basePoint) },
  { type: 'spline', make: () => ({ type: 'spline', controlPoints: [{ ...P }, { x: 5100, y: 7100 }] }),
    probe: (e) => pt(e, (o) => (o.controlPoints as unknown[])[0]) },
  { type: 'ellipse', make: () => ({ type: 'ellipse', center: { ...P }, majorAxis: { x: 10, y: 0 }, ratio: 0.5 }),
    probe: (e) => pt(e, (o) => o.center) },
];

describe('normalizeEntityPositions — ΚΑΘΕ εισαγόμενος τύπος μετατοπίζεται (ADR-736)', () => {
  it.each(ROWS.map((r) => [r.type, r] as const))('%s', (_name, row) => {
    const entity = row.make();
    normalizeEntityPositions([entity], DX, DY);
    expect(row.probe(entity)).toEqual({ x: P.x + DX, y: P.y + DY });
  });

  it('🔴 η κατεύθυνση κατασκευαστικής γραμμής ΔΕΝ μετατοπίζεται (είναι διάνυσμα, όχι θέση)', () => {
    const xline: MutableBoundsEntity = { type: 'xline', basePoint: { ...P }, direction: { x: 1, y: 0 } };
    normalizeEntityPositions([xline], DX, DY);
    expect((xline as unknown as { direction: unknown }).direction).toEqual({ x: 1, y: 0 });
  });

  it('η διάσταση σέρνει ΚΑΙ το textMidpoint της (ADR-716 Φ7: ο καθρέφτης δεν αρκεί)', () => {
    const dim = ROWS.find((r) => r.type === 'dimension')!.make();
    normalizeEntityPositions([dim], DX, DY);
    expect((dim as unknown as { textMidpoint: unknown }).textMidpoint).toEqual({ x: 5050 + DX, y: 7050 + DY });
  });
});

/**
 * Ο πίνακας πάνω είναι χειρόγραφος· αυτό το test τον δένει με την **πηγή**. Διαβάζει τα `case`
 * labels του `routeEntityToConverter` και απαιτεί κάθε DXF τύπος που δρομολογείται εκεί να έχει
 * αντιστοιχία εδώ. Έτσι ένας νέος converter δεν μπορεί να προστεθεί χωρίς να απαντηθεί το
 * ερώτημα «και πώς μετατοπίζεται;» — που είναι ακριβώς το ερώτημα που έμεινε αναπάντητο δύο φορές.
 */
describe('dxf-import-emitted-types — ο πίνακας δεν μένει πίσω από τους converters', () => {
  /** DXF entity name → ο τύπος σκηνής που παράγει (ό,τι δεν είναι 1:1 δηλώνεται ρητά). */
  const DXF_TO_SCENE: Readonly<Record<string, string>> = {
    LINE: 'line', HATCH: 'hatch', LWPOLYLINE: 'polyline', POLYLINE: 'polyline',
    CIRCLE: 'circle', ARC: 'arc', ELLIPSE: 'ellipse', TEXT: 'text',
    MTEXT: 'text', MULTILINETEXT: 'text', ATTRIB: 'text', ATTDEF: 'text',
    SPLINE: 'spline', DIMENSION: 'dimension', XLINE: 'xline', RAY: 'ray',
    POINT: 'point', SOLID: 'hatch', '3DFACE': 'hatch', TRACE: 'hatch',
    MLINE: 'polyline', LEADER: 'leader', IMAGE: 'image',
  };

  it('κάθε `case` του routeEntityToConverter έχει γραμμή στον πίνακα μετατόπισης', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../../../utils/dxf-entity-converters.ts'),
      'utf8',
    );
    const body = src.slice(src.indexOf('function routeEntityToConverter'));
    const cases = [...body.matchAll(/case '([A-Z0-9]+)':/g)].map((m) => m[1]);
    expect(cases.length).toBeGreaterThan(15); // δίχτυ: αν αλλάξει το σχήμα, μη σιωπήσεις

    const covered = new Set(ROWS.map((r) => r.type));
    const uncovered = cases.filter((dxfType) => {
      const sceneType = DXF_TO_SCENE[dxfType];
      return !sceneType || !covered.has(sceneType);
    });
    expect(uncovered).toEqual([]);
  });
});
