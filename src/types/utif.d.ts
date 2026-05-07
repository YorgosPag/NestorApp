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
