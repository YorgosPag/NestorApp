export type PixelmatchFn = (
  img1: Uint8Array,
  img2: Uint8Array,
  output: Uint8Array | null,
  width: number,
  height: number,
  options?: { threshold?: number; includeAA?: boolean; alpha?: number }
) => number;

export interface PNGInstance {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface PNGModule {
  sync: {
    read: (data: Buffer) => PNGInstance;
    write: (png: PNGInstance) => Buffer;
  };
}

export type PNGConstructor = new (options: { width: number; height: number }) => PNGInstance;
export type PNGCombined = PNGConstructor & PNGModule;
