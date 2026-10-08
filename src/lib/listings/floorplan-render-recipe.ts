/**
 * @fileoverview **Η ΣΥΝΤΑΓΗ ΑΠΟΔΟΣΗΣ** της παραγόμενης κάτοψης — *«πώς βγήκε αυτή η εικόνα;»* (ADR-909 Α6).
 * @related lib/listings/floorplan-file-record (ο γραφέας) · types/file-record (`renderRecipe`)
 * @module lib/listings/floorplan-render-recipe
 *
 * Η δημόσια κάτοψη παράγεται στον **browser**· ο διακομιστής δεν την ξανασχεδιάζει. Η συνταγή
 * αποθηκεύεται δίπλα στην εγγραφή ώστε ο ισχυρισμός *«αυτό είναι το σχέδιο»* να είναι **ελέγξιμος**:
 * με το ίδιο προφίλ, το ίδιο κάδρο και τις ίδιες διαστάσεις, η εικόνα ξαναβγαίνει.
 *
 * | πεδίο | ρωτά | ποιος το χρειάζεται |
 * |---|---|---|
 * | `profileId` · `profileVersion` | με ποιον κανόνα ορατότητας; | η παλαιότητα (Β3): άλλη έκδοση προφίλ ⇒ μπαγιάτικη |
 * | `frame` | ποιο ορθογώνιο του **σχεδίου** δείχνει η εικόνα; | τα σημεία λήψης (Β4): μετατροπή παλιού κάδρου → νέου |
 * | `widthPx` · `heightPx` | πόσα pixels; | επαλήθευση πάνω στα **ίδια τα bytes** (IHDR) |
 * | `plotStyle` · `furniture` | με ποιο ύφος, με ή χωρίς επίπλωση; | αναπαραγωγή |
 *
 * 🔴 **ΖΕΙ ΣΤΟ `FileRecord`, ΟΧΙ ΣΤΑ CUSTOM METADATA ΤΟΥ ΑΝΤΙΚΕΙΜΕΝΟΥ** — σε αντίθεση με τη δήλωση του
 * μοντέλου, και είναι απόφαση. Εκείνη τη διαβάζει ο **ψήστης**, μαζί με τα bytes. Αυτήν τη διαβάζουν
 * αναγνώστες της **βάσης**: η οθόνη της παλαιότητας, και η μεταφορά των σημείων λήψης **μέσα στη
 * συναλλαγή** της διαδοχής — όπου ο κάδος δεν διαβάζεται.
 *
 * ⛔ **Καθαρό module** — καμία I/O, κανένα `Buffer`: τρέχει και στον browser της Β2.
 */

import { isPlainRecord } from '@/lib/type-guards';

/**
 * **Το ΕΝΑ προφίλ ορατότητας της δημόσιας κάτοψης**, με έκδοση.
 *
 * 🔑 Ο πίνακας «ποια κατηγορία φαίνεται» γράφεται στη Β2, **πάνω** σε αυτή τη σταθερά. Κάθε αλλαγή
 * του **οφείλει** να ανεβάσει την `version`: έτσι οι ήδη δημοσιευμένες κατόψεις σημαίνονται
 * μπαγιάτικες από τον **ίδιο** μηχανισμό παλαιότητας, χωρίς τρίτο.
 */
export const PUBLIC_FLOORPLAN_PROFILE = { id: 'public-floorplan', version: 1 } as const;

/** Το ταβάνι κάθε πλευράς της εικόνας — πάνω από το μεγαλύτερο πλάτος του ραφιού (2560), με περιθώριο. */
const FLOORPLAN_MAX_SIDE_PX = 8192;

