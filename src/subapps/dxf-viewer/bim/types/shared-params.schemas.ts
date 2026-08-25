/**
 * BIM params **field vocabularies** — τα επαναλαμβανόμενα ζεύγη πεδίων, γραμμένα ΜΙΑ φορά.
 *
 * 🔴 **Γιατί υπάρχει**: τα ~20 `*.schemas.ts` του `bim/types` επαναλάμβαναν **έξι** ομάδες
 * πεδίων αυτούσιες — μετρημένο από το CHECK 3.28 (jscpd, token-based): **19 κλώνοι** μέσα
 * στο ίδιο commit, σε 11 αρχεία. Καμία πύλη δεν τα συνέκρινε ονομαστικά, άρα προσθήκη
 * πεδίου στο ένα άφηνε τα υπόλοιπα να αποκλίνουν **σιωπηλά** — το σχήμα του ADR-749.
 *
 * 🔑 **ΓΙΑΤΙ ΣΧΗΜΑΤΑ (shape objects) ΚΑΙ ΟΧΙ `z.object(...)` ΓΙΑ ΣΥΓΧΩΝΕΥΣΗ**: κάθε
 * καταναλωτής κλείνει με `.strict()`, δηλαδή **απαγορεύει άγνωστα κλειδιά**. Ένα έτοιμο
 * `z.object({...}).merge(...)` θα έφερνε **δικό του** `unknownKeys` και θα άλλαζε το
 * συμβόλαιο ανάγνωσης· το spread ενός **σχήματος** (`{ ...FIELDS }`) παράγει **ακριβώς**
 * το ίδιο `ZodObject` με πριν — ίδιος `z.infer`, ίδια `.strict()`, μηδέν migration.
 *
 * ⚠️ **ΜΗΝ βάλεις εδώ πεδίο που χρησιμοποιεί ΕΝΑΣ**. Μια ομάδα μπαίνει όταν είναι
 * **ίδια ερώτηση** σε δύο+ οντότητες· αλλιώς η κεντρικοποίηση γίνεται συρραφή άσχετων.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-789-planar-point-vocabulary.md
 */

import { z } from 'zod';

import { BimPointSchema } from './geometry.schemas';
import { MepConnectorSchema } from './mep-connector.schemas';

/**
 * **Τοποθέτηση σε όροφο** — δομικές οντότητες (τοίχος · κολόνα · δοκός · πλάκα · θεμέλιο).
 *
 * Το `offsetFromStorey` είναι η **απόκλιση** από τη στάθμη του ορόφου· χωρίς αυτό, το
 * `storeyId` λέει «σε ποιον όροφο» και **όχι** «πόσο πιο πάνω».
 */
export const STOREY_PLACEMENT_FIELDS = {
  sceneUnits: z.string().optional(),
  storeyId: z.string().min(1).optional(),
  offsetFromStorey: z.number().finite().optional(),
} as const;

/**
 * **Σκηνή + φιλοξενία** — εξοπλισμός που **κρέμεται από** άλλη οντότητα (MEP · έπιπλα ·
 * ηλεκτρικοί πίνακες). Το `hostId` είναι το FK του ξενιστή· το `material` η όψη.
 *
 * ⚠️ Δεν έχει `offsetFromStorey`: η υψομετρική θέση τους ζει στο `mountingElevationMm`
 * του {@link PLACED_BODY_FIELDS} — **άλλο ερώτημα**, όχι παράλειψη.
 */
export const SCENE_HOST_FIELDS = {
  sceneUnits: z.string().optional(),
  storeyId: z.string().min(1).optional(),
  material: z.string().min(1).optional(),
  hostId: z.string().min(1).optional(),
} as const;

/**
 * **Τοποθετημένο σώμα** — ο κοινός κορμός κάθε παραμετρικής συσκευής MEP και του
 * ηλεκτρικού πίνακα: θέση · στροφή · κουτί περιβλήματος · υψόμετρο στήριξης.
 *
 * ⚠️ Τα έπιπλα **ΔΕΝ** το χρησιμοποιούν: λένε `rotationDeg`/`widthMm`/`depthMm`/`heightMm`
 * — **άλλο λεξιλόγιο**, και η ενοποίηση θα ήταν μετονομασία αποθηκευμένων πεδίων.
 */
export const PLACED_BODY_FIELDS = {
  position: BimPointSchema,
  rotation: z.number().finite(),
  width: z.number().positive(),
  length: z.number().positive(),
  bodyHeightMm: z.number().positive(),
  mountingElevationMm: z.number().finite(),
} as const;

/**
 * **Δέσιμο βάσης/κορυφής σε δομικό στοιχείο** (ADR-369 §9 Q5 · ADR-401) — τοίχος + κολόνα.
 *
 * Τα `attach*ToIds` είναι FK ξενιστών· η συνέπειά τους με το `baseBinding`/`topBinding`
 * **δεν** εκφράζεται από τον τύπο και επιβάλλεται από το {@link addBindingIssues}.
 */
export const STRUCTURAL_BINDING_FIELDS = {
  baseOffset: z.number().finite(),
  topOffset: z.number().finite(),
  unconnectedHeight: z.number().positive().optional(),
  attachTopToIds: z.array(z.string().min(1)).optional(),
  attachBaseToIds: z.array(z.string().min(1)).optional(),
} as const;

/** **Μεταλλική διατομή Ι/H** (ADR-363 Φ2) — δοκός + κολόνα, ίδια τρία πεδία. */
export const I_SHAPE_PROFILE_FIELDS = {
  flangeThickness: z.number().positive().optional(),
  webThickness: z.number().positive().optional(),
  flipY: z.boolean().optional(),
} as const;

