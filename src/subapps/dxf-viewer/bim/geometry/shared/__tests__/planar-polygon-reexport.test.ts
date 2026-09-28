/**
 * ADR-884 Φ2στ-γ Γ3 — ΕΝΑ σπίτι: το dxf-viewer επανεξάγει τον επίπεδο πυρήνα του `@/lib/geometry/planar-polygon`.
 * Ζει ΜΕΣΑ στο subapp: η εισαγωγή πηγαίνει προς τα μέσα (subapp → lib), ποτέ lib → subapp (CHECK 3.62).
 */

import {
  isPolygonSelfIntersecting, pointInPolygon, polygonArea, segmentsIntersect, shoelaceArea,
} from '@/lib/geometry/planar-polygon';
import * as dxfPolygonUtils from '../polygon-utils';
import * as dxfGeometryUtils from '../../../../utils/geometry/GeometryUtils';

describe('planar-polygon — επανεξαγωγή στο dxf-viewer', () => {
  it('ΕΝΑ σπίτι: το dxf-viewer επανεξάγει τις ΙΔΙΕΣ συναρτήσεις, όχι αντίγραφα', () => {
    expect(dxfPolygonUtils.shoelaceArea).toBe(shoelaceArea);
    expect(dxfPolygonUtils.polygonArea).toBe(polygonArea);
    expect(dxfPolygonUtils.pointInPolygon).toBe(pointInPolygon);
    expect(dxfPolygonUtils.isPolygonSelfIntersecting).toBe(isPolygonSelfIntersecting);
    expect(dxfGeometryUtils.segmentsIntersect).toBe(segmentsIntersect);
  });
});
