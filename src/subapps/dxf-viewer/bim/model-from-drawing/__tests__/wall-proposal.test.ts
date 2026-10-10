/**
 * ADR-911 Φ1 — άγκυρες του πυρήνα πρότασης τοίχων, πάνω στο ΠΡΑΓΜΑΤΙΚΟ σχέδιο δοκιμής.
 *
 *   Α-1  160 γραμμές ρόλου «τοίχος» → 40 ορθογώνια, 160/160 εξηγημένες.
 *   Α-2  η αναφορά κάλυψης κλείνει λογιστικά (εξηγημένες + ανεξήγητες + αγνοημένες = όλες).
 *   Α-4  ορθογώνιο χωρίς προφανή άξονα ΔΕΝ βγαίνει έτοιμο.
 *   Δ7   άξονας από ομοαξονικό γείτονα ίδιου πάχους· αντίφαση ή μοναξιά ⇒ «θέλει απόφαση».
 *   Δ3   ομάδες πάχους με τοπολογική πρόταση· η επιλογή του ανθρώπου νικά και φαίνεται.
 *   Α-3  ο τύπος μπαίνει ΜΕΣΑ στην πρόταση (ό,τι φωτίζεται φέρει ήδη τον τύπο του).
 *   Α-6  δεύτερη εκτέλεση στο ίδιο σχέδιο προτείνει μηδέν νέους τοίχους.
 *
 * Το fixture είναι οι γραμμές + τόξα του «Ισόγειο 1.dxf» (scene revision 11). Ο `colorOf`
 * εδώ διαβάζει το `color` που φέρει κάθε γραμμή· στην εφαρμογή τον ρόλο αυτό παίζει το
 * `resolveEntityColorHex` (το fixture δεν έχει ByLayer/ACI περιπτώσεις να ξεχωρίσει).
 */

import type { Entity } from '../../../types/entities';
import type { WallDetectionStrategy } from '../wall-detection-strategy';
import { computeWallProposal, type WallProposal, type WallProposalInput } from '../wall-proposal';
import { buildAutoWallType } from '../../family-types/auto-wall-type';
import { getBuiltInWallTypes } from '../../family-types/built-in-types';
import { createWallTyper } from '../../family-types/wall-typer';
import fixture from './fixtures/floor-plan-lines.json';

const WALL_HEX = '#003fff';
const LEVEL = 'lvl_test';

const ENTITIES = fixture.entities as unknown as readonly Entity[];
const colorOf = (e: Entity): string | null => {
  const color = (e as { color?: string }).color;
  return color ? color.toLowerCase() : null;
};

function line(id: string, color: string, ax: number, ay: number, bx: number, by: number): Entity {
  return { id, type: 'line', color, start: { x: ax, y: ay }, end: { x: bx, y: by } } as unknown as Entity;
}

/** 4 γραμμές ορθογωνίου [x,y]→[x+w,y+h] σε χρώμα `color`. */
function frame(prefix: string, color: string, x: number, y: number, w: number, h: number): Entity[] {
  return [
    line(`${prefix}-0`, color, x, y, x + w, y),
    line(`${prefix}-1`, color, x + w, y, x + w, y + h),
    line(`${prefix}-2`, color, x + w, y + h, x, y + h),
    line(`${prefix}-3`, color, x, y + h, x, y),
  ];
}

function propose(overrides: Partial<WallProposalInput> = {}): WallProposal {
  return computeWallProposal({
    entities: ENTITIES,
    wallColorHex: WALL_HEX,
    colorOf,
    sceneUnits: 'mm',
    levelId: LEVEL,
    ...overrides,
  });
}

function countByStatus(p: WallProposal): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of p.items) counts[item.status] = (counts[item.status] ?? 0) + 1;
  return counts;
}

const undecidedKeys = (p: WallProposal): Set<string> =>
  new Set(p.items.filter((i) => i.status === 'needs-decision').map((i) => i.key));

