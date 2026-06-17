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
  // @types/jest provides the global `jest`, `describe`, `it`, `expect`, etc.
  // We re-export them as named imports so `import { jest } from '@jest/globals'`
  // resolves to the proper @types/jest typings (incl. generic `jest.fn<R, A>()`).
  export const describe: typeof globalThis.describe;
  export const test: typeof globalThis.test;
  export const it: typeof globalThis.it;
  export const expect: typeof globalThis.expect;
  export const beforeAll: typeof globalThis.beforeAll;
  export const afterAll: typeof globalThis.afterAll;
  export const beforeEach: typeof globalThis.beforeEach;
  export const afterEach: typeof globalThis.afterEach;
  export const jest: typeof globalThis.jest;
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
  import { ShaderMaterial, Vector2 } from 'three';
  export class LineMaterial extends ShaderMaterial {
    constructor(parameters?: Record<string, unknown>);
    linewidth: number;
    color: any;
    resolution: Vector2;
    dashed: boolean;
    dashSize: number;
    gapSize: number;
    dashOffset: number;
    dashScale: number;
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

// `utif` ships with raw .js + no .d.ts. The src/types/utif.d.ts module
// declaration is invisible to this tsconfig include scope; re-declare here.
declare module 'utif' {
  export interface UtifPage {
    width: number;
    height: number;
    data?: Uint8Array;
    [key: string]: unknown;
  }
  export function decode(buffer: ArrayBuffer): UtifPage[];
  export function decodeImages(buffer: ArrayBuffer, pages: UtifPage[]): void;
  export function toRGBA8(page: UtifPage): Uint8Array;
}

// `@google-cloud/storage` ships with firebase-admin as a peer dependency.
// pnpm hoists firebase-admin but not its peers — TS standalone resolution
// can't see them. Only the `Bucket` type is imported by src/lib/firebaseAdmin.ts.
declare module '@google-cloud/storage' {
  export interface Bucket {
    name: string;
    file(path: string): unknown;
    upload(...args: unknown[]): Promise<unknown>;
    [key: string]: unknown;
  }
}
