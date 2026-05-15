// Ambient declaration for opentype.js — no @types package available.
declare module 'opentype.js' {
  export function load(url: string, callback: (err: Error | null, font: Font) => void): void;
  export function loadSync(path: string): Font;
  export function parse(buffer: ArrayBuffer): Font;

  export class Font {
    glyphs: GlyphSet;
    unitsPerEm: number;
    ascender: number;
    descender: number;
    getPath(text: string, x: number, y: number, fontSize: number, options?: PathOptions): Path;
    getPaths(text: string, x: number, y: number, fontSize: number, options?: PathOptions): Path[];
    getAdvanceWidth(text: string, fontSize: number, options?: PathOptions): number;
    download(fileName?: string): void;
    charToGlyph(c: string): Glyph;
    charToGlyphIndex(c: string): number;
    nameToGlyph(name: string): Glyph;
    glyphIndexToName(gid: number): string;
    opentype: Record<string, unknown>;
  }

  export class Glyph {
    name: string;
    unicode: number;
    unicodes: number[];
    index: number;
    advanceWidth: number;
    getPath(x?: number, y?: number, fontSize?: number): Path;
    getBoundingBox(): BoundingBox;
  }

  export class GlyphSet {
    length: number;
    get(index: number): Glyph;
  }

  export class Path {
    commands: PathCommand[];
    fill: string | null;
    stroke: string | null;
    strokeWidth: number;
    draw(ctx: CanvasRenderingContext2D): void;
    toSVG(decimalPlaces?: number): string;
    getBoundingBox(): BoundingBox;
  }

  export interface BoundingBox {
    x1: number; y1: number; x2: number; y2: number;
  }

  export type PathCommand =
    | { type: 'M'; x: number; y: number }
    | { type: 'L'; x: number; y: number }
    | { type: 'Q'; x: number; y: number; x1: number; y1: number }
    | { type: 'C'; x: number; y: number; x1: number; y1: number; x2: number; y2: number }
    | { type: 'Z' };

  export interface PathOptions {
    kerning?: boolean;
    features?: Record<string, boolean>;
    hinting?: boolean;
    letterSpacing?: number;
    tracking?: number;
  }
}
