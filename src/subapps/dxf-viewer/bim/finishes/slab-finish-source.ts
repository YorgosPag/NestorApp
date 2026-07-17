/**
 * ADR-534 Φ5 — Η ΠΛΑΚΑ ως finish-member του σοβά (mirror του `wall-finish-source.ts`).
 *
 * Πρόβλημα (Giorgio, C4D screenshots 2026-07-17): «ΣΤΗΝ ΠΛΑΚΑ ΔΕΝ ΤΟΠΟΘΕΤΕΙΤΑΙ ΣΟΒΑΣ ΣΕ
 * ΚΑΜΜΙΑ ΠΛΕΥΡΑ». Η πλάκα υπήρχε στο `bim/finishes/` **μόνο ως `HorizontalSlabObstacle`**
 * (εμπόδιο που κρύβει τον σοβά ΑΛΛΩΝ) — το `SlabParams` δεν είχε καν `finish` spec, σε
 * αντίθεση με τοίχο/κολόνα/δοκάρι. Ήταν ο **τελευταίος** δομικός τύπος που έλειπε.
 *
 * Λύση (FULL SSoT): ίδιο ακριβώς μοτίβο με τον τοίχο — `finish` spec στα params + **ΤΟ**
 * predicate «δικαιούται additive σοβά» εδώ, ώστε ο κάθετος (silhouette) και ο οριζόντιος
 * (top-cap/soffit) δρόμος να ρωτούν **ΕΝΑ** σημείο. Μηδέν νέο geometry math: το `safeUnion`
 * ανά z-band σβήνει μόνο του τις επαφές και το `coversAtPlane` κάνει τον σοβά associative
 * (βάζεις αύριο δομικό στοιχείο πάνω στην πλάκα → ο σοβάς φεύγει εκεί, χωρίς καμία δήλωση).
 *
 * ⚠️ **Ο σοβάς ΔΕΝ είναι το buildup.** Το `SlabDna` (υγρομόνωση/θερμομόνωση/κονία/πλακάκι,
 * `slab-dna-types.ts`) είναι **άλλο** σύστημα: *είναι* το δομικό πάχος. Ο σοβάς είναι
 * additive δέρμα 15/25mm που **δεν** αλλάζει το `thickness`. Μην τα ενώσεις.
 *
 * Pure: μηδέν globals/React/THREE/scene.
 *
 * @see ./wall-finish-source.ts — ΤΟ πρότυπο που καθρεφτίζεται εδώ
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 * @see docs/centralized-systems/reference/adrs/ADR-534-auto-ceiling-slab-per-bay.md §7
 */

import type { SlabDna } from '../types/slab-dna-types';
import type { SlabKind, SlabParams } from '../types/slab-types';
import { isFinishActive } from './structural-finish-types';

/** Prefix υλικού σοβά — ΙΔΙΟ με τον τοίχο (`wall-finish-source.ts`), shared plaster catalog. */
const PLASTER_MATERIAL_PREFIX = 'mat-plaster';

/**
 * ADR-534 Φ5 Απόφαση Γ — **ΤΑ** kinds πλάκας που δικαιούνται σοβά. Ο διακόπτης, ένα σημείο.
 *
 * Τεκμηρίωση **από τον κώδικα**, όχι από γούστο:
 *   - `foundation` **ΕΚΤΟΣ** — `slab-dna-types.ts:98` αυτολεξεί: «Foundation slab: *no soffit,
 *     bears on soil*». Δεν υπάρχει παρειά να σοβατιστεί.
 *   - `ground` **ΕΚΤΟΣ** — `createDefaultGroundBuildup()` δίνει waterproofing + blinding στο
 *     bottom (πατά σε μπετόν καθαριότητας), ΟΧΙ σοβά.
 *   - `floor`/`ceiling`/`roof` **ΕΝΤΟΣ** — αναρτημένες πλάκες με εκτεθειμένη κάτω παρειά.
 *
 * Ακριβές mirror του `FINISH_SKIN_CATEGORIES` του τοίχου (parapet/fence = bare → εκτός).
 */
export const SLAB_FINISH_KINDS: ReadonlySet<SlabKind> = new Set<SlabKind>(['floor', 'ceiling', 'roof']);

/** `true` όταν το kind της πλάκας δικαιούται σοβά. Βλ. {@link SLAB_FINISH_KINDS}. */
export function slabKindTakesFinish(kind: SlabKind): boolean {
  return SLAB_FINISH_KINDS.has(kind);
}

