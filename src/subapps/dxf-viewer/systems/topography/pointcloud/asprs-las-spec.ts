/**
 * ADR-650 M8α — ASPRS LAS specification constants (LAS 1.0 → 1.4).
 *
 * Source of truth: ASPRS «LAS Specification 1.4 – R15» (public, royalty-free). This file encodes
 * ONLY the parts of the spec the reader consumes: the public-header byte offsets, the ten Point
 * Data Record Formats, and the standard classification codes.
 *
 * ⚠️ NOT AutoCAD Layer State. `services/las-parser.ts` in this repo handles `.las` Layer State
 * files — a completely unrelated format that happens to share the extension. Nothing here is
 * shared with it, and nothing here should ever import from it.
 *
 * Data/config only — no logic (exempt from the 500-line rule).
 */

// ─── Public header block (LAS 1.2 layout; 1.4 appends, never re-orders) ───────

/** Byte offsets into the LAS public header block. Little-endian throughout. */
export const LAS_HEADER_OFFSETS = {
  SIGNATURE: 0, // char[4] — must equal 'LASF'
  VERSION_MAJOR: 24, // uint8
  VERSION_MINOR: 25, // uint8
  HEADER_SIZE: 94, // uint16
  OFFSET_TO_POINT_DATA: 96, // uint32
  POINT_DATA_FORMAT: 104, // uint8 — high bits flag LAZ compression
  POINT_DATA_RECORD_LENGTH: 105, // uint16
  LEGACY_POINT_COUNT: 107, // uint32 — LAS ≤1.3, and 1.4 when ≤ UINT32_MAX
  SCALE_X: 131, // float64 ×3
  OFFSET_X: 155, // float64 ×3
  MAX_X: 179, // float64 — spec order is max,min per axis (not min,max)
  MIN_X: 187,
  MAX_Y: 195,
  MIN_Y: 203,
  MAX_Z: 211,
  MIN_Z: 219,
  /** LAS 1.4 only — uint64 point count that supersedes the legacy uint32 when non-zero. */
  POINT_COUNT_14: 247,
} as const;

export const LAS_SIGNATURE = 'LASF';

/** LAS 1.4 grew the header; anything ≥ this is a 1.4-era file with the uint64 count. */
export const LAS_14_HEADER_SIZE = 375;

/**
 * LAZ compression is signalled by setting the two high bits of the Point Data Format byte.
 * `pdrf & 0x3f` recovers the real format; `pdrf & 0xc0` non-zero ⇒ compressed.
 */
export const LAZ_COMPRESSION_MASK = 0xc0;
export const LAS_PDRF_MASK = 0x3f;

// ─── Point Data Record Formats ────────────────────────────────────────────────

/**
 * Byte length of each PDRF's record, indexed by format id (0..10).
 *
 * Formats 0–5 are the legacy (LAS ≤1.3) family; 6–10 are the LAS 1.4 family, which widened the
 * return/classification fields. Crucially, in EVERY format the first 12 bytes are the same:
 * `int32 x, int32 y, int32 z`. Only the CLASSIFICATION byte moves — which is why the reader
 * needs just two numbers per format: the record length and the classification offset.
 */
export const LAS_RECORD_LENGTH: Readonly<Record<number, number>> = {
  0: 20,
  1: 28,
  2: 26,
  3: 34,
  4: 57,
  5: 63,
  6: 30,
  7: 36,
  8: 38,
  9: 59,
  10: 67,
} as const;

/**
 * Byte offset of the classification field within a point record, per PDRF.
 *
 * Legacy formats 0–5: classification is a single byte at offset 15, whose low 5 bits are the
 * class (the top 3 are synthetic/key-point/withheld flags) → mask with `LEGACY_CLASS_MASK`.
 * Formats 6–10: classification is a FULL byte at offset 16 (the flags moved to byte 15) → no mask.
 */
