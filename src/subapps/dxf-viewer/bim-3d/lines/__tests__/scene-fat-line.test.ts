/**
 * ADR-650 M8β/Γ v2 — το συμβόλαιο ΜΟΝΑΔΩΝ της fat line.
 *
 * Ο vertex shader του `LineMaterial` κάνει `offset *= linewidth; offset /= resolution.y`. Άρα το
 * `linewidth` ΔΕΝ είναι «pixels»: είναι «στη μονάδα που είναι και το resolution». Αν κλιμακωθεί το
 * ένα και όχι το άλλο, η γραμμή βγαίνει `dpr×` λάθος — και σε οθόνη με dpr 1 (όπου γράφεται και
 * ρυθμίζεται ο κώδικας) φαίνεται τέλεια. Είναι σφάλμα που ΔΕΝ το πιάνει κανένας compiler και δεν
 * το βλέπει κανείς μέχρι να αλλάξει οθόνη — γι' αυτό είναι καρφωμένο εδώ σε αριθμούς.
 */

import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { bimEdgeResolutionStore } from '../../edges/bim-edge-resolution-store';
import { createFatLineMesh, createSceneFatLineMaterial } from '../scene-fat-line';

describe('createSceneFatLineMaterial — μονάδες', () => {
  beforeEach(() => {
    bimEdgeResolutionStore.setSize(800, 600, 1);
  });

  it('dpr 1 → resolution = CSS, linewidth = τα px που ζητήθηκαν', () => {
    const { material, unsubscribe } = createSceneFatLineMaterial({ widthPx: 5, color: 0xffffff });
    expect(material.resolution.x).toBe(800);
    expect(material.resolution.y).toBe(600);
    expect(material.linewidth).toBe(5);
    unsubscribe();
  });

  it('dpr 2 → ΚΑΙ ΤΑ ΔΥΟ ×2, ώστε το πάχος στην οθόνη να μείνει 5 CSS px', () => {
    bimEdgeResolutionStore.setSize(800, 600, 2);
    const { material, unsubscribe } = createSceneFatLineMaterial({ widthPx: 5, color: 0xffffff });
    expect(material.resolution.x).toBe(1600);
    expect(material.resolution.y).toBe(1200);
    expect(material.linewidth).toBe(10);
    // Ο λόγος είναι το μόνο που βλέπει ο shader — και μένει ίδιος με το dpr 1.
    expect(material.linewidth / material.resolution.y).toBeCloseTo(5 / 600, 12);
    unsubscribe();
  });

  it('ακολουθεί ΚΑΙ resize ΚΑΙ αλλαγή pixel ratio μετά την κατασκευή', () => {
    const { material, unsubscribe } = createSceneFatLineMaterial({ widthPx: 3, color: 0x000000 });
    bimEdgeResolutionStore.setSize(1920, 1080, 1);
    expect(material.resolution.x).toBe(1920);
    expect(material.linewidth).toBe(3);
    // Μετακίνηση παραθύρου σε οθόνη άλλης κλίμακας: το CSS μέγεθος δεν άλλαξε, μόνο ο λόγος.
    bimEdgeResolutionStore.setSize(1920, 1080, 2);
    expect(material.resolution.y).toBe(2160);
    expect(material.linewidth).toBe(6);
    unsubscribe();
  });

  it('unsubscribe → το υλικό παγώνει (καμία διαρροή σε αποσυναρμολογημένη σκηνή)', () => {
    const { material, unsubscribe } = createSceneFatLineMaterial({ widthPx: 2, color: 0x000000 });
    unsubscribe();
    bimEdgeResolutionStore.setSize(1024, 768, 1);
    expect(material.resolution.x).toBe(800);
  });

  it('το καρφωμένο devicePixelRatio υπερισχύει ΚΑΙ ΣΤΑ ΔΥΟ — δεν καρφώνεται μόνο το μισό', () => {
    bimEdgeResolutionStore.setSize(800, 600, 2);
    const { material, unsubscribe } = createSceneFatLineMaterial({
      widthPx: 4, color: 0xffffff, devicePixelRatio: 1,
    });
    expect(material.resolution.x).toBe(800);
    expect(material.linewidth).toBe(4);
    unsubscribe();
  });
});

describe('createSceneFatLineMaterial — πολιτική overlay', () => {
  it('πάντα alphaToCoverage + καθόλου εγγραφή βάθους', () => {
    const { material, unsubscribe } = createSceneFatLineMaterial({ widthPx: 1, color: 0x123456 });
    expect(material.alphaToCoverage).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.transparent).toBe(false); // η διαφάνεια περνά από coverage, όχι από blending
    unsubscribe();
  });

  it('η άλως ζητά opacity χωρίς transparent — αλλιώς κάθε κορυφή θα «χάντρωνε» διπλό blend', () => {
    const { material, unsubscribe } = createSceneFatLineMaterial({
      widthPx: 10, color: 0xffffff, opacity: 0.55, depthTest: false,
    });
    expect(material.opacity).toBeCloseTo(0.55, 6);
    expect(material.transparent).toBe(false);
    expect(material.depthTest).toBe(false);
    unsubscribe();
  });

  it('dash / polygonOffset μπαίνουν μόνο όταν ζητηθούν', () => {
    const plain = createSceneFatLineMaterial({ widthPx: 1, color: 0 });
    expect(plain.material.dashed).toBe(false);
    expect(plain.material.polygonOffset).toBe(false);
    plain.unsubscribe();

    const dashed = createSceneFatLineMaterial({
      widthPx: 1, color: 0, dash: { dashSize: 0.08, gapSize: 0.04 },
      polygonOffset: { factor: -2, units: -4 },
    });
    expect(dashed.material.dashed).toBe(true);
    expect(dashed.material.dashSize).toBeCloseTo(0.08, 6);
    expect(dashed.material.polygonOffsetFactor).toBe(-2);
    dashed.unsubscribe();
  });
});

describe('createFatLineMesh', () => {
  it('δέχεται το ΩΜΟ buffer τμημάτων και βγάζει LineSegments2 με σωστό πλήθος στιγμιοτύπων', () => {
    const { material, unsubscribe } = createSceneFatLineMaterial({ widthPx: 1, color: 0 });
    const mesh = createFatLineMesh(new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0]), material);
    expect(mesh).toBeInstanceOf(LineSegments2);
    expect(mesh.material).toBeInstanceOf(LineMaterial);
    expect(mesh.geometry.getAttribute('instanceStart').count).toBe(2); // δύο τμήματα
    unsubscribe();
  });
});
