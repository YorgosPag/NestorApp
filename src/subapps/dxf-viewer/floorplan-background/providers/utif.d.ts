declare module 'utif' {
  interface UtifPage {
    width: number;
    height: number;
    data?: Uint8Array;
    [key: string]: unknown;
  }

  function decode(buffer: ArrayBuffer): UtifPage[];
  function decodeImages(buffer: ArrayBuffer, pages: UtifPage[]): void;
  function toRGBA8(page: UtifPage): Uint8Array;
}
