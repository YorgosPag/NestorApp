/**
 * Ambient module declarations for test-only imports.
 *
 * `@jest/globals` and `vitest` resolve at runtime through pnpm but their
 * type declarations aren't visible to the dxf-viewer standalone tsconfig.
 * `three/examples/jsm/lines/*` ships .js without .d.ts in three 0.170.
 *
 * Loose typings (Function/Record<string, unknown>) are intentional — the
 * goal is to suppress TS2307 in *.test.ts files without re-implementing
 * the full Jest/Vitest type surface.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module '@jest/globals' {
  type TestFn = (name: string, fn?: (...args: any[]) => any, timeout?: number) => void;
  type HookFn = (fn: (...args: any[]) => any, timeout?: number) => void;

  export const describe: TestFn & { each: <T>(cases: T[]) => TestFn; only: TestFn; skip: TestFn };
  export const test: TestFn & { each: <T>(cases: T[]) => TestFn; only: TestFn; skip: TestFn };
  export const it: TestFn & { each: <T>(cases: T[]) => TestFn; only: TestFn; skip: TestFn };
  export const expect: any;
  export const beforeAll: HookFn;
  export const afterAll: HookFn;
  export const beforeEach: HookFn;
  export const afterEach: HookFn;
  export const jest: any;
  export const vi: any;
}

declare module 'vitest' {
  type TestFn = (name: string, fn?: (...args: any[]) => any, timeout?: number) => void;
  type HookFn = (fn: (...args: any[]) => any, timeout?: number) => void;

  export const describe: TestFn & { each: <T>(cases: T[]) => TestFn; only: TestFn; skip: TestFn };
  export const test: TestFn & { each: <T>(cases: T[]) => TestFn; only: TestFn; skip: TestFn };
  export const it: TestFn & { each: <T>(cases: T[]) => TestFn; only: TestFn; skip: TestFn };
  export const expect: any;
  export const beforeAll: HookFn;
  export const afterAll: HookFn;
  export const beforeEach: HookFn;
  export const afterEach: HookFn;
  export const vi: any;
}

declare module 'three/examples/jsm/lines/LineSegments2' {
  import { Mesh } from 'three';
  export class LineSegments2 extends Mesh {
    constructor(...args: any[]);
    material: any;
    geometry: any;
  }
}

declare module 'three/examples/jsm/lines/LineMaterial' {
  import { ShaderMaterial } from 'three';
  export class LineMaterial extends ShaderMaterial {
    constructor(parameters?: Record<string, unknown>);
    linewidth: number;
    color: any;
    resolution: { set: (w: number, h: number) => void };
    dashed: boolean;
    dispose(): void;
  }
}

declare module 'three/examples/jsm/lines/LineGeometry' {
  export class LineGeometry {
    constructor();
    setPositions(positions: number[] | Float32Array): this;
    dispose(): void;
  }
}

declare module 'three/examples/jsm/lines/LineSegmentsGeometry' {
  export class LineSegmentsGeometry {
    constructor();
    setPositions(positions: number[] | Float32Array): this;
    dispose(): void;
  }
}

export {};
