/**
 * ADR-909 Γ2.9 — flat RENDER-FIELD contract για τα τρία σκέτα πρωτογενή που **δεν είχαν δρόμο προς τον καμβά**:
 * `ellipse` · `spline` · `point` (**anti-drift SSoT**· αδελφός των `hatch` / `text` / `image` / `table`-render-fields).
 *
 * Η **ΜΙΑ** λίστα πεδίων ανά τύπο. Τη ζητούν **και οι τρεις** προβολές, καμία δεν απαριθμεί μόνη της:
 *   - `hooks/canvas/dxf-scene-entity-flat-handlers.ts` — στοιχείο σκηνής → `DxfEllipse` / `DxfSpline` / `DxfPoint`.
 *   - `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts` — `Dxf…` → `EntityModel` του ζωγράφου.
 *   - `services/hit-test-model-dxf.ts` — `Dxf…` → `EntityModel` του χωρικού ευρετηρίου (hover / κλικ).
 * Και ο ίδιος ο τύπος `Dxf…` (`dxf-types.ts`) είναι `Pick` πάνω σε αυτήν — τέταρτο αντίγραφο δεν υπάρχει.
 *
 * ## 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (μετρημένο 2026-10-13, πύλη pixels 3.101 — `K0:ellipse` · `K0:point` · `K0:spline`)
 *
 * Οι τρεις τύποι είχαν ζωγράφο (`EllipseRenderer` / `SplineRenderer` / `PointRenderer`), όρια (`Bounds.ts`) και
 * κανόνα στο προφίλ της δημόσιας κάτοψης — αλλά **καμία** γραμμή στο `TO_DXF_HANDLERS` και **κανένα** σχήμα στο
 * `DxfEntityUnion`. Ο μετατροπέας τούς γύριζε `null` ⇒ δεν ζωγραφίζονταν **πουθενά**: ούτε στον καμβά του
 * σχεδιαστή, ούτε στη δημόσια κάτοψη. Τρία coverage tests το είχαν καρφώσει ως «νόμιμη απουσία, raw-DXF path» —
 * δρόμος που δεν υπάρχει προς τον κύριο καμβά.
 *
 * Import-time pure: μηδέν React / DOM / THREE / Firestore εξαρτήσεις.
 *
 * @module bim/primitives/primitive-render-fields
 * @see bim/image/image-render-fields.ts — το ίδιο ιδίωμα, με το ιστορικό της κλάσης (οκτώ περιστατικά)
 */

import type { EllipseEntity, PointEntity, SplineEntity } from '../../types/entities';

/**
 * Τα πεδία που κουβαλούν **γεωμετρία ή όψη** του κάθε τύπου. Υποχρεωτικά: `center` / `majorAxis` / `minorAxis` ·
 * `controlPoints` · `position`. Τα υπόλοιπα optional — αντιγράφονται μόνο όταν έχουν τιμή.
 *
 * 🚫 **Εκτός λίστας ΕΠΙΤΗΔΕΣ**: `strokeWidth` (έλλειψη) και `tolerance` (spline). Το πάχος γραμμής το λύνει ο
 * `resolveStyleForRender` από το κοινό `base`· η ανοχή προσαρμογής είναι δεδομένο εισαγωγής, όχι όψη. Αν κάποτε
 * **γίνουν** όψη, προστίθενται **εδώ** — όχι σε μία μόνο προβολή.
 */
export const PRIMITIVE_RENDER_FIELDS = {
  ellipse: ['center', 'majorAxis', 'minorAxis', 'rotation', 'startParam', 'endParam'],
  spline: ['controlPoints', 'degree', 'knots', 'weights', 'closed', 'rational'],
  point: ['position', 'size', 'style', 'pdMode', 'pdSize'],
} as const satisfies {
  readonly ellipse: readonly (keyof EllipseEntity)[];
  readonly spline: readonly (keyof SplineEntity)[];
  readonly point: readonly (keyof PointEntity)[];
};

/**
 * Τα πεδία χωρίς τα οποία το στοιχείο **δεν έχει γεωμετρία**. Ο μετατροπέας σκηνής αρνείται (`null` + προειδοποίηση)
 * στοιχείο που του λείπει έστω ένα — ποτέ μισό σχήμα στον ζωγράφο (persistence / εισαγωγή / clipboard δεν εγγυώνται
 * ό,τι υπόσχεται ο τύπος, ADR-746).
 */
export const PRIMITIVE_REQUIRED_FIELDS = {
  ellipse: ['center', 'majorAxis', 'minorAxis'],
  spline: ['controlPoints'],
  point: ['position'],
} as const satisfies { readonly [T in keyof typeof PRIMITIVE_RENDER_FIELDS]: readonly (typeof PRIMITIVE_RENDER_FIELDS)[T][number][] };

/** Οι τύποι που καλύπτει αυτό το συμβόλαιο. */
export type PrimitiveRenderType = keyof typeof PRIMITIVE_RENDER_FIELDS;

/** Ακριβώς τα πεδία της λίστας, με τους τύπους του στοιχείου σκηνής — ένα `Pick` ανά τύπο, κανένα γραμμένο με το χέρι. */
interface PrimitiveRenderFieldsMap {
  readonly ellipse: Pick<EllipseEntity, (typeof PRIMITIVE_RENDER_FIELDS)['ellipse'][number]>;
  readonly spline: Pick<SplineEntity, (typeof PRIMITIVE_RENDER_FIELDS)['spline'][number]>;
  readonly point: Pick<PointEntity, (typeof PRIMITIVE_RENDER_FIELDS)['point'][number]>;
}

/** Η πηγή των `DxfEllipse` / `DxfSpline` / `DxfPoint`. */
export type PrimitiveRenderFieldsOf<T extends PrimitiveRenderType> = PrimitiveRenderFieldsMap[T];

/**
 * Αντιγράφει ακριβώς τα {@link PRIMITIVE_RENDER_FIELDS} του τύπου που **έχουν τιμή**. Τα απόντα optionals
 * παραλείπονται (ποτέ κλειδί με `undefined`). Η πηγή είναι οτιδήποτε κουβαλά αυτά τα πεδία: στοιχείο σκηνής
 * ή το ήδη επίπεδο `Dxf…`.
 */
export function pickPrimitiveRenderFields<T extends PrimitiveRenderType>(
  type: T,
  source: object,
): Partial<PrimitiveRenderFieldsOf<T>> {
  const wanted: readonly string[] = PRIMITIVE_RENDER_FIELDS[type];
  const out: Record<string, unknown> = {};
  for (const field of wanted) {
    const value = (source as Record<string, unknown>)[field];
    if (value !== undefined) out[field] = value;
  }
  return out as unknown as Partial<PrimitiveRenderFieldsOf<T>>;
}

/** Το πρώτο υποχρεωτικό πεδίο που **λείπει** από ό,τι μάζεψε το {@link pickPrimitiveRenderFields} — `undefined` = πλήρες. */
export function missingPrimitiveField(type: PrimitiveRenderType, picked: object): string | undefined {
  const required: readonly string[] = PRIMITIVE_REQUIRED_FIELDS[type];
  return required.find((field) => !(field in picked));
}