describe('ADR-911 Α-1 — ανίχνευση στο σχέδιο δοκιμής', () => {
  it('160 γραμμές ρόλου «τοίχος» δίνουν 40 ορθογώνια και εξηγούνται όλες', () => {
    const p = propose();
    expect(p.items).toHaveLength(40);
    expect(p.coverage.explainedIds).toHaveLength(160);
    expect(p.coverage.unexplainedIds).toEqual([]);
  });

  it('κάθε ακμή κάθε ορθογωνίου έχει γραμμή-πηγή, και όλες μαζί είναι οι 160', () => {
    const p = propose();
    const edges = p.items.flatMap((i) => i.sourceIds);
    expect(edges).toHaveLength(160);
    expect(edges.every((ids) => ids.length >= 1)).toBe(true);
    expect(new Set(edges.flat()).size).toBe(160);
  });

  it('συμπίπτουσες γραμμές στο κοινό άκρο δύο τοίχων εξηγούνται ΚΑΙ οι δύο', () => {
    // Το σχέδιο έχει 6 τέτοια ζεύγη (π.χ. line_88 / line_709): κάθε τοίχος σχεδίασε το δικό
    // του άκρο. «Μία γραμμή ανά ακμή» άφηνε τη δίδυμη ορφανή — 6 ψευδώς ανεξήγητες.
    const twins = propose().items.flatMap((i) => i.sourceIds).filter((ids) => ids.length === 2);
    expect(twins).toHaveLength(12); // 6 ζεύγη × 2 τοίχους που τα μοιράζονται
    expect(new Set(twins.flat()).size).toBe(12);
  });

  it('τα κλειδιά των ορθογωνίων είναι μοναδικά', () => {
    const p = propose();
    expect(new Set(p.items.map((i) => i.key)).size).toBe(p.items.length);
  });
});

describe('ADR-911 Α-2 — η αναφορά κάλυψης κλείνει λογιστικά', () => {
  it('εξηγημένες + ανεξήγητες + αγνοημένες = όλες οι γραμμικές οντότητες', () => {
    const { coverage } = propose();
    expect(coverage.totalCount).toBe(522); // τα 6 τόξα δεν είναι γραμμικές οντότητες
    expect(coverage.ignoredCount).toBe(362);
    expect(coverage.explainedIds.length + coverage.unexplainedIds.length + coverage.ignoredCount)
      .toBe(coverage.totalCount);
  });

  it('γραμμή ρόλου που δεν κλείνει ορθογώνιο βγαίνει ανεξήγητη, με το id της', () => {
    const stray = line('stray', '#003FFF', 50000, 50000, 52000, 50000);
    const { coverage } = propose({ entities: [...ENTITIES, stray] });
    expect(coverage.unexplainedIds).toEqual(['stray']);
    expect(coverage.totalCount).toBe(523);
  });

  it('ορθογώνιο που έχασε μία πλευρά: οι 3 που έμειναν είναι ανεξήγητες, όχι σιωπηλά χαμένες', () => {
    const victim = propose().items[0].sourceIds[0][0];
    const p = propose({ entities: ENTITIES.filter((e) => e.id !== victim) });
    expect(p.items).toHaveLength(39);
    expect(p.coverage.unexplainedIds).toHaveLength(3);
    expect(p.coverage.explainedIds).toHaveLength(156);
  });

  it('η ραφή στρατηγικής: ανιχνευτής που δεν βρίσκει τίποτα αφήνει ΟΛΕΣ τις γραμμές ανεξήγητες', () => {
    const blind: WallDetectionStrategy = () => [];
    const p = propose({ strategy: blind });
    expect(p.items).toEqual([]);
    expect(p.coverage.unexplainedIds).toHaveLength(160);
  });
});

