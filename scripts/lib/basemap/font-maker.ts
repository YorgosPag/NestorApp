/**
 * @fileoverview **Ο `font-maker` της MapLibre, από Node** — TTF → `.pbf` (SDF) με το **ίδιο** εργαλείο που χτίζει τις
 * γραμματοσειρές του Protomaps, χωρίς μεταγλωττιστή C++ στο PC.
 * @related ADR-891 §9.5 · `glyph-supplement.ts` · https://github.com/maplibre/font-maker (BSD-3-Clause)
 *
 * 🔑 **Το WASM του web app του, καρφωμένο σε commit του `gh-pages` + sha256.** Το `build_wasm.sh` μεταγλωττίζει το
 * `main.cpp` με emscripten και εξάγει ακριβώς τις συναρτήσεις του CLI (`create_fontstack`, `fontstack_add_face`,
 * `generate_glyph_buffer`, …). Το `worker.js` του web app τις καλεί με τη σειρά που τις καλεί και ο βρόχος εδώ.
 *
 * ⚠️ Εργαλείο **χτισίματος**: τρέχει μόνο στον γεννήτορα (`build:basemap`), δεν φτάνει ποτέ στον browser. Ό,τι
 * διανέμουμε είναι τα `.pbf` που παράγει, με την άδεια της **γραμματοσειράς** (OFL), όχι του εργαλείου.
 *
 * ⚠️ Το `sdfglyph.js` είναι script emscripten **χωρίς** `MODULARIZE`: δηλώνει καθολικό `var Module`. Τρέχει σε δικό
 * του πλαίσιο `vm`, ώστε να μη μολύνει το καθολικό αντικείμενο του γεννήτορα.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

import { loadCachedSource } from '../cached-download';

/** Commit του `gh-pages` του maplibre/font-maker (2026-07-27) — το χτισμένο WASM του web app. */
const FONT_MAKER_PAGES_COMMIT = 'bab9b243413cb17b66b158d629a4bac2d7299786';

const FONT_MAKER_FILES = {
  script: { name: 'sdfglyph.js', sha256: '2d5cce9e20511e3e1798a696b496cfb4fb9c55cd9cceaa73fd77849e1c3d7a64' },
  wasm: { name: 'sdfglyph.wasm', sha256: 'de2986e66201499de76f21bb3a649e1f27d7d68af21cb2616dc3a7b25bade691' },
} as const;

/** Όσα εύρη γράφει το `font-maker` (0–65535, ανά 256) — το ίδιο με το CLI και τη MapLibre. */
const GLYPH_RANGE_SIZE = 256;
const LAST_GLYPH_RANGE_START = 65536 - GLYPH_RANGE_SIZE;

/** Η επιφάνεια του module emscripten που χρησιμοποιούμε. */
interface FontMakerModule {
  ccall(name: string, returnType: 'number' | null, argTypes: readonly string[], args: readonly number[]): number;
  _malloc(size: number): number;
  _free(pointer: number): void;
  HEAPU8: Uint8Array;
}

interface FontMakerHost {
  wasmBinary: Buffer;
  onRuntimeInitialized?: () => void;
}

function hasFontMakerSurface(host: FontMakerHost): host is FontMakerHost & FontMakerModule {
  return (
    'ccall' in host && typeof host.ccall === 'function' &&
    '_malloc' in host && typeof host._malloc === 'function' &&
    // `isView`, όχι `instanceof Uint8Array`: το `Uint8Array` του πλαισίου `vm` είναι **άλλου realm**.
    'HEAPU8' in host && ArrayBuffer.isView(host.HEAPU8)
  );
}

async function downloadFontMaker(cacheDir: string): Promise<{ script: string; wasm: Buffer }> {
  const base = `https://raw.githubusercontent.com/maplibre/font-maker/${FONT_MAKER_PAGES_COMMIT}`;
  // Σειριακά, όχι `Promise.all`: η κονσόλα του `loadCachedSource` γράφει γραμμή προόδου ανά λήψη.
  const load = (file: { readonly name: string; readonly sha256: string }) =>
    loadCachedSource({
      url: `${base}/${file.name}`,
      path: join(cacheDir, 'font-maker', FONT_MAKER_PAGES_COMMIT.slice(0, 12), file.name),
      label: `maplibre/font-maker ${file.name}`,
      expectedSha256: file.sha256,
    });
  const script = await load(FONT_MAKER_FILES.script);
  const wasm = await load(FONT_MAKER_FILES.wasm);
  return { script: readFileSync(script.path, 'utf8'), wasm: readFileSync(wasm.path) };
}

/** Φορτώνει το WASM σε δικό του πλαίσιο και περιμένει την αρχικοποίηση του runtime. */
export async function loadFontMaker(cacheDir: string): Promise<FontMakerModule> {
  const { script, wasm } = await downloadFontMaker(cacheDir);
  const host: FontMakerHost = { wasmBinary: wasm };
  const ready = new Promise<void>((resolve) => {
    host.onRuntimeInitialized = resolve;
  });
  const sandbox = { Module: host, console, WebAssembly, TextDecoder, setTimeout, clearTimeout, performance, URL };
  runInNewContext(script, { ...sandbox, globalThis: sandbox });
  await ready;
  if (!hasFontMakerSurface(host)) throw new Error('font-maker: το WASM δεν εξήγαγε ccall/_malloc/HEAPU8');
  return host;
}

function copyGlyphBuffer(fm: FontMakerModule, stack: number, start: number): Buffer {
  const buffer = fm.ccall('generate_glyph_buffer', 'number', ['number', 'number'], [stack, start]);
  const data = fm.ccall('glyph_buffer_data', 'number', ['number'], [buffer]);
  const size = fm.ccall('glyph_buffer_size', 'number', ['number'], [buffer]);
  const copy = Buffer.from(fm.HEAPU8.slice(data, data + size));
  fm.ccall('free_glyph_buffer', null, ['number'], [buffer]);
  return copy;
}

/**
 * Όλα τα εύρη μιας στοίβας από τα faces **με τη σειρά** (ο πρώτος που έχει τον χαρακτήρα κερδίζει).
 * Κλειδί = αρχή του εύρους (`0`, `256`, …).
 */
export function renderFontstackRanges(fm: FontMakerModule, faces: readonly Buffer[]): Map<number, Buffer> {
  const stack = fm.ccall('create_fontstack', 'number', ['number'], [0]);
  const pointers = faces.map((face) => {
    const pointer = fm._malloc(face.length);
    fm.HEAPU8.set(face, pointer);
    fm.ccall('fontstack_add_face', null, ['number', 'number', 'number'], [stack, pointer, face.length]);
    return pointer;
  });
  const ranges = new Map<number, Buffer>();
  for (let start = 0; start <= LAST_GLYPH_RANGE_START; start += GLYPH_RANGE_SIZE) {
    ranges.set(start, copyGlyphBuffer(fm, stack, start));
  }
  for (const pointer of pointers) fm._free(pointer);
  fm.ccall('free_fontstack', null, ['number'], [stack]);
  return ranges;
}

/** Το όνομα αρχείου της MapLibre για ένα εύρος (`8704` → `8704-8959.pbf`). */
export function glyphRangeFileName(start: number): string {
  return `${start}-${start + GLYPH_RANGE_SIZE - 1}.pbf`;
}