/**
 * ADR-534 Φ5 — `true` όταν το DNA φέρει **σοβά ως στρώση** (π.χ. το «Plaster Soffit 15»
 * του `createDefaultRoofBuildup()`/`createDefaultFloorBuildup()`): στρώση με υλικό
 * `mat-plaster-*` σε μη-`core` ζώνη. Τέτοια πλάκα **δεν** παίρνει ΚΑΙ additive σοβά —
 * αλλιώς **διπλό δέρμα** στο ίδιο σημείο.
 *
 * Ακριβές mirror του `wallDnaHasPlaster` (`side !== 'core'` → `zone !== 'core'`). Η μόνωση
 * (XPS) και η υγρομόνωση **ΔΕΝ** είναι σοβάς → δεν μετράνε εδώ.
 */
export function slabDnaHasPlaster(dna: SlabDna | undefined): boolean {
  return !!dna && dna.layers.some((l) => l.zone !== 'core' && l.materialId.startsWith(PLASTER_MATERIAL_PREFIX));
}

/** Το ελάχιστο σχήμα πλάκας που χρειάζεται το predicate (entity-agnostic — pure). */
export interface SlabFinishSource {
  readonly params: Pick<SlabParams, 'kind' | 'finish' | 'dna'>;
}

/**
 * ADR-534 Φ5 — **ΤΟ** SSoT predicate «η πλάκα δικαιούται additive σοβά» (finish-member).
 * `true` ΜΟΝΟ όταν και τα τρία ισχύουν:
 *   1. το `kind` της δικαιούται σοβά ({@link SLAB_FINISH_KINDS}) — όχι ground/foundation·
 *   2. έχει **ενεργό** `finish` spec (legacy persisted πλάκα → `undefined` → `false`,
 *      μηδέν migration, ίδιο με column/beam/wall σήμερα)·
 *   3. το DNA της **δεν** φέρει ήδη σοβά-στρώση ({@link slabDnaHasPlaster}) → μηδέν διπλό δέρμα.
 *
 * Το διαβάζουν **και** ο κάθετος σοβάς (perimeter silhouette) **και** το οριζόντιο
 * top-cap/soffit → ΕΝΑ σημείο αλήθειας (περιμετρικό ↔ κάτω παρειά πάντα συνεπή).
 */
export function slabIsFinishMember(slab: SlabFinishSource): boolean {
  return (
    slabKindTakesFinish(slab.params.kind) &&
    isFinishActive(slab.params.finish) &&
    !slabDnaHasPlaster(slab.params.dna)
  );
}

/** Τα params που ορίζουν το κατακόρυφο εύρος μιας πλάκας. */
export type SlabZExtentParams = Pick<SlabParams, 'levelElevation' | 'heightOffsetFromLevel' | 'thickness'>;

/**
 * ADR-534 Φ5 — **ΤΟ** SSoT κατακόρυφο εύρος (mm) μιας πλάκας. ADR-369 §2.1 canonical:
 * το `levelElevation` είναι η **πάνω** παρειά (FFL) και η πλάκα **κρέμεται προς τα κάτω**
 * κατά `thickness` — γι' αυτό `zBot = zTop − thickness` (ΟΧΙ το αντίστροφο).
 *
 * N.0.2 boy-scout (2026-07-17): **ΜΕΤΑΚΙΝΗΘΗΚΕ** αυτούσιο από το `slabZExtent`
 * (`structural-finish-scene-horizontal.ts:133`) — δεν ξαναγράφτηκε. Ο σοβάς το χρειάζεται
 * και στους δύο δρόμους (κάθετο + οριζόντιο)· αντιγραφή εδώ θα ήταν ακριβώς το διπλό που
 * μόλις ενοποίησε το `wallFinishZExtent` (ADR-534 Φ3c-B3b′).
 *
 * ⚠️ Σε αντίθεση με τον τοίχο, **δεν** δέχεται top-clip: η πλάκα είναι το στοιχείο **που
 * κόβει** τους άλλους (soffit clip), δεν κόβεται η ίδια.
 */
export function slabFinishZExtent(p: SlabZExtentParams): { zBotMm: number; zTopMm: number } {
  const zTopMm = p.levelElevation + (p.heightOffsetFromLevel ?? 0);
  return { zBotMm: zTopMm - p.thickness, zTopMm };
}