/** Ορθογώνιο σε **συντεταγμένες σχεδίου** (μονάδες σκηνής) — ποτέ pixels, ποτέ ποσοστά. */
interface FloorplanFrame {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface FloorplanRenderRecipe {
  readonly profileId: string;
  readonly profileVersion: number;
  readonly frame: FloorplanFrame;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Το ύφος εκτύπωσης όπως το ονομάζει ο viewer — αδιαφανές εδώ· το λεξιλόγιο ανήκει σε εκείνον. */
  readonly plotStyle: string;
  readonly furniture: boolean;
}

/** Γιατί αυτό που ήρθε **δεν** είναι συνταγή — με όνομα, ώστε ο άνθρωπος να μάθει τι να διορθώσει. */
export type FloorplanRecipeRefusal = 'malformed' | 'unknown-profile' | 'stale-profile';

type FloorplanRecipeReading =
  | { readonly ok: true; readonly recipe: FloorplanRenderRecipe }
  | { readonly ok: false; readonly why: FloorplanRecipeRefusal };

const PLOT_STYLE_SHAPE = /^[a-z][a-z0-9-]{0,31}$/;

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sidePx(value: unknown): value is number {
  return finite(value) && Number.isInteger(value) && value > 0 && value <= FLOORPLAN_MAX_SIDE_PX;
}

/** Κάδρο με **θετικό** εμβαδόν — μηδενικό ή ανάποδο κάδρο δεν δείχνει τίποτα και δεν μετατρέπεται. */
function readFrame(raw: unknown): FloorplanFrame | null {
  if (!isPlainRecord(raw)) return null;
  const { minX, minY, maxX, maxY } = raw;
  if (!finite(minX) || !finite(minY) || !finite(maxX) || !finite(maxY)) return null;
  return maxX > minX && maxY > minY ? { minX, minY, maxX, maxY } : null;
}

function readShape(raw: unknown): FloorplanRenderRecipe | null {
  if (!isPlainRecord(raw)) return null;
  const frame = readFrame(raw.frame);
  const { profileId, profileVersion, widthPx, heightPx, plotStyle, furniture } = raw;

  if (frame === null || typeof profileId !== 'string' || !finite(profileVersion)) return null;
  if (!sidePx(widthPx) || !sidePx(heightPx)) return null;
  if (typeof plotStyle !== 'string' || !PLOT_STYLE_SHAPE.test(plotStyle)) return null;
  if (typeof furniture !== 'boolean') return null;

  // 🔑 Ξαναχτίζεται πεδίο προς πεδίο: ό,τι επιπλέον έστειλε ο πελάτης **δεν** αποθηκεύεται.
  return { profileId, profileVersion, frame, widthPx, heightPx, plotStyle, furniture };
}

/**
 * **Είναι αυτό συνταγή του ΤΡΕΧΟΝΤΟΣ προφίλ;**
 *
 * ⚠️ Άλλη έκδοση προφίλ ⇒ άρνηση, όχι αποδοχή: καρτέλα που έμεινε ανοιχτή με παλιό κώδικα θα
 * δημοσίευε κάτοψη που η οθόνη θα έδειχνε **αμέσως** μπαγιάτικη. Καλύτερα να το μάθει τώρα.
 */
export function readFloorplanRenderRecipe(raw: unknown): FloorplanRecipeReading {
  const recipe = readShape(raw);
  if (recipe === null) return { ok: false, why: 'malformed' };
  if (recipe.profileId !== PUBLIC_FLOORPLAN_PROFILE.id) return { ok: false, why: 'unknown-profile' };
  if (recipe.profileVersion !== PUBLIC_FLOORPLAN_PROFILE.version) return { ok: false, why: 'stale-profile' };
  return { ok: true, recipe };
}

/** Το ίδιο, από το **σύρμα** (πεδίο multipart): κείμενο JSON ή τίποτα. */
export function decodeFloorplanRenderRecipe(raw: unknown): FloorplanRecipeReading {
  if (typeof raw !== 'string' || raw.length === 0) return { ok: false, why: 'malformed' };
  try {
    return readFloorplanRenderRecipe(JSON.parse(raw) as unknown);
  } catch {
    return { ok: false, why: 'malformed' };
  }
}

// ---------------------------------------------------------------------------
// ΤΑ BYTES ΜΑΡΤΥΡΟΥΝ ΤΙΣ ΔΙΑΣΤΑΣΕΙΣ
// ---------------------------------------------------------------------------

const PNG_SIGNATURE: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** `IHDR` — το **πρώτο** τμήμα κάθε PNG, κατά το πρότυπο (W3C PNG §11.2.2). */
const IHDR_TYPE: readonly number[] = [0x49, 0x48, 0x44, 0x52];
const IHDR_TYPE_OFFSET = 12;
const IHDR_WIDTH_OFFSET = 16;
const IHDR_HEIGHT_OFFSET = 20;
const IHDR_END = 24;

/** Πόσα bytes αρκούν για να διαβαστούν οι διαστάσεις — ο καλών δεν χρειάζεται να φορτώσει όλο το αρχείο. */
export const PNG_HEADER_BYTES = IHDR_END;

function matchesAt(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

/** Ακέραιος 32 bit, big-endian — χωρίς `DataView`, ώστε να μη μετράει το `byteOffset` του πίνακα. */
function uint32At(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 + bytes[offset + 1] * 0x10000 + bytes[offset + 2] * 0x100 + bytes[offset + 3]
  );
}

/**
 * **Οι διαστάσεις που δηλώνει το ίδιο το PNG** — `null` όταν τα bytes δεν είναι PNG.
 *
 * 🔑 Διαβάζει **24 bytes**. Δεν αποκωδικοποιεί εικόνα και δεν εγγυάται ότι το υπόλοιπο αρχείο είναι
 * υγιές — αυτό το κρίνει το ράφι, που **ξανακωδικοποιεί** κάθε εικόνα πριν φύγει στο κοινό.
 */
export function pngDimensionsOf(bytes: Uint8Array): { readonly widthPx: number; readonly heightPx: number } | null {
  if (bytes.length < IHDR_END) return null;
  if (!matchesAt(bytes, 0, PNG_SIGNATURE) || !matchesAt(bytes, IHDR_TYPE_OFFSET, IHDR_TYPE)) return null;
  return { widthPx: uint32At(bytes, IHDR_WIDTH_OFFSET), heightPx: uint32At(bytes, IHDR_HEIGHT_OFFSET) };
}

/** **Λέει η συνταγή τις διαστάσεις που έχουν τα bytes;** — το ένα σκέλος της που δεν είναι σκέτος ισχυρισμός. */
export function recipeMatchesBytes(recipe: FloorplanRenderRecipe, bytes: Uint8Array): boolean {
  const measured = pngDimensionsOf(bytes);
  return measured !== null && measured.widthPx === recipe.widthPx && measured.heightPx === recipe.heightPx;
}
