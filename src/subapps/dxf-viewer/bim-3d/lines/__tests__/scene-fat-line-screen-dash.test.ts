/**
 * ADR-920 Β4.8 Β2.1 — η παύλα της fat line σε pixel οθόνης.
 *
 * Η κρίσιμη άγκυρα είναι το ΠΡΑΓΜΑΤΙΚΟ shader του three (`ShaderLib.line` μέσω `LineMaterial`), όχι
 * ένα αντίγραφό του: μια αναβάθμιση που μετακινεί μια άγκυρα θα μεταγλωττιζόταν καθαρά και θα
 * ζωγράφιζε ΣΥΝΕΧΗ γραμμή — χαμένο υπόμνημα, τίποτα κόκκινο. Εδώ κοκκινίζει.
 */

import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { bimEdgeResolutionStore } from '../../edges/bim-edge-resolution-store';
import { createSceneFatLineMaterial } from '../scene-fat-line';
import { patchScreenDashShader, type LineShaderSource } from '../scene-fat-line-screen-dash';

const stockSource = (): LineShaderSource => {
  const material = new LineMaterial();
  return { vertexShader: material.vertexShader, fragmentShader: material.fragmentShader };
};

describe('patchScreenDashShader — πάνω στο πραγματικό shader του three', () => {
  it('βρίσκει ΚΑΘΕ άγκυρα (αν μια αναβάθμιση τη μετακινήσει, εδώ κοκκινίζει)', () => {
    expect(patchScreenDashShader(stockSource())).not.toBeNull();
  });

  it('vertex: η απόσταση γράφεται σε οθόνη × w, ΜΕΤΑ τα ndc και ΠΡΙΝ το gl_Position', () => {
    const { vertexShader } = patchScreenDashShader(stockSource())!;
    const write = vertexShader.indexOf('vLineDistance = sd * clip.w;');
    expect(write).toBeGreaterThan(vertexShader.indexOf('vec3 ndcEnd ='));
    expect(write).toBeLessThan(vertexShader.indexOf('gl_Position = clip;'));
    // Γράφεται ΜΕΤΑ τη stock ανάθεση (απόσταση κόσμου), άρα την υπερισχύει.
    expect(write).toBeGreaterThan(vertexShader.indexOf('dashScale * instanceDistanceStart'));
    expect(vertexShader).toContain('vScreenDashW = clip.w;');
  });

  it('fragment: διαιρεί με το w — γραμμική παρεμβολή σε ΟΘΟΝΗ, όχι σε κόσμο', () => {
    const { fragmentShader } = patchScreenDashShader(stockSource())!;
    expect(fragmentShader).toContain('mod( vLineDistance / vScreenDashW + dashOffset,');
    expect(fragmentShader).toContain('varying float vScreenDashW;');
  });

  it('λείπει άγκυρα ⇒ null, ΠΟΤΕ μισο-διορθωμένο shader', () => {
    const src = stockSource();
    expect(patchScreenDashShader({ ...src, fragmentShader: 'void main() {}' })).toBeNull();
  });

  it('διπλή άγκυρα ⇒ null (αμφίσημο σημείο επέμβασης)', () => {
    const src = stockSource();
    expect(patchScreenDashShader({ ...src, vertexShader: `${src.vertexShader}\ngl_Position = clip;` })).toBeNull();
  });
});

describe('createSceneFatLineMaterial — screenDash', () => {
  beforeEach(() => {
    bimEdgeResolutionStore.setSize(800, 600, 1);
  });

  it('dpr 2 ⇒ παύλα/κενό ×2, όπως το linewidth (ίδια μονάδα drawing buffer)', () => {
    bimEdgeResolutionStore.setSize(800, 600, 2);
    const { material, unsubscribe } = createSceneFatLineMaterial({
      widthPx: 3, color: 0xffffff, screenDash: { dashPx: 8, gapPx: 4 },
    });
    expect(material.dashed).toBe(true);
    expect(material.dashSize).toBe(16);
    expect(material.gapSize).toBe(8);
    expect(material.linewidth).toBe(6);
    unsubscribe();
  });

  it('ακολουθεί αλλαγή pixel ratio μετά την κατασκευή', () => {
    const { material, unsubscribe } = createSceneFatLineMaterial({
      widthPx: 3, color: 0xffffff, screenDash: { dashPx: 8, gapPx: 4 },
    });
    bimEdgeResolutionStore.setSize(800, 600, 3);
    expect(material.dashSize).toBe(24);
    expect(material.gapSize).toBe(12);
    unsubscribe();
  });

  it('δηλώνει δικό του program cache key και διορθώνει το shader στη μεταγλώττιση', () => {
    const { material, unsubscribe } = createSceneFatLineMaterial({
      widthPx: 3, color: 0xffffff, screenDash: { dashPx: 0, gapPx: 4 },
    });
    expect(material.customProgramCacheKey()).toBe('scene-fat-line-screen-dash');
    const shader = { ...stockSource(), uniforms: {} } as unknown as Parameters<LineMaterial['onBeforeCompile']>[0];
    material.onBeforeCompile(shader, undefined as unknown as Parameters<LineMaterial['onBeforeCompile']>[1]);
    expect(shader.fragmentShader).toContain('vLineDistance / vScreenDashW');
    unsubscribe();
  });

  it('χωρίς screenDash: stock υλικό, καμία επέμβαση', () => {
    const { material, unsubscribe } = createSceneFatLineMaterial({ widthPx: 3, color: 0xffffff });
    expect(material.dashed).toBe(false);
    expect(material.customProgramCacheKey()).not.toBe('scene-fat-line-screen-dash');
    unsubscribe();
  });

  it('dash (κόσμου) ΚΑΙ screenDash μαζί ⇒ σφάλμα, όχι σιωπηλή προτεραιότητα', () => {
    expect(() => createSceneFatLineMaterial({
      widthPx: 3, color: 0xffffff, dash: { dashSize: 1, gapSize: 1 }, screenDash: { dashPx: 8, gapPx: 4 },
    })).toThrow(/mutually exclusive/);
  });
});
