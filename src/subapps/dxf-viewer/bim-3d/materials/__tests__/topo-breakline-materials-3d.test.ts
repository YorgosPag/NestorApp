/**
 * ADR-920 Β4.8 Β2.2 — τα υλικά 3Δ των ΔΕΣΜΕΥΜΕΝΩΝ ασυνεχειών + τα δύο κοινά εργοστάσια.
 *
 * Η άγκυρα κοιτάζει τον ΚΑΤΑΝΑΛΩΤΗ του λεξιλογίου: ό,τι λέει το `topo-breakline-style` (πάχη, μοτίβα,
 * κουκκίδα) πρέπει να φτάνει αυτούσιο στο υλικό, αλλιώς η κάτοψη και το μοντέλο λένε άλλη πρόταση.
 */

import * as THREE from 'three';
import { bimEdgeResolutionStore } from '../../edges/bim-edge-resolution-store';
import { UI_COLORS } from '../../../config/color-config';
import {
  breaklineDashPattern,
  breaklineFlatCapDash,
  TOPO_BREAKLINE_STROKE_PX,
  TOPO_BREAKLINE_VERTEX_DOT_PX,
  TOPO_BREAKLINE_VERTEX_OUTLINE_PX,
} from '../../../systems/topography/topo-breakline-style';
import { COPLANAR_LINE_POLYGON_OFFSET } from '../../lines/scene-fat-line';
import { createFatLineMaterialCatalog } from '../fat-line-material-catalog';
import { createScreenDotMaterial } from '../screen-dot-material';
import {
  disposeTopoBreaklineMaterials3D,
  getTopoBreaklineCasingMaterial3D,
  getTopoBreaklineCoreMaterial3D,
  getTopoBreaklineVertexMaterial3D,
  topoBreaklinePatternKey,
} from '../topo-breakline-materials-3d';

const hex = (css: string): number => new THREE.Color(css).getHex();

beforeEach(() => {
  bimEdgeResolutionStore.setSize(800, 600, 1);
  disposeTopoBreaklineMaterials3D();
});

describe('breaklineFlatCapDash — επίπεδα άκρα (3Δ)', () => {
  const W = TOPO_BREAKLINE_STROKE_PX.stroke;

  it('διακεκομμένη: ακριβώς το δηλωμένο ορατό μοτίβο (τα επίπεδα άκρα δεν προσθέτουν)', () => {
    expect(breaklineFlatCapDash(breaklineDashPattern('proximity'), W)).toEqual(breaklineDashPattern('proximity'));
  });

  it('κουκκίδα: ποτέ κοντύτερη από το πάχος — τετράγωνο όσο η γραμμή', () => {
    expect(breaklineFlatCapDash(breaklineDashPattern('surface'), W)).toEqual({ dashPx: W, gapPx: 4 });
  });

  it('συνεχής ⇒ null', () => {
    expect(breaklineFlatCapDash(null, W)).toBeNull();
  });
});

describe('topo-breakline-materials-3d — το λεξιλόγιο φτάνει αυτούσιο', () => {
  it('casing: σκούρο, συνεχές, πάχος casing, δοκιμάζει βάθος με coplanar offset', () => {
    const m = getTopoBreaklineCasingMaterial3D();
    expect(m.color.getHex()).toBe(hex(UI_COLORS.TOPO_BREAKLINE_CASING));
    expect(m.linewidth).toBe(TOPO_BREAKLINE_STROKE_PX.casing);
    expect(m.dashed).toBe(false);
    expect(m.depthTest).toBe(true);
    expect(m.polygonOffsetFactor).toBe(COPLANAR_LINE_POLYGON_OFFSET.factor);
    expect(m.polygonOffsetUnits).toBe(COPLANAR_LINE_POLYGON_OFFSET.units);
  });

  it('core ανά πηγή: elevation/άγνωστη συνεχής · proximity/surface παύλα σε px οθόνης', () => {
    const solid = getTopoBreaklineCoreMaterial3D(breaklineDashPattern('elevation'));
    const dashed = getTopoBreaklineCoreMaterial3D(breaklineDashPattern('proximity'));
    const dotted = getTopoBreaklineCoreMaterial3D(breaklineDashPattern('surface'));
    expect(solid.dashed).toBe(false);
    expect(solid.color.getHex()).toBe(hex(UI_COLORS.TOPO_BREAKLINE));
    expect([dashed.dashSize, dashed.gapSize]).toEqual([8, 4]);
    expect([dotted.dashSize, dotted.gapSize]).toEqual([TOPO_BREAKLINE_STROKE_PX.stroke, 4]);
    expect(dashed.customProgramCacheKey()).toBe('scene-fat-line-screen-dash');
  });

  it('ένα υλικό ανά μοτίβο: ίδιο μοτίβο ⇒ ίδιο αντικείμενο, άλλο μοτίβο ⇒ άλλο', () => {
    const a = getTopoBreaklineCoreMaterial3D(breaklineDashPattern('proximity'));
    expect(getTopoBreaklineCoreMaterial3D({ dashPx: 8, gapPx: 4 })).toBe(a);
    expect(getTopoBreaklineCoreMaterial3D(null)).not.toBe(a);
    expect(topoBreaklinePatternKey(null)).toBe('solid');
  });

  it('κουκκίδες: γέμισμα = διάμετρος 2Δ · περίγραμμα = + δαχτυλίδι και από τις δύο πλευρές', () => {
    bimEdgeResolutionStore.setSize(800, 600, 2);
    const fill = getTopoBreaklineVertexMaterial3D('fill');
    const outline = getTopoBreaklineVertexMaterial3D('outline');
    expect(fill.size).toBe(TOPO_BREAKLINE_VERTEX_DOT_PX * 2);
    expect(outline.size).toBe((TOPO_BREAKLINE_VERTEX_DOT_PX + 2 * TOPO_BREAKLINE_VERTEX_OUTLINE_PX) * 2);
    expect(fill.color.getHex()).toBe(hex(UI_COLORS.TOPO_BREAKLINE));
    expect(outline.color.getHex()).toBe(hex(UI_COLORS.TOPO_BREAKLINE_CASING));
    expect(fill.depthTest).toBe(false);
  });
});

describe('createFatLineMaterialCatalog — κλειδί, συνδρομή, αποδέσμευση', () => {
  it('ίδιο κλειδί ⇒ ίδιο υλικό· dispose ⇒ σταματά να ακολουθεί το viewport', () => {
    const catalog = createFatLineMaterialCatalog();
    const a = catalog.get('k', { widthPx: 2, color: 0xffffff });
    expect(catalog.get('k', { widthPx: 9, color: 0x000000 })).toBe(a);
    catalog.dispose();
    bimEdgeResolutionStore.setSize(800, 600, 3);
    expect(a.linewidth).toBe(2); // καμία διαρροή συνδρομής μετά το dispose
    expect(catalog.get('k', { widthPx: 2, color: 0xffffff })).not.toBe(a);
    catalog.dispose();
  });
});

describe('createScreenDotMaterial — σταθερό μέγεθος οθόνης, HiDPI', () => {
  it('ακολουθεί το pixel ratio μέχρι το unsubscribe', () => {
    const { material, unsubscribe } = createScreenDotMaterial({ color: '#ffffff', diameterPx: 8 });
    expect(material.sizeAttenuation).toBe(false);
    expect(material.depthTest).toBe(true);
    bimEdgeResolutionStore.setSize(800, 600, 2);
    expect(material.size).toBe(16);
    unsubscribe();
    bimEdgeResolutionStore.setSize(800, 600, 3);
    expect(material.size).toBe(16);
  });
});
