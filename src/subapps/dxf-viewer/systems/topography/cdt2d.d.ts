/**
 * Ambient module declaration for `cdt2d` (MIT). The upstream package ships without
 * TypeScript types; we declare the surface area the TIN builder uses so it can import
 * without `any`.
 *
 * cdt2d computes a Constrained Delaunay Triangulation of a 2D point set with optional
 * constraint edges (breaklines) — the core the topography subsystem needs (ADR-650 Q6).
 *
 * Reference: https://github.com/mikolalysenko/cdt2d
 */
declare module 'cdt2d' {
  /** A 2D point as an `[x, y]` tuple (the layout cdt2d consumes). */
  export type Cdt2dPoint = readonly [number, number];
  /** A constraint edge / triangle as an index pair/triple into the point array. */
  export type Cdt2dEdge = readonly [number, number];
  export type Cdt2dTriangle = [number, number, number];

  export interface Cdt2dOptions {
    /** Delaunay-refine the triangulation by edge flipping (default `true`). */
    delaunay?: boolean;
    /** Keep triangles interior to the constraint edges (default `true`). */
    interior?: boolean;
    /** Keep triangles exterior to the constraint edges (default `true`). */
    exterior?: boolean;
    /** Include triangles touching the point at infinity (default `false`). */
    infinity?: boolean;
  }

  /**
   * Triangulate `points`, honouring the constraint `edges` (breaklines). Returns an
   * array of triangles, each `[i, j, k]` indexing into `points`.
   */
  function cdt2d(
    points: ReadonlyArray<Cdt2dPoint>,
    edges?: ReadonlyArray<Cdt2dEdge>,
    options?: Cdt2dOptions,
  ): Cdt2dTriangle[];

  export default cdt2d;
}