/** Το υποσύνολο του {@link STRUCTURAL_BINDING_FIELDS} που κρίνει η {@link addBindingIssues}. */
interface BindingData {
  readonly baseBinding: string;
  readonly topBinding: string;
  readonly unconnectedHeight?: number | undefined;
  readonly attachTopToIds?: readonly string[] | undefined;
  readonly attachBaseToIds?: readonly string[] | undefined;
}

/**
 * **Οι τρεις κανόνες συνέπειας του δεσίματος**, γραμμένοι ΜΙΑ φορά (ADR-369 · ADR-401).
 *
 * 🔑 Ήταν αντιγραμμένοι σε `wall` και `column` με **μοναδική διαφορά το πρόθεμα του
 * μηνύματος** — δηλαδή δύο αντίγραφα μιας απόφασης που πρέπει να αλλάζει μαζί. Το
 * `entity` περνιέται ρητά ώστε το μήνυμα να μένει **ακριβώς** το ίδιο με πριν.
 *
 * @param entity Το όνομα που εμφανίζεται στο μήνυμα (`'WallParams'` · `'ColumnParams'`).
 */
export function addBindingIssues(
  entity: string,
  data: BindingData,
  ctx: z.RefinementCtx,
): void {
  if (data.topBinding === 'unconnected' && data.unconnectedHeight === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['unconnectedHeight'],
      message: `${entity}: topBinding='unconnected' απαιτεί unconnectedHeight (mm > 0).`,
    });
  }
  if (data.topBinding !== 'unconnected' && data.unconnectedHeight !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['unconnectedHeight'],
      message: `${entity}: unconnectedHeight επιτρέπεται μόνο όταν topBinding='unconnected'.`,
    });
  }
  addAttachIssues(entity, 'top', data.topBinding, data.attachTopToIds, ctx);
  addAttachIssues(entity, 'base', data.baseBinding, data.attachBaseToIds, ctx);
}

/** Ένα άκρο (βάση ή κορυφή): `binding==='attached'` ⇔ υπάρχουν FK ξενιστών. */
function addAttachIssues(
  entity: string,
  end: 'top' | 'base',
  binding: string,
  ids: readonly string[] | undefined,
  ctx: z.RefinementCtx,
): void {
  const field = end === 'top' ? 'attachTopToIds' : 'attachBaseToIds';
  const bindingField = end === 'top' ? 'topBinding' : 'baseBinding';
  if (binding === 'attached' && (ids === undefined || ids.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [field],
      message: `${entity}: ${bindingField}='attached' απαιτεί ≥1 ${field} (host FK).`,
    });
  }
  if (binding !== 'attached' && ids !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [field],
      message: `${entity}: ${field} επιτρέπεται μόνο όταν ${bindingField}='attached'.`,
    });
  }
}

/**
 * **Μονάδες σκηνής** — κλειστό σύνολο, ΟΧΙ ελεύθερο `string`.
 *
 * ⚠️ Δεν είναι το ίδιο με το `sceneUnits: z.string().optional()` των δομικών οντοτήτων:
 * εκεί το πεδίο είναι **ιστορικά** ελεύθερο και η στένωσή του θα απέρριπτε παλιά έγγραφα
 * (ίδιο επιχείρημα με το `.strict()` του ADR-789 §8.1). Εδώ γεννήθηκε ήδη κλειστό.
 */
// ⚠️ ΕΣΩΤΕΡΙΚΟ, ΜΗΝ το ξανα-εξάγεις (ADR-806): κανείς δεν το ζητά ονομαστικά — ο
// καταναλωτής το παίρνει ΔΟΜΙΚΑ μέσα από την υπογραφή των εξαγόμενων συμβόλων αυτού
// του module. Το `export` ήταν πλατύτερο από τη χρήση (CHECK 3.30).
const SceneUnitsSchema = z.enum(['mm', 'cm', 'm']);

/**
 * **Ουρά στοιχείου δικτύου MEP** — σωλήνας/αεραγωγός + εξάρτημα.
 *
 * Το `connectors` είναι το forward hook των δικτύων (ADR-408 Φ1): κενό στη φέτα
 * θεμελίωσης, γεμάτο μόλις ενωθεί το στοιχείο σε σύστημα.
 */
export const MEP_ELEMENT_TAIL_FIELDS = {
  sceneUnits: SceneUnitsSchema.optional(),
  storeyId: z.string().min(1).optional(),
  connectors: z.array(MepConnectorSchema).optional(),
} as const;

/** Το υποσύνολο που κρίνει η {@link addDnaThicknessIssue}. */
interface DnaThicknessData {
  readonly thickness: number;
  readonly dna?: { readonly totalThickness: number } | undefined;
}

/**
 * **SSoT: όταν υπάρχει DNA, το `thickness` ΠΑΡΑΓΕΤΑΙ από το `dna.totalThickness`.**
 *
 * 🔑 Ήταν γραμμένο δύο φορές (πλάκα · στέγη) με **την ίδια ανοχή 1e-3** και
 * μηδέν κοινό σημείο — δηλαδή μια αριθμητική απόφαση που έπρεπε να αλλάζει μαζί.
 */
export function addDnaThicknessIssue(
  entity: string,
  data: DnaThicknessData,
  ctx: z.RefinementCtx,
): void {
  if (data.dna === undefined) return;
  if (Math.abs(data.thickness - data.dna.totalThickness) <= DNA_THICKNESS_TOLERANCE) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['thickness'],
    message: `${entity}: όταν υπάρχει dna, thickness πρέπει να ισούται με dna.totalThickness.`,
  });
}

/** Ανοχή ισότητας πάχους ↔ DNA (mm). Ήταν `1e-3` σε δύο σημεία. */
const DNA_THICKNESS_TOLERANCE = 1e-3;