describe('ADR-911 Α-4 — ορθογώνιο χωρίς προφανή άξονα θέλει απόφαση', () => {
  it('τα σχεδόν τετράγωνα που ΔΕΝ εξηγεί το συμφραζόμενο δεν βγαίνουν έτοιμα και δεν φέρουν τοίχο', () => {
    // 6 ορθογώνια έχουν λόγο πλευρών < 1,75· τα 4 παίρνουν άξονα από ομοαξονικό γείτονα (Δ7).
    const p = propose();
    expect(countByStatus(p)).toEqual({ ready: 38, 'needs-decision': 2 });
    expect(p.walls).toHaveLength(38);
    for (const item of p.items.filter((i) => i.status === 'needs-decision')) {
      expect(item.wall).toBeUndefined();
      expect(item.rect.longSide / item.rect.shortSide).toBeLessThan(1.75);
    }
  });

  it('το κατώφλι δεν κάθεται πάνω σε τιμή των δεδομένων: θόρυβος 0,001 mm δεν αλλάζει κατάταξη', () => {
    // Οι λόγοι του σχεδίου είναι 1,0 · 1,5 · 2,0 · … Κατώφλι ΠΑΝΩ σε έναν από αυτούς θα
    // έκανε το ίδιο ορθογώνιο «αμφίσημο» ή «τοίχο» ανάλογα με το τελευταίο δεκαδικό.
    const nudged = ENTITIES.map((e) => {
      const l = e as unknown as { start?: { x: number; y: number }; end?: { x: number; y: number } };
      if (!l.start || !l.end) return e;
      return { ...e, start: { x: l.start.x + 0.001, y: l.start.y - 0.001 }, end: l.end } as unknown as Entity;
    });
    expect(countByStatus(propose({ entities: nudged }))).toEqual(countByStatus(propose()));
  });

  it('με απόφαση ανθρώπου γίνονται τοίχοι — και μόνο όσα αποφασίστηκαν', () => {
    const keys = [...undecidedKeys(propose())];
    expect(countByStatus(propose({ acceptedKeys: new Set(keys.slice(0, 1)) })))
      .toEqual({ ready: 39, 'needs-decision': 1 });
    expect(countByStatus(propose({ acceptedKeys: new Set(keys) }))).toEqual({ ready: 40 });
  });

  it('το πάχος κάθε τοίχου είναι η μικρή πλευρά, όπως μετρήθηκε', () => {
    const p = propose({ acceptedKeys: undecidedKeys(propose()) });
    const hist: Record<number, number> = {};
    for (const w of p.walls) {
      const t = Math.round(w.params.thickness);
      hist[t] = (hist[t] ?? 0) + 1;
    }
    expect(hist).toEqual({ 50: 3, 100: 21, 200: 3, 250: 13 });
  });
});

