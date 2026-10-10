/**
 * ADR-911 Φ1 — άγκυρες του πυρήνα πρότασης τοίχων, πάνω στο ΠΡΑΓΜΑΤΙΚΟ σχέδιο δοκιμής.
 *
 *   Α-1  160 γραμμές ρόλου «τοίχος» → 40 ορθογώνια, 160/160 εξηγημένες.
 *   Α-2  η αναφορά κάλυψης κλείνει λογιστικά (εξηγημένες + ανεξήγητες + αγνοημένες = όλες).
 *   Α-4  ορθογώνιο χωρίς προφανή άξονα ΔΕΝ βγαίνει έτοιμο.
 *   Α-6  δεύτερη εκτέλεση στο ίδιο σχέδιο προτείνει μηδέν νέους τοίχους.
 *
 * Το fixture είναι οι γραμμές + τόξα του «Ισόγειο 1.dxf» (scene revision 11). Ο `colorOf`
 * εδώ διαβάζει το `color` που φέρει κάθε γραμμή· στην εφαρμογή τον ρόλο αυτό παίζει το
 * `resolveEntityColorHex` (το fixture δεν έχει ByLayer/ACI περιπτώσεις να ξεχωρίσει).
 */

import type { Entity } from '../../../types/entities';
import type { WallDetectionStrategy } from '../wall-detection-strategy';
import { computeWallProposal, type WallProposal, type WallProposalInput } from '../wall-proposal';
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
  it('τα 6 σχεδόν τετράγωνα δεν βγαίνουν έτοιμα και δεν φέρουν τοίχο', () => {
    const p = propose();
    expect(countByStatus(p)).toEqual({ ready: 34, 'needs-decision': 6 });
    expect(p.walls).toHaveLength(34);
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
    expect(countByStatus(propose({ acceptedKeys: new Set(keys.slice(0, 2)) })))
      .toEqual({ ready: 36, 'needs-decision': 4 });
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
    expect(countByStatus(second)).toEqual({ existing: 20, ready: 14, 'needs-decision': 6 });
  });
});
