/**
 * Τύποι κανονικών όψεων κάμερας + προβολής — SSoT.
 * Μετακόμισαν από το `dxf-viewer/bim-3d/viewport/viewport-types.ts` (ADR-920 Β6.3), ώστε ο κύβος
 * πλοήγησης να ζει στο `src/lib/three/view-cube/` και να τον μοιράζονται ο viewer και ο θεατής εδάφους
 * της αγγελίας. Το `viewport-types.ts` κάνει re-export· κανένας εισαγωγέας του viewer δεν άλλαξε.
 * Αρχική προέλευση: PORT_AS_IS από GenArc viewport.types.ts (ADR-366 §8.2 SPEC-3D-004A).
 */

export type ProjectionMode =
  | 'perspective'
  | 'top'
  | 'bottom'
  | 'front'
  | 'back'
  | 'left'
  | 'right';

/** All 12 canonical view IDs: 6 ortho face + 6 isometric. */
export type CanonicalViewId =
  | 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'
  | 'iso-ne' | 'iso-nw' | 'iso-se' | 'iso-sw' | 'iso-ue' | 'iso-uw';

/** Subset of CanonicalViewId that maps to an orthographic ProjectionMode. */
export type OrthoCanonicalViewId = Extract<CanonicalViewId,
  'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'>;

export interface CanonicalViewDef {
  readonly id: CanonicalViewId;
  /** Camera-to-target direction (unit vector). Negate for camera-from-target. */
  readonly lookDir: readonly [number, number, number];
  readonly type: 'ortho' | 'iso';
  /** Present only for ortho views; undefined for iso. */
  readonly projectionMode?: OrthoCanonicalViewId;
  /** i18n key within the bim3d namespace. */
  readonly labelKey: string;
}