describe('ADR-911 — απόρριψη με λόγο', () => {
  it('ορθογώνιο παχύτερο από το όριο τοίχου απορρίπτεται και λέει γιατί', () => {
    const tooThick = frame('thick', '#003FFF', 60000, 60000, 9000, 2500);
    const p = propose({ entities: [...ENTITIES, ...tooThick] });
    const rejected = p.items.filter((i) => i.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBe('regionPerimeter.rejected.thicknessTooThick');
    expect(rejected[0].wall).toBeUndefined();
    // Απορριφθέν ορθογώνιο ΕΞΗΓΕΙ τις γραμμές του: ο άνθρωπος βλέπει τον λόγο, όχι «ανεξήγητο».
    expect(p.coverage.unexplainedIds).toEqual([]);
  });
});

describe('ADR-911 Α-6 — ιδεμποτία', () => {
  it('δεύτερη εκτέλεση, με τους τοίχους ήδη στη σκηνή, προτείνει μηδέν νέους', () => {
    const first = propose({ acceptedKeys: undecidedKeys(propose()) });
    expect(first.walls).toHaveLength(40);

    const scene = [...ENTITIES, ...(first.walls as unknown as Entity[])];
    const second = propose({ entities: scene, acceptedKeys: undecidedKeys(propose()) });
    expect(second.walls).toEqual([]);
    expect(countByStatus(second)).toEqual({ existing: 40 });
    // Οι γραμμές παραμένουν εξηγημένες: το ορθογώνιο υπάρχει, απλώς έχει ήδη τον τοίχο του.
    expect(second.coverage.unexplainedIds).toEqual([]);
  });

  it('μισοτελειωμένη εκτέλεση συμπληρώνεται: προτείνονται μόνο όσοι λείπουν', () => {
    const first = propose();
    const half = first.walls.slice(0, 20);
    const second = propose({ entities: [...ENTITIES, ...(half as unknown as Entity[])] });
    expect(countByStatus(second)).toEqual({ existing: 20, ready: 18, 'needs-decision': 2 });
  });
});

describe('ADR-911 Δ7 — άξονας από το συμφραζόμενο', () => {
  const C = '#003FFF';
  const hWall = frame('h', C, 0, 0, 2000, 100); // οριζόντιος τοίχος 100 mm, άξονας y=50
  const inLine = frame('a', C, 2500, 0, 100, 100); // τετράγωνο στην ευθεία του, κενό 500
  const lonely = frame('b', C, 20000, 20000, 100, 100); // τετράγωνο χωρίς κανέναν γείτονα
  const vWall = frame('v', C, 5000, 1000, 100, 2000); // κατακόρυφος, άξονας x=5050
  const hWall2 = frame('h2', C, 6000, 400, 2000, 100); // οριζόντιος, άξονας y=450
  const crossing = frame('c', C, 5000, 400, 100, 100); // στη διασταύρωση των δύο αξόνων

  const byKeyPrefix = (p: WallProposal, cx: number, cy: number) =>
    p.items.find((i) => i.key.startsWith(`${cx}:${cy}:`));

  it('τετράγωνο στην ευθεία τοίχου ίδιου πάχους γίνεται τοίχος με τον άξονα του γείτονα', () => {
    const p = propose({ entities: [...hWall, ...inLine] });
    const item = byKeyPrefix(p, 2550, 50);
    expect(item?.status).toBe('ready');
    expect(item?.axisFromContext).toBe(true);
    // Ο άξονας είναι οριζόντιος (του γείτονα), όχι αυθαίρετος.
    expect(item?.wall?.params.start.y).toBeCloseTo(50, 6);
    expect(item?.wall?.params.end.y).toBeCloseTo(50, 6);
  });

  it('τετράγωνο χωρίς γείτονα μένει «θέλει απόφαση»', () => {
    const p = propose({ entities: [...hWall, ...lonely] });
    const item = byKeyPrefix(p, 20050, 20050);
    expect(item?.status).toBe('needs-decision');
    expect(item?.axisFromContext).toBe(false);
  });

  it('δύο γείτονες με κάθετους άξονες αντιφάσκουν ⇒ «θέλει απόφαση», όχι μαντεψιά', () => {
    const p = propose({ entities: [...vWall, ...hWall2, ...crossing] });
    expect(byKeyPrefix(p, 5050, 450)?.status).toBe('needs-decision');
  });

  it('γείτονας πέρα από το μέγιστο κενό δεν εξηγεί το τετράγωνο', () => {
    const far = frame('far', C, 2000 + 2600, 0, 100, 100); // κενό 2600 > 2500
    const p = propose({ entities: [...hWall, ...far] });
    expect(byKeyPrefix(p, 4650, 50)?.status).toBe('needs-decision');
  });

  it('στο σχέδιο δοκιμής λύνονται 4 από τα 6 και σημαδεύονται', () => {
    const p = propose();
    expect(p.items.filter((i) => i.axisFromContext)).toHaveLength(4);
    expect(p.items.filter((i) => i.axisFromContext).every((i) => i.status === 'ready')).toBe(true);
  });
});

describe('ADR-911 Δ3 — ομάδες πάχους και τοπολογική πρόταση λειτουργίας', () => {
  const C = '#003FFF';
  // Κουτί 6000×4000 με τοίχους 200 mm που ΔΕΝ ακουμπούν (κενά 300 mm στις γωνίες), πόρτα
  // 1000 mm στον κάτω τοίχο, και ένα εσωτερικό χώρισμα 100 mm στη μέση.
  const box: Entity[] = [
    ...frame('bl', C, 0, 0, 2500, 200),
    ...frame('br', C, 3500, 0, 2500, 200),
    ...frame('top', C, 0, 3800, 6000, 200),
    ...frame('left', C, 0, 500, 200, 3000),
    ...frame('right', C, 5800, 500, 200, 3000),
    ...frame('part', C, 2950, 500, 100, 3000),
  ];

  it('οι τοίχοι του κελύφους βγαίνουν εξωτερικοί· το χώρισμα εσωτερικό — και η πόρτα δεν «μπάζει»', () => {
    const p = propose({ entities: box });
    expect(p.groups.map((g) => [g.thicknessMm, g.exteriorCount, g.interiorCount, g.suggestedCategory]))
      .toEqual([[100, 0, 1, 'interior'], [200, 5, 0, 'exterior']]);
    expect(p.groups.every((g) => !g.confirmed)).toBe(true);
  });

  it('οι τοίχοι χτίζονται με την κατηγορία της ομάδας τους, όχι όλοι «εξωτερικοί»', () => {
    const p = propose({ entities: box });
    const cats = p.walls.map((w) => `${Math.round(w.params.thickness)}:${w.params.category}`).sort();
    expect(cats).toEqual(['100:interior', '200:exterior', '200:exterior', '200:exterior', '200:exterior', '200:exterior']);
  });

  it('η επιλογή του ανθρώπου νικά την πρόταση και σημειώνεται ως επιβεβαιωμένη', () => {
    const p = propose({ entities: box, categoryByThicknessMm: new Map([[100, 'partition']]) });
    const thin = p.groups.find((g) => g.thicknessMm === 100);
    expect(thin).toMatchObject({ suggestedCategory: 'interior', category: 'partition', confirmed: true });
    expect(p.groups.find((g) => g.thicknessMm === 200)?.confirmed).toBe(false);
    expect(p.walls.find((w) => Math.round(w.params.thickness) === 100)?.params.category).toBe('partition');
  });

  it('στο σχέδιο δοκιμής: τέσσερις ομάδες, η διαφωνία της ομάδας 250 ΦΑΙΝΕΤΑΙ', () => {
    const p = propose();
    expect(p.groups.map((g) => [g.thicknessMm, g.keys.length, g.exteriorCount, g.interiorCount, g.category]))
      .toEqual([
        [50, 3, 0, 3, 'interior'],
        [100, 21, 0, 21, 'interior'],
        [200, 3, 3, 0, 'exterior'],
        [250, 13, 8, 5, 'exterior'],
      ]);
    // Κάθε ορθογώνιο ανήκει σε ακριβώς μία ομάδα.
    expect(p.groups.flatMap((g) => g.keys).sort()).toEqual(p.items.map((i) => i.key).sort());
  });
});

describe('ADR-911 Α-3 — ο τύπος μπαίνει μέσα στην πρόταση', () => {
  const mintingTyper = () => {
    let n = 0;
    return createWallTyper({
      types: getBuiltInWallTypes('co'),
      mint: (category, thicknessMm) => buildAutoWallType(`t-${(n += 1)}`, category, thicknessMm, 'co', 'u'),
    });
  };

  it('κάθε τοίχος της πρότασης φέρει ήδη τύπο και ονομαστικό πάχος', () => {
    const typer = mintingTyper();
    const p = propose({ typeWall: typer.typeWall });
    expect(p.walls).toHaveLength(38);
    expect(p.walls.every((w) => typeof w.typeId === 'string' && w.typeId.length > 0)).toBe(true);
    expect(p.walls.every((w) => Number.isInteger(w.params.thickness))).toBe(true);
    // Ένας τύπος ανά (κατηγορία, πάχος) — όχι ένας ανά τοίχο.
    const signatures = new Set(p.walls.map((w) => `${w.params.category}:${w.params.thickness}`));
    expect(new Set(p.walls.map((w) => w.typeId)).size).toBe(signatures.size);
    expect(typer.mintedFor(p.walls).length).toBeLessThanOrEqual(signatures.size);
  });

  it('ο τύπος δεν αλλάζει ΠΟΙΑ ορθογώνια γίνονται τοίχοι', () => {
    const plain = propose();
    const typed = propose({ typeWall: mintingTyper().typeWall });
    expect(typed.items.map((i) => [i.key, i.status])).toEqual(plain.items.map((i) => [i.key, i.status]));
  });
});