export const LAS_CLASSIFICATION_OFFSET: Readonly<Record<number, number>> = {
  0: 15,
  1: 15,
  2: 15,
  3: 15,
  4: 15,
  5: 15,
  6: 16,
  7: 16,
  8: 16,
  9: 16,
  10: 16,
} as const;

/** Legacy (PDRF 0–5) classification occupies only the low 5 bits of its byte. */
export const LEGACY_CLASS_MASK = 0x1f;

/** PDRF ≥ this uses the LAS 1.4 point layout (full classification byte, no mask). */
export const LAS_14_PDRF_MIN = 6;

/** XYZ are int32 at offsets 0/4/8 in every PDRF — the one invariant across the whole spec. */
export const LAS_XYZ_OFFSETS = { X: 0, Y: 4, Z: 8 } as const;

// ─── Classification codes (ASPRS standard, Table 17) ──────────────────────────

/**
 * The standard classes. We only ACT on `GROUND`; the rest exist so the wizard can show the
 * engineer an honest histogram («12.4M vegetation removed, 0.9M buildings removed») and so the
 * 3D preview can colour the raw cloud the way ReCap/CloudCompare do.
 */
export const ASPRS_CLASS = {
  CREATED_NEVER_CLASSIFIED: 0,
  UNCLASSIFIED: 1,
  GROUND: 2,
  LOW_VEGETATION: 3,
  MEDIUM_VEGETATION: 4,
  HIGH_VEGETATION: 5,
  BUILDING: 6,
  LOW_POINT_NOISE: 7,
  WATER: 9,
  RAIL: 10,
  ROAD_SURFACE: 11,
  WIRE_GUARD: 13,
  WIRE_CONDUCTOR: 14,
  TRANSMISSION_TOWER: 15,
  BRIDGE_DECK: 17,
  HIGH_POINT_NOISE: 18,
} as const;

/**
 * Classes 0 and 1 mean «nobody decided» — a cloud consisting only of these is UNCLASSIFIED and
 * must go through CSF. Any other class present means the vendor did the work; honour it.
 */
export const UNDECIDED_CLASSES: readonly number[] = [
  ASPRS_CLASS.CREATED_NEVER_CLASSIFIED,
  ASPRS_CLASS.UNCLASSIFIED,
];

/**
 * Display colours for the raw-cloud 3D preview, RGB 0..1, keyed by ASPRS class.
 * Deliberately the CloudCompare/ReCap convention so a surveyor reads it without a legend:
 * earth = brown, vegetation = greens (darker as it grows), buildings = grey, water = blue,
 * noise = red. Anything unlisted falls back to `PREVIEW_COLOR_FALLBACK`.
 */
export const ASPRS_CLASS_COLOR: Readonly<Record<number, readonly [number, number, number]>> = {
  [ASPRS_CLASS.GROUND]: [0.55, 0.42, 0.28],
  [ASPRS_CLASS.LOW_VEGETATION]: [0.6, 0.78, 0.4],
  [ASPRS_CLASS.MEDIUM_VEGETATION]: [0.35, 0.65, 0.3],
  [ASPRS_CLASS.HIGH_VEGETATION]: [0.16, 0.45, 0.2],
  [ASPRS_CLASS.BUILDING]: [0.72, 0.72, 0.75],
  [ASPRS_CLASS.LOW_POINT_NOISE]: [0.85, 0.2, 0.2],
  [ASPRS_CLASS.HIGH_POINT_NOISE]: [0.85, 0.2, 0.2],
  [ASPRS_CLASS.WATER]: [0.25, 0.5, 0.85],
  [ASPRS_CLASS.RAIL]: [0.5, 0.4, 0.5],
  [ASPRS_CLASS.ROAD_SURFACE]: [0.45, 0.45, 0.45],
  [ASPRS_CLASS.BRIDGE_DECK]: [0.6, 0.5, 0.4],
} as const;

export const PREVIEW_COLOR_FALLBACK: readonly [number, number, number] = [0.8, 0.8, 0.8];
