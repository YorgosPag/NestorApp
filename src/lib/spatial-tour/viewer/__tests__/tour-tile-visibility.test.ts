/**
 * Άγκυρες της ροής πλακιδίων (ADR-884 Φ2ε · §4.11): επίπεδο κατά πυκνότητα · μόνο τα ορατά · κέντρο πρώτο · στενό ζουμ
 * μέσα σε ένα μεγάλο πλακίδιο · ό,τι είναι πίσω δεν ζητείται · ίδια σύμβαση γραμμής/στήλης με τον ψήστη.
 */

import { tilesetLevels, tileUvRect } from '../../tileset/tour-tileset-layout';
import { cubeFaceUvToDirection, directionToCubeFace } from '../tour-cube-faces';
import { chooseTileLevel, tileQuad, visibleTiles, type TourTileFrame } from '../tour-tile-visibility';

const deg = (d: number) => (d * Math.PI) / 180;
const frame = (yaw: number, pitch: number, fov: number, aspect = 16 / 9): TourTileFrame => ({ view: { yaw: deg(yaw), pitch: deg(pitch), fov: deg(fov) }, aspect });
const LEVELS_2560 = tilesetLevels(2560); // [512, 1024, 2048, 2560]

describe('tileUvRect — γραμμή 0 = πάνω (v = 1), όπως ο ψήστης', () => {
  it('πρώτο πλακίδιο επιπέδου 1024 = πάνω-αριστερό τεταρτημόριο', () => {
    expect(tileUvRect(1024, 0, 0)).toEqual({ u0: 0, u1: 0.5, v0: 0.5, v1: 1 });
    expect(tileUvRect(1024, 1, 1)).toEqual({ u0: 0.5, u1: 1, v0: 0, v1: 0.5 });
  });

  it('το κέντρο κάθε πλακιδίου γυρίζει στο ΙΔΙΟ πλακίδιο μέσω της σύμβασης όψεων', () => {
    const size = 2048;
    for (const [row, col] of [[0, 0], [0, 3], [2, 1], [3, 3]] as const) {
      const r = tileUvRect(size, row, col);
      const back = directionToCubeFace(cubeFaceUvToDirection('right', (r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2));
      expect([back.face, Math.floor((1 - back.v) * 4), Math.floor(back.u * 4)]).toEqual(['right', row, col]);
    }
  });
});

describe('tileQuad — το πλακίδιο πέφτει ΕΚΕΙ που κόπηκε', () => {
  it('η πάνω-αριστερή κορυφή (uv 0,1) είναι η (u0, v1) του πλακιδίου στην ίδια όψη', () => {
    const quad = tileQuad({ level: 2, face: 'left', row: 1, col: 2 }, 2048);
    const [x, y, z] = quad.positions.slice(0, 3);
    const back = directionToCubeFace({ x, y, z });
    const r = tileUvRect(2048, 1, 2);
    expect(back.face).toBe('left');
    expect(back.u).toBeCloseTo(r.u0, 9);
    expect(back.v).toBeCloseTo(r.v1, 9);
    expect(quad.uvs.slice(0, 2)).toEqual([0, 1]);
  });

  it('η κάτω-δεξιά κορυφή (uv 1,0) είναι η (u1, v0) — εδώ το κέντρο της όψης, όχι γωνία του κύβου (αμφίσημη)', () => {
    const quad = tileQuad({ level: 1, face: 'up', row: 0, col: 0 }, 1024);
    const [x, y, z] = quad.positions.slice(9, 12);
    const back = directionToCubeFace({ x, y, z });
    expect([back.face, back.u, back.v]).toEqual(['up', 0.5, 0.5]);
    expect(quad.uvs.slice(6, 8)).toEqual([1, 0]);
  });
});

describe('chooseTileLevel — ένα εικονοστοιχείο εικόνας ≈ ένα της οθόνης', () => {
  it('καμβάς 700px, πεδίο 65° ⇒ 2048 (χρειάζεται ~1099 > 1024)', () => {
    expect(LEVELS_2560[chooseTileLevel(LEVELS_2560, 700, deg(65))]).toBe(2048);
  });
  it('μικρός καμβάς, ευρύ πεδίο ⇒ το μικρότερο επίπεδο', () => {
    expect(chooseTileLevel(LEVELS_2560, 400, deg(90))).toBe(0);
  });
  it('ζουμ (30°) σε μεγάλη οθόνη ⇒ το ανώτερο (2560), ποτέ έξω από τα όρια', () => {
    expect(chooseTileLevel(LEVELS_2560, 2000, deg(30))).toBe(3);
  });
});

describe('visibleTiles — μόνο ό,τι φαίνεται, από το κέντρο προς τα έξω', () => {
  it('κοιτάζοντας μπροστά: πρώτο το front, ΚΑΝΕΝΑ πλακίδιο back (ούτε στο περιθώριο)', () => {
    const needs = visibleTiles(frame(0, 0, 65), 512, 0);
    expect(needs[0].face).toBe('front');
    expect(needs.some((n) => n.face === 'back')).toBe(false);
  });

  it('στροφή 90° δεξιά ⇒ πρώτο το right', () => {
    expect(visibleTiles(frame(90, 0, 65), 512, 0)[0].face).toBe('right');
  });

  it('το πρώτο πλακίδιο στο 2048 είναι αυτό που περιέχει το κέντρο θέασης', () => {
    const first = visibleTiles(frame(10, 5, 65), 2048, 2)[0];
    const d = directionToCubeFace({ x: Math.sin(deg(10)) * Math.cos(deg(5)), y: Math.sin(deg(5)), z: -Math.cos(deg(10)) * Math.cos(deg(5)) });
    expect([first.face, first.row, first.col]).toEqual([d.face, Math.floor((1 - d.v) * 4), Math.floor(d.u * 4)]);
  });

  it('στενό ζουμ ΜΕΣΑ σε ένα μεγάλο πλακίδιο (κανένα δείγμα του στο κάδρο) ⇒ ζητείται', () => {
    const needs = visibleTiles(frame(20, 20, 30, 1), 512, 0, 0);
    expect(needs.map((n) => n.face)).toEqual(['front']);
  });

  it('ένα σημείο στο ανώτερο επίπεδο κοστίζει κλάσμα των 150 πλακιδίων', () => {
    const needs = visibleTiles(frame(0, 0, 65), 2560, 3);
    const visible = needs.filter((n) => n.priority < Math.PI);
    // 16:9 με 65° κατακόρυφα ⇒ ~98° οριζόντια: όλο το front (5×5) + μία στήλη από left και right (5 + 5).
    expect(visible).toHaveLength(35);
    expect(visible.filter((n) => n.face === 'front')).toHaveLength(25);
    expect(needs.length).toBeLessThan(75);
  });

  it('το περιθώριο έρχεται ΜΕΤΑ από κάθε ορατό', () => {
    const needs = visibleTiles(frame(0, 0, 65), 2048, 2);
    const firstMargin = needs.findIndex((n) => n.priority >= Math.PI);
    expect(firstMargin).toBeGreaterThan(0);
    expect(needs.slice(firstMargin).every((n) => n.priority >= Math.PI)).toBe(true);
  });
});
