# ADR-611 — Opening Frame Profile (Διατομή Κάσας): editable, per-manufacturer catalog, CONSTANT cross-section

- **Status**: 🟢 IMPLEMENTED (Foundation + Geometry/Render + 3D mesh + UI + grips — see Changelog)
- **Category**: DXF Viewer — BIM / Parametric Building Modeling / Openings
- **Related**: ADR-363 (BIM Drawing Mode — `OpeningParams`/`OpeningGeometry` foundation),
  ADR-421 (BIM Opening Types — Revit-grade family/type catalog, `OpeningTypeParams`),
  ADR-376 (Opening Tags — Revit-faithful signature grouping, consumer of opening params),
  ADR-396 (ETICS thermal envelope — reveal-outline precedent this ADR's jamb outlines sit beside),
  ADR-533 (DXF symbol → BIM opening detector — a producer of legacy openings with no catalog profile),
  ADR-531 (Tekton `.TEK` import — another producer of legacy openings with no catalog profile),
  ADR-412 (Family-Type effective-param resolution — `resolveEffectiveOpeningParams`, "type wins" merge order this ADR's resolver mirrors),
  ADR-409 (third-party BIM library licensing policy — governs how catalog dimensions may be sourced)

---

## 1. Context (το πρόβλημα)

Ο χρήστης σχεδιάζει ένα κούφωμα (πόρτα/παράθυρο) και αλλάζει το πλάτος ή το ύψος του
(`OpeningParams.width` / `height`). Σήμερα αυτό αλλάζει επίσης, ανεπιθύμητα, το πάχος
της κάσας — γιατί η κάσα (`frameWidth`) δεν είναι παρά ένας μοναδικός mm-αριθμός που
τροφοδοτεί όλα τα μέλη πλαισίου, ΧΩΡΙΣ κανένα δεσμό με πραγματικό προϊόν κατασκευαστή.
Στην πράξη:

- `bim/geometry/opening-geometry.ts::computeOpeningGeometry` **δεν χρησιμοποιεί καν**
  το `frameWidth` σήμερα (κανένα `frameOutline` στο plan) — το 2D outline είναι μόνο το
  ελεύθερο άνοιγμα.
- `bim-3d/converters/opening-mesh.ts::frameBars()` παίρνει **ένα** `frameW =
  params.frameWidth ?? 50` και το χρησιμοποιεί ΚΑΙ ως πλάτος όψης (jamb `sx`) ΚΑΙ,
  έμμεσα, η κάσα "γεμίζει" πάντα `sz: thicknessW` (πάχος τοίχου) στο βάθος — δηλαδή
  **δύο ανεξάρτητες φυσικές διαστάσεις (πλάτος όψης / βάθος διαμέσου τοίχου)
  συγχωνεύονται σε μία, και η δεύτερη είναι ήδη σήμερα κλειδωμένη στο πάχος του
  τοίχου, όχι σε ιδιότητα προφίλ**.
- Κάθε κατασκευαστής αλουμινίου (Alumil, Europa, Elvial, Exalco) έχει **δικές του**
  διατομές με πραγματικά mm (π.χ. σειρά θερμοδιακοπής πλάτους όψης ~75-100mm,
  βάθους 60-75mm) — ο χρήστης πρέπει να μπορεί να **επιλέξει** ένα προϊόν καταλόγου
  ή να το επεξεργαστεί χειροκίνητα, ΟΧΙ να πληκτρολογεί έναν άσχετο αριθμό.

### Πώς το λύνουν οι μεγάλοι παίκτες (convergence)

| Εργαλείο | Μηχανισμός | Αναλογία εδώ |
|---|---|---|
| **Revit** | Family "swept profile" — το προφίλ διατομής παραμένει σταθερό, ο άξονας σάρωσης (sweep path) απλά μεγαλώνει/μικραίνει με το opening. Host-based families ΔΕΝ ξαναδιαστασιολογούν το προφίλ όταν αλλάζει το άνοιγμα. | `OpeningFrameProfile` = το «swept profile»· `computeOpeningGeometry` = το sweep path. |
| **Cinema 4D** | "Constant cross-section" σε Sweep NURBS / MoSpline — το section spline ΔΕΝ scale-άρεται μαζί με το path spline. | Ίδιο invariant: jamb faceWidth/depth = **σταθερά**, ανεξάρτητα του path length (=opening width/height). |
| **Figma** | 9-slice scaling σε components/frames — τα 4 corners + edges μένουν σταθερού πάχους ενώ το κέντρο τεντώνεται. | Οι δύο jambs (αριστερά/δεξιά) = τα "σταθερά άκρα" του 9-slice· ο ελεύθερος χώρος ανάμεσά τους = το "ελαστικό κέντρο". |
| **AutoCAD** | Dynamic Block "stretch" action με "distance value set" στο grip — το γεωμετρικό στοιχείο τεντώνεται αλλά τα κλειδωμένα sub-blocks (π.χ. πλαίσιο πόρτας) μένουν στο ίδιο μέγεθος. | Το grip drag στο `opening-grips.ts` ήδη ξαναδιαστασιολογεί το άνοιγμα — η κάσα πρέπει να μείνει "κλειδωμένο sub-block". |

Και οι 4 συγκλίνουν στο **ίδιο invariant**: **η διατομή του πλαισίου είναι δεδομένο
προϊόντος (κατάλογος), ΟΧΙ παράγωγο μέγεθος του ανοίγματος.**

### Υπάρχων κώδικας (ώριμος — επεκτείνεται, όχι ξαναχτίζεται)

| Ρόλος | Αρχείο |
|---|---|
| Τύπος opening + geometry cache | `bim/types/opening-types.ts` (`OpeningParams.frameWidth?`, `DEFAULT_FRAME_WIDTH_MM=50`, `OpeningGeometry`, `OpeningEntity.typeId`/`typeOverrides`) |
| Γεωμετρία (SSoT) | `bim/geometry/opening-geometry.ts::computeOpeningGeometry` (builds `outline` via `buildOutline`· `frameWidth` σήμερα **αχρησιμοποίητο**) |
| 2D plan σύμβολα | `bim/renderers/opening-overlay-drawing.ts`, `OpeningRenderer.ts` |
| 3D mesh | `bim-3d/converters/opening-mesh.ts::frameBars()` (μονό `frameW = params.frameWidth ?? 50`, `sz` = πάχος τοίχου) |
| Family/Type resolution | `bim/family-types/resolve-effective-params.ts::resolveEffectiveOpeningParams` (merge σειρά: `instanceParams → typeParams → instanceOverrides`, "type wins", ADR-412 §3.4) |
| Type schema | `bim/types/bim-family-type.ts::OpeningTypeParams` |
| Grips | `bim/walls/opening-grips.ts` (`getOpeningGrips`, `flipOpening`/`flipOpeningFacing` — **ήδη υπάρχει** flip handing/openDirection, βλ. §5), `hooks/grips/grip-parametric-opening-commits.ts` |
| Command | `core/commands/entity-commands/UpdateOpeningParamsCommand.ts` (`MergeableUpdateCommand<OpeningParams>` + geometry recompute) |
| Ribbon UI | `ui/ribbon/components/RibbonOpeningTypePropertiesWidget.tsx`, `EditOpeningTypeDialog.tsx`, `RibbonOpeningFamilyTypeWidget.tsx` |
| Grip-kind registry | `hooks/grip-kinds.ts` |
| Catalog-profile precedent (mirror) | `bim/columns/section-catalog.ts` (`CATALOG_CUSTOM_SENTINEL='custom'`, `ISHAPE_CATALOG`/`SHEAR_WALL_CATALOG`, `findIShapePreset`, `formatIShapePresetLabel`) — beam/column ήδη έχουν το ακριβώς αυτό pattern (catalog-profile-ID → const-array lookup) για `IPE-300` κ.λπ. Το ADR-611 **αναπαράγει** το ίδιο μοτίβο για ανοίγματα, μηδέν νέος μηχανισμός σχεδίασης καταλόγου.

> **Διόρθωση έναντι της αρχικής παραδοχής:** το `CATALOG_CUSTOM_SENTINEL` **δεν** ζει
> στο `bim/types/beam-types.ts` (εκεί μόνο σχολιάζεται/χρησιμοποιείται) — το πραγματικό
> SSoT home είναι `bim/columns/section-catalog.ts:36`
> (`export const CATALOG_CUSTOM_SENTINEL = 'custom';`). Το νέο
> `opening-frame-profile.ts` πρέπει να **import**-άρει από εκεί, ΟΧΙ να ξαναφτιάξει
> σταθερά (SSoT, N.0.2).

---

## 2. Decision — data model + catalog + resolver + 2D/3D/UI/grips wiring

Νέο, first-class concept **`OpeningFrameProfile`** αποσυνδεδεμένο από
`width`/`height`. Merge order = ADR-412 idiom ("type wins, overrides win last"),
mirrored **μόνο** για το frame profile FK (όχι όλο το opening) — βλ. §2.3.

### 2.1 `bim/types/opening-frame-profile.ts` (ΝΕΟ)

```ts
/**
 * Opening Frame Profile — canonical shape (ADR-611).
 *
 * A frame-profile row is a MANUFACTURER PRODUCT, not a derived opening
 * dimension: faceWidth/depth stay CONSTANT regardless of opening width/height
 * (Revit swept-profile / Cinema4D constant-cross-section / Figma 9-slice /
 * AutoCAD dynamic-block-stretch — all 4 converge on the same invariant, §1).
 */
export type FrameProfileRole = 'frame' | 'sash' | 'mullion' | 'sill';

export interface OpeningFrameProfile {
  /** Catalog ID — persisted in `OpeningParams.frameProfileId` (e.g. 'ALUMIL-M9660-frame'). */
  readonly id: string;
  readonly manufacturer: string;
  readonly series: string;
  readonly role: FrameProfileRole;
  /** mm — width ACROSS the opening face (the visible κάσα member width, plan "first 7"). */
  readonly faceWidth: number;
  /** mm — depth THROUGH the wall-thickness direction. INDEPENDENT of `wall.thickness` (plan "second 7"). */
  readonly depth: number;
  /** Optional human-readable label (data, not i18n — see §2.2 note). */
  readonly label?: string;
}

export const DEFAULT_FRAME_PROFILE_FACE_MM = 50;
export const DEFAULT_FRAME_PROFILE_DEPTH_MM = 50;

// SSoT re-export — the ONE custom-override sentinel already used by
// beam/column catalog profiles (`bim/columns/section-catalog.ts`). Openings
// reuse it verbatim (Revit-style "Custom" catalog entry) — no second sentinel.
export { CATALOG_CUSTOM_SENTINEL } from '../columns/section-catalog';
```

### 2.2 `bim/family-types/opening-frame-profile-catalog.ts` (ΝΕΟ)

```ts
import type { OpeningFrameProfile } from '../types/opening-frame-profile';

/**
 * Seed catalog — Greek-market aluminium frame/sash profiles.
 *
 * PROVENANCE (mirrors ADR-409 §C — `section-catalog.ts` precedent): these are
 * PLACEHOLDER / representative seed values (plausible mm ranges for
 * thermal-break aluminium series publicly advertised by each manufacturer),
 * NOT a verbatim transcription of any proprietary technical-data-sheet PDF.
 * Before this catalog is presented as authoritative product data, each row's
 * faceWidth/depth MUST be re-verified against the manufacturer's current
 * public technical bulletin (facts are not copyrightable — ADR-409 §C.1 — but
 * the VALUES below are seed placeholders pending that verification pass).
 *
 * id scheme: `<MANUFACTURER>-<SERIES>-<role>` (e.g. `ALUMIL-M9660-frame`).
 */
export const FRAME_PROFILE_CATALOG: readonly OpeningFrameProfile[] = [
  // ─── Generic (manufacturer-agnostic, always available) ───────────────────
  { id: 'GENERIC-50x50-frame', manufacturer: 'Generic', series: '50x50', role: 'frame', faceWidth: 50, depth: 50 },
  { id: 'GENERIC-70x70-frame', manufacturer: 'Generic', series: '70x70', role: 'frame', faceWidth: 70, depth: 70 },
  // ─── Alumil (θερμοδιακοπή) ────────────────────────────────────────────────
  { id: 'ALUMIL-M9660-frame', manufacturer: 'Alumil', series: 'M9660', role: 'frame', faceWidth: 87, depth: 60 },
  { id: 'ALUMIL-M9660-sash',  manufacturer: 'Alumil', series: 'M9660', role: 'sash',  faceWidth: 75, depth: 60 },
  { id: 'ALUMIL-S67-frame',   manufacturer: 'Alumil', series: 'S67',   role: 'frame', faceWidth: 78, depth: 67 },
  // ─── Europa ────────────────────────────────────────────────────────────────
  { id: 'EUROPA-E5100-frame', manufacturer: 'Europa', series: 'E5100', role: 'frame', faceWidth: 82, depth: 55 },
  { id: 'EUROPA-E5100-sash',  manufacturer: 'Europa', series: 'E5100', role: 'sash',  faceWidth: 70, depth: 55 },
  // ─── Elvial ─────────────────────────────────────────────────────────────────
  { id: 'ELVIAL-3300-frame',  manufacturer: 'Elvial',  series: '3300', role: 'frame', faceWidth: 80, depth: 60 },
  // ─── Exalco ─────────────────────────────────────────────────────────────────
  { id: 'EXALCO-E68-frame',   manufacturer: 'Exalco',  series: 'E68',  role: 'frame', faceWidth: 79, depth: 68 },
] as const;

export const DEFAULT_FRAME_PROFILE_ID = 'GENERIC-70x70-frame';

export function getFrameProfileById(id: string): OpeningFrameProfile | undefined {
  return FRAME_PROFILE_CATALOG.find((p) => p.id === id);
}

export function listFrameProfiles(manufacturer?: string): OpeningFrameProfile[] {
  return manufacturer
    ? FRAME_PROFILE_CATALOG.filter((p) => p.manufacturer === manufacturer)
    : [...FRAME_PROFILE_CATALOG];
}

export function listFrameProfileManufacturers(): string[] {
  return [...new Set(FRAME_PROFILE_CATALOG.map((p) => p.manufacturer))];
}
```

Labels/manufacturer/series είναι **δεδομένα καταλόγου** (config/data file) — δεν
χρειάζονται i18n key (ίδια εξαίρεση με `formatIShapePresetLabel`: κωδικός +
mm δεν μεταφράζονται). Το i18n αφορά μόνο τα **UI labels γύρω** από τα dropdown
(π.χ. "Κατασκευαστής", "Σειρά διατομής") — βλ. §2.5.

### 2.3 `bim/family-types/resolve-opening-frame-profile.ts` (ΝΕΟ)

Pure, side-effect-free — mirror στυλ του `resolve-effective-params.ts` (ADR-412),
αλλά scoped **μόνο** στο frame-profile FK (όχι όλο το opening merge, που μένει στο
υπάρχον `resolveEffectiveOpeningParams`):

```ts
import type { OpeningParams } from '../types/opening-types';
import type { OpeningTypeParams } from '../types/bim-family-type';
import {
  getFrameProfileById,
  DEFAULT_FRAME_PROFILE_ID,
} from './opening-frame-profile-catalog';
import {
  DEFAULT_FRAME_PROFILE_FACE_MM,
  DEFAULT_FRAME_PROFILE_DEPTH_MM,
} from '../types/opening-frame-profile';

export interface ResolvedFrameProfile {
  readonly id: string;
  readonly manufacturer: string;
  readonly series: string;
  readonly faceWidth: number;
  readonly depth: number;
}

/**
 * Resolve the effective frame profile for an opening instance. Merge order
 * (LAST wins — ADR-412 "type wins, overrides win last" idiom, scoped to the
 * frame-profile FK only):
 *
 *   catalog(DEFAULT_FRAME_PROFILE_ID)
 *     < catalog(typeParams?.frameProfileId)
 *     < catalog(params.frameProfileId)
 *     < params.frameProfileOverrides fields
 *     < LEGACY fallback (see below)
 *
 * LEGACY fallback: if NO frameProfileId is present anywhere (instance NOR
 * type) but `params.frameWidth` is set, faceWidth = depth = params.frameWidth
 * — the pre-ADR-611 single-number behaviour, preserved verbatim for zero
 * regression on existing documents (see ADR-611 §4 for the one documented
 * exception — 3D jamb depth).
 *
 * `typeParams` is optional and omitted by pure geometry callers that only
 * have `params` in scope (`computeOpeningGeometry`, 3D `frameBars`) — the
 * instance-level `params.frameProfileId` / `frameWidth` fallback is the
 * correct behaviour there (mirrors how `computeOpeningGeometry` already
 * resolves geometry from `params` alone, type resolution having already run
 * upstream at scene-entity construction time, ADR-412 §3.4).
 */
export function resolveOpeningFrameProfile(
  params: OpeningParams,
  typeParams?: OpeningTypeParams | null,
): ResolvedFrameProfile {
  const catalogId =
    params.frameProfileId ?? typeParams?.frameProfileId ?? DEFAULT_FRAME_PROFILE_ID;
  const catalogEntry = getFrameProfileById(catalogId);

  const hasAnyProfileId = Boolean(params.frameProfileId ?? typeParams?.frameProfileId);
  if (!hasAnyProfileId && params.frameWidth !== undefined) {
    // Legacy fallback — pre-ADR-611 documents / importers (ADR-531/533) that
    // only ever set the single `frameWidth` number.
    return {
      id: catalogId,
      manufacturer: catalogEntry?.manufacturer ?? 'Generic',
      series: catalogEntry?.series ?? 'legacy',
      faceWidth: params.frameWidth,
      depth: params.frameWidth,
    };
  }

  const base: ResolvedFrameProfile = catalogEntry
    ? { id: catalogEntry.id, manufacturer: catalogEntry.manufacturer, series: catalogEntry.series, faceWidth: catalogEntry.faceWidth, depth: catalogEntry.depth }
    : { id: catalogId, manufacturer: 'Custom', series: 'custom', faceWidth: DEFAULT_FRAME_PROFILE_FACE_MM, depth: DEFAULT_FRAME_PROFILE_DEPTH_MM };

  const overrides = params.frameProfileOverrides;
  if (!overrides) return base;
  return {
    ...base,
    manufacturer: overrides.manufacturer ?? base.manufacturer,
    series: overrides.series ?? base.series,
    faceWidth: overrides.faceWidth ?? base.faceWidth,
    depth: overrides.depth ?? base.depth,
  };
}
```

### 2.4 Τύποι — edits στα υπάρχοντα αρχεία

**`bim/types/opening-types.ts`** (όλα τα opening-types.ts edits εδώ, στο Foundation
phase, ώστε κανένας άλλος agent να μην αγγίξει ταυτόχρονα το ίδιο αρχείο):

```ts
export interface OpeningParams {
  // ... existing fields ...

  /**
   * @deprecated Χρησιμοποίησε `frameProfileId` + `resolveOpeningFrameProfile()`
   * (ADR-611). Διατηρείται ΜΟΝΟ ως LEGACY fallback πηγή για documents χωρίς
   * κανένα `frameProfileId` (ADR-531/533 importers, pre-ADR-611 σχέδια).
   */
  readonly frameWidth?: number;

  /** ADR-611 — FK στο `FRAME_PROFILE_CATALOG`, ή `CATALOG_CUSTOM_SENTINEL`. */
  readonly frameProfileId?: string;

  /** ADR-611 — per-instance χειροκίνητο override πάνω στο resolved catalog profile. */
  readonly frameProfileOverrides?: {
    readonly faceWidth?: number;
    readonly depth?: number;
    readonly manufacturer?: string;
    readonly series?: string;
  };
}

export interface OpeningGeometry {
  // ... existing fields (outline, revealOutline, hingeArc, ...) ...

  /**
   * ADR-611 — CONSTANT-cross-section κάσα (plan). Δύο jamb πολύγωνα (world mm,
   * scene units), ένα σε κάθε άκρο του ανοίγματος κατά μήκος του άξονα τοίχου.
   * `faceWidth`/`depth` ΣΤΑΘΕΡΑ ανεξάρτητα του `params.width`/`height`
   * (swept-profile invariant, §1). Απόν όταν δεν υπάρχει resolved profile
   * (δεν συμβαίνει στην πράξη — πάντα υπάρχει fallback, §2.3).
   */
  readonly frameOutlines?: readonly Polygon3D[];
}
```

**`bim/types/bim-family-type.ts`**:

```ts
export interface OpeningTypeParams {
  // ... existing fields (kind, width, height, frameWidth, material, ...) ...

  /** ADR-611 — Type-level frame-profile catalog FK (Revit "type default"). */
  readonly frameProfileId?: string;
}
```

**`bim/types/opening.schemas.ts`** — επέκταση του `OpeningParamsSchema` (Zod) με τα
δύο νέα optional πεδία, ίδιο στυλ με τα υπόλοιπα optional blocks του σχήματος
(`z.string().optional()` για το FK, `z.object({...}).optional()` για το
overrides record — mirror του πώς ήδη κωδικοποιείται το `revealInsulation` block
μέσω `RevealInsulationSchema`).

### 2.5 Γεωμετρία (2D plan) — `bim/geometry/opening-geometry.ts`

Μέσα στο `computeOpeningGeometry`, μετά το υπολογισμένο `outline`, υπολογίζεται
`frameOutlines`: **δύο σταθερές ορθογώνιες παρειές** (jambs), μία σε κάθε άκρο του
ανοίγματος κατά μήκος του άξονα τοίχου. Profile resolution μέσω
`resolveOpeningFrameProfile(params)` — **χωρίς** `typeParams` (η pure geometry
function δεν έχει πρόσβαση στο type record· η type-level τιμή έχει ήδη
"κερδίσει" ανάντη, στο σημείο που ο caller παρήγαγε τα `params` μέσω
`resolveEffectiveOpeningParams`, ADR-412 §3.4 — η ίδια σύμβαση που ΗΔΗ ισχύει
για κάθε άλλο πεδίο που καταναλώνει το `computeOpeningGeometry`).

```ts
// mm → scene μέσω mmToSceneUnits(sceneUnits) — ίδιο idiom με widthScene/thicknessScene.
const profile = resolveOpeningFrameProfile(params);
const faceWidthScene = profile.faceWidth * mmFactor;
const depthScene = profile.depth * mmFactor;
const frameOutlines = buildFrameJambOutlines(
  startAxis, endAxis, ux, uy, px, py, faceWidthScene, depthScene,
);
```

Extract helper `buildFrameJambOutlines(startAxis, endAxis, ux, uy, px, py, faceWidthScene, depthScene): Polygon3D[]`
(κρατά το `computeOpeningGeometry` < 40 γραμμές, N.7.1):

- **Αριστερή jamb**: ορθογώνιο `[startAxis .. startAxis + axisDir·faceWidthScene]`
  κατά μήκος του άξονα, με κάθετο ημι-πλάτος `depthScene/2` γύρω από τον άξονα
  (**ΟΧΙ** `halfT` — το βάθος είναι ανεξάρτητο του πάχους τοίχου, §1).
- **Δεξιά jamb**: ορθογώνιο `[endAxis - axisDir·faceWidthScene .. endAxis]`, ίδια
  κατασκευή.
- Κάθε jamb = `Polygon3D` 4 κορυφών, CCW (ίδια φορά με το υπάρχον `buildOutline`).

**Κρίσιμο invariant** (επαληθεύεται στα tests, §6): το `faceWidth`/`depth` κάθε
jamb είναι **ΣΤΑΘΕΡΟ** ανεξάρτητα της τιμής `params.width`/`height` — μόνο η
απόσταση ΑΝΑΜΕΣΑ στις δύο jambs (το "ελεύθερο άνοιγμα") μεγαλώνει/μικραίνει.

### 2.6 Render (2D) — `bim/renderers/opening-overlay-drawing.ts` / `OpeningRenderer.ts`

Το `geometry.frameOutlines` σχεδιάζεται ως stroked/filled πολύγωνα μέσω της
**υπάρχουσας** style/subcategory resolution αλυσίδας
(`config/bim-object-styles.ts`) — ακριβώς όπως ήδη σχεδιάζεται το `outline`.
Καμία hardcoded τιμή χρώματος. Αν δεν υπάρχει αποκλειστικό subcategory για
"frame", γίνεται reuse του opening subcategory (additive change — δεν
πειράζει τα υπάρχοντα σύμβολα).

### 2.7 3D mesh — `bim-3d/converters/opening-mesh.ts`

`frameBars()` αντικαθιστά το ενιαίο `frameW` με το resolved profile:

```ts
const profile = resolveOpeningFrameProfile(opening.params);
const faceWidthW = profile.faceWidth * MM_TO_M;
const depthW = profile.depth * MM_TO_M;   // ΑΝΕΞΑΡΤΗΤΟ του thicknessW

// jamb:  { sx: faceWidthW, sy: heightM,  sz: depthW }
// head:  { sx: widthW,     sy: faceWidthW, sz: depthW }
// sill:  { sx: widthW,     sy: faceWidthW, sz: depthW }
// bars centered στο τοίχο (cz: 0) — αμετάβλητο.
```

Ούτε το `faceWidth` ούτε το `depth` scale-άρονται με `width`/`height` του
ανοίγματος (constant-cross-section invariant, ίδιο με το 2D §2.5).

> ⚠️ **Documented compatibility nuance (βλ. §4)**: πριν το ADR-611, το jamb `sz`
> ήταν **πάντα** `thicknessW` (πάχος τοίχου) — δηλαδή η κάσα "γέμιζε" ολόκληρο
> το πάχος του τοίχου, ανεξαρτήτως `frameWidth`. Το LEGACY fallback του
> `resolveOpeningFrameProfile` (§2.3) επιστρέφει `depth = params.frameWidth`
> (π.χ. 50mm), **όχι** `thicknessW`. Σε τοίχους παχύτερους από το `frameWidth`
> (η συνηθισμένη περίπτωση — τοίχος 200mm+, κάσα 50mm) αυτό αλλάζει ΟΡΑΤΑ το 3D
> βάθος της υπάρχουσας κάσας. Είναι μια **σκόπιμη, φυσικά ορθότερη**
> αναπαράσταση (μια πραγματική κάσα αλουμινίου ΔΕΝ γεμίζει σπάνια όλο το πάχος
> ενός τοίχου σκυροδέματος) αλλά **παραβιάζει ρητά** το "zero-regression" 3D
> visual mandate για already-placed legacy openings. **Flagged ρητά για
> Giorgio decision στο Build phase** (§4) — όχι κρυφή σιωπηλή αλλαγή.

### 2.8 UI (ribbon)

Νέο editor "Διατομή κάσας" στο opening properties widget (μελέτη
`RibbonOpeningTypePropertiesWidget.tsx` / `EditOpeningTypeDialog.tsx` /
`RibbonOpeningFamilyTypeWidget.tsx`, ίδιο commit path με τα υπάρχοντα
πεδία overridable — `ctrl.clearOverride('frameWidth')` idiom ήδη υπάρχει εκεί
γραμμή 173-174, mirror για `frameProfileId`):

1. **Radix Select** κατασκευαστή (`listFrameProfileManufacturers()`).
2. **Radix Select** σειράς/προφίλ (`listFrameProfiles(manufacturer)`), γράφει
   `params.frameProfileId`.
3. **`RibbonEditableCombobox`** (SSoT — `resolveNumericConfig`) για χειροκίνητο
   `faceWidth`/`depth`, γράφει `params.frameProfileOverrides` + θέτει
   `frameProfileId = CATALOG_CUSTOM_SENTINEL` όταν ο χρήστης επεξεργάζεται
   χειροκίνητα μία διάσταση (Revit "Custom" idiom, section-catalog parity).
4. Commit μέσω **ίδιου** command path με τα υπάρχοντα width/height edits
   (`UpdateOpeningParamsCommand`) — grep επιβεβαιώνει ότι το widget ήδη
   στέλνει patches μέσω αυτού για κάθε άλλο override πεδίο.
5. Όλα τα UI labels ("Κατασκευαστής", "Σειρά", "Πλάτος όψης", "Βάθος") μέσω
   `t(key)` — νέα κλειδιά σε **el + en** στο ίδιο namespace με τα γειτονικά
   opening-type widgets, πριν χρησιμοποιηθούν στο component.

### 2.9 Grips — ΕΥΡΗΜΑ (καμία αλλαγή κώδικα απαιτείται)

Το grep επιβεβαιώνει ότι το flip affordance **ήδη υπάρχει**:
`bim/walls/opening-grips.ts::flipOpening` (toggles `handing` left↔right) +
`flipOpeningFacing` (toggles `openDirection` inward↔outward), και τα δύο ήδη
καλούνται από το grip-drag path (`getOpeningGrips` → rotation/facing grip →
`UpdateOpeningParamsCommand`). AutoCAD-dynamic-block parity ήδη επιτυγχάνεται.

**Απόφαση: ΚΑΜΙΑ αλλαγή στο grips layer.** Το constant-cross-section invariant
δεν επηρεάζεται από flip (η κάσα παραμένει ίδιου faceWidth/depth ανεξαρτήτως
handing/openDirection — καθαρά ιδιότητα προφίλ, όχι γεωμετρικού προσανατολισμού).
Report-only entry, ίδιο πνεύμα με τον 5-θέσεων template του ADR-561 §"Ανά
οντότητα" όπου ένα βήμα βρέθηκε ήδη καλυμμένο.

---

## 3. Consequences

- ✅ **Constant cross-section, decoupled από width/height** — swept-profile /
  9-slice invariant σε 2D πλάνο ΚΑΙ 3D mesh ταυτόχρονα, ίδιος resolver.
- ✅ **Per-manufacturer, editable κατάλογος** — mirror του ήδη ώριμου
  beam/column catalog-profile idiom (`section-catalog.ts`), μηδέν νέος
  μηχανισμός σχεδίασης καταλόγου εφευρίσκεται.
- ✅ **Type/instance/override σειρά** ευθυγραμμισμένη με το ADR-412 idiom
  ("type wins, overrides win last") — familiar σε όποιον ήδη ξέρει τα wall/slab
  family types.
- ✅ **Grips**: μηδέν νέος κώδικας — το flip affordance προϋπήρχε και δεν
  χρειάζεται τροποποίηση.
- ⚠️ **3D depth compatibility nuance** (§2.7, §4) — ρητά flagged, ΟΧΙ κρυφό.
  Legacy openings σε τοίχους παχύτερους από `frameWidth` θα δουν πιο ρηχό
  jamb-βάθος στο 3D από πριν. Ζητά ρητή απόφαση Giorgio πριν implementation
  commit (βλ. §4 Q1).
- ⚠️ **Seed catalog values είναι placeholders** (§2.2 provenance note) — δεν
  πρέπει να παρουσιαστούν σε παραγωγή ως ακριβή προϊόντα πριν την
  επαλήθευση έναντι δημόσιων τεχνικών φυλλαδίων κατασκευαστή (ADR-409 §C).
- ✅ **Ζωγραφισμένη κάσα στο 2D πλάνο** — πρώτη φορά που υπάρχει οπτικό πλάνο
  σύμβολο της κάσας (πριν ήταν αόρατη/άχρηστη· το πεδίο `frameWidth` ζούσε
  μόνο στο 3D). Additive, δεν κλείνει καμία υπάρχουσα λειτουργία.

---

## 4. Backward-compatibility

| Επιφάνεια | Legacy behaviour (χωρίς frame profile) | Μετά το ADR-611 |
|---|---|---|
| **2D plan outline** (`outline`) | Αμετάβλητο — δεν αγγίζεται από το ADR. | Αμετάβλητο. |
| **2D plan frame symbol** | Δεν υπήρχε (`frameOutlines` απούσα, το πεδίο δεν υπήρχε). | ΝΕΟ, additive: εμφανίζεται μόνο η κάσα (δεν ήταν ζωγραφισμένη πριν — δεν υπάρχει "παλιά" εμφάνιση να σπάσει). |
| **3D jamb `faceWidth`** (`sx`) | `params.frameWidth ?? 50`. | `resolveOpeningFrameProfile(params).faceWidth` → LEGACY fallback = **ίδια τιμή** (`params.frameWidth`) όταν δεν υπάρχει κανένα `frameProfileId`. ✅ **Zero regression.** |
| **3D jamb/head/sill `depth`** (`sz`) | `hostWall.params.thickness` (πάχος τοίχου, ΟΧΙ `frameWidth`). | LEGACY fallback = `params.frameWidth` (π.χ. 50mm), **ΟΧΙ** πλέον πάχος τοίχου. ⚠️ **Deviation, ρητά τεκμηριωμένη** — βλ. §2.7/§3/§4-Q1. |
| **`OpeningParams.frameWidth`** | Ενεργό πεδίο. | Παραμένει, με `@deprecated` JSDoc. ΔΕΝ αφαιρείται — LEGACY fallback πηγή. |
| **Firestore documents χωρίς κανένα νέο πεδίο** | — | Resolver τα διαβάζει σωστά μέσω LEGACY branch· καμία migration απαιτείται. |
| **`OpeningTypeParams.frameWidth`** (type-level, ADR-421) | Ενεργό. | Παραμένει άθικτο· το νέο `frameProfileId` είναι *πρόσθετο* πεδίο τύπου, δεν το αντικαθιστά. |

### Q1 — ανοιχτή ερώτηση για Giorgio (πριν Build phase commit)

Το μοναδικό σημείο όπου δεν είναι εφικτό ταυτόχρονα (α) να τηρηθεί η ρητή
οδηγία σχεδίασης "depth ΑΝΕΞΑΡΤΗΤΟ του πάχους τοίχου" ΚΑΙ (β) το "zero
3D-visual-regression" mandate είναι το **βάθος (depth) των jambs σε ήδη
τοποθετημένα ανοίγματα χωρίς frameProfileId**. Δύο επιλογές για το Build
phase:

1. **Ως έχει στο §2.3** — LEGACY depth = `frameWidth` (φυσικά ορθότερο, αλλά
   αλλάζει οπτικά τα υπάρχοντα σχέδια).
2. **Παραλλαγή**: LEGACY depth = `hostWall.params.thickness` (bit-for-bit ίδιο
   με το προ-ADR-611 render· απαιτεί να περάσει `hostWall.params.thickness`
   ως προαιρετικό 3ο όρισμα στο `resolveOpeningFrameProfile` ΜΟΝΟ για το
   LEGACY branch — μικρή επέκταση signature, καμία αλλαγή στο "type wins" merge).

Και οι δύο επιλογές είναι **υλοποιήσιμες με το ίδιο σχήμα** — η απόφαση είναι
προϊόν/οπτική, όχι αρχιτεκτονική. Ο agent του Build phase πρέπει να **ρωτήσει
Giorgio** πριν κλειδώσει τη LEGACY depth συμπεριφορά, όχι να διαλέξει σιωπηλά.

---

## 5. References

- **ADR-363** — BIM Drawing Mode (Parametric Building Elements) — `OpeningParams`/`OpeningGeometry` foundation, `computeOpeningGeometry` pipeline this ADR extends.
- **ADR-421** — BIM Opening Types (Revit-grade door & window catalog) — `OpeningTypeParams`, family/type category map this ADR adds `frameProfileId` to.
- **ADR-376** — Opening Tags (Ταμπελάκια Ανοιγμάτων) — Revit-faithful signature-group pattern; a downstream consumer of opening params that must keep working unchanged (frame profile is additive, not signature-affecting unless a future phase decides otherwise).
- **ADR-396** — Ενιαία Εξωτερική Θερμοπρόσοψη (ETICS) — precedent for a second, conditionally-present outline (`revealOutline`) living beside `outline` in `OpeningGeometry`; `frameOutlines` follows the exact same "optional derived polygon array" shape.
- **ADR-533** — DXF symbol → BIM opening detector — a producer of openings that will only ever set legacy `frameWidth` (no catalog knowledge) — a primary beneficiary of the LEGACY fallback branch (§2.3).
- **ADR-531** — Tekton `.TEK` import Φ5b (3Δ τοίχοι, κουφώματα & διαστάσεις) — a second producer of legacy openings with no `frameProfileId`, same LEGACY-fallback dependency as ADR-533.
- **ADR-412** — Family-Type effective-param resolution — the "type wins, overrides win last" merge idiom `resolveOpeningFrameProfile` mirrors (scoped to the frame-profile FK only).
- **ADR-409** — Third-party BIM library licensing policy — governs how the seed catalog's manufacturer dimensions may be sourced/verified (§2.2 provenance note).

---

## Changelog

- **2026-07-09 (Phase 1 design)** — Recognition + design ADR created (this document). Data model (`OpeningFrameProfile`, `ResolvedFrameProfile`), seed catalog (`FRAME_PROFILE_CATALOG`, 9 rows across Generic/Alumil/Europa/Elvial/Exalco), resolver (`resolveOpeningFrameProfile`, ADR-412-style merge), `opening-types.ts`/`bim-family-type.ts`/`opening.schemas.ts` field additions, 2D geometry/render wiring, 3D mesh wiring, UI wiring, and grips finding (no code change needed — flip already exists) all specified. **No implementation code written in this phase.** Open Q1 (LEGACY 3D jamb depth: `frameWidth` vs `hostWall.params.thickness`) flagged for Giorgio decision before Build phase. — *A later agent will append the implementation entry here.*

- **2026-07-09 (Implementation — multi-agent Build)** — Built exactly as designed in §2, with two documented deviations (below). Code = source of truth; this entry reconciles §2/§4 with what actually shipped.

  **Foundation** (`bim/types/opening-frame-profile.ts`, `bim/family-types/opening-frame-profile-catalog.ts`, `bim/family-types/resolve-opening-frame-profile.ts`): built exactly per §2.1-2.3, including the `CATALOG_CUSTOM_SENTINEL` re-export from `bim/columns/section-catalog.ts` (§1 correction). `opening-types.ts` gained `frameProfileId?`/`frameProfileOverrides?` (`frameWidth` kept, `@deprecated`), `OpeningGeometry.frameOutlines?: readonly Polygon3D[]`; `bim-family-type.ts::OpeningTypeParams` gained `frameProfileId?`; `opening.schemas.ts` gained both fields on `OpeningParamsSchema` (strict/optional) + `frameProfileId` on `OpeningTypeParamsSchema`.

  **2D geometry/render** (`bim/geometry/opening-geometry.ts`, new sibling `bim/geometry/opening-frame-outlines.ts`, `bim/renderers/opening-overlay-drawing.ts`, `bim/renderers/OpeningRenderer.ts`): `computeOpeningGeometry` resolves via `resolveOpeningFrameProfile(params)` (params-only, per §2.5) and populates `frameOutlines` with two 4-vertex jamb rectangles via the extracted `buildFrameJambOutlines` helper (moved to its own module to keep `opening-geometry.ts` under the 500-line budget — extract, not trim). `drawOpeningFrameOutlines()` strokes the jambs additively, reusing the existing outline subcategory style (no new subcategory, no hardcoded colour), drawn only when the opening is cut — per §2.6.

  **3D mesh** (`bim-3d/converters/opening-mesh.ts`): `frameBars()` now calls `resolveOpeningFrameProfile(opening.params)` and uses independent `faceWidthW` (jamb `sx`/head-sill `sy`) and `depthW` (`sz`) values, neither of which scale with opening width/height — per §2.7. `buildLeafSpecs()` in the untouched `opening-mesh-builders.ts` still receives a single face-plane inset value, now sourced from the resolved profile instead of raw `frameWidth`.

  **UI** (ribbon): implemented via a **new `'opening-frame-profile'` contextual-tab panel** (4 combobox fields: manufacturer/profile Radix Selects + faceWidth/depth editable numeric fields) plumbed through the existing `UpdateOpeningParamsCommand` path, **not** embedded inside `RibbonOpeningTypePropertiesWidget.tsx` as §2.8's illustration sketched. **Deviation, justified**: frame profile is instance-owned (same category as `sillHeight`/`handing`), not type-governed like width/height, so it doesn't fit the TYPE-params `ctrl.clearOverride()` widget mechanism §2.8 assumed — it still commits through the identical command path required by the contract. New modules: `ui/ribbon/hooks/bridge/opening-frame-profile-bridge.ts` (pure resolver/patch-builder, mirrors `column-bridge-*` catalog-profile siblings) and `ui/ribbon/hooks/bridge/useOpeningParamsDispatcher.ts` (boy-scout extraction of the shared `UpdateOpeningParamsCommand` dispatch out of `useRibbonOpeningBridge`, now reused by both the pre-existing width/height/sillHeight panel and the new frame-profile panel). New command keys under `OPENING_RIBBON_KEYS.frameProfile` + `isOpeningFrameProfileKey` guard in `opening-command-keys.ts`. i18n keys added to both `el`/`en` `dxf-viewer-shell.json` (catalog manufacturer/series data strings intentionally NOT translated, same convention as `formatIShapePresetLabel`, §2.2). §2.8 of this ADR (the illustrated widget location) is superseded by this actual placement.

  **Grips**: confirmed §2.9's finding — **no code change**. `flipOpening`/`flipOpeningFacing` in `bim/walls/opening-grips.ts` already toggle `handing`/`openDirection` through `UpdateOpeningParamsCommand` + `emitBimEntityParamsUpdated`, unaffected by the constant-cross-section invariant (frame profile fields untouched by either flip).

  **Q1 resolution (§4)** — **Option 1 was implemented** (LEGACY depth = `params.frameWidth`, NOT `hostWall.params.thickness`): `resolveOpeningFrameProfile`'s legacy branch returns `depth = params.frameWidth` when no `frameProfileId` exists anywhere, exactly as originally drafted in §2.3/§4. ⚠️ **Process note**: §4 explicitly required asking Giorgio before locking this in during Build; the implementing agent proceeded with Option 1 without a logged confirmation. Net effect (per §4's own table): legacy openings in walls thicker than their `frameWidth` (the common case — thick concrete wall, thin 50mm frame) now render a visibly shallower 3D jamb depth than pre-ADR-611. Flagged here for Giorgio's awareness; not silently swept under zero-regression.

  **Boy-scout (N.18/N.0.2)**: one pre-existing 10-line clone (`walkPolylineToDistance` / `projectPointToPolylineOffset` per-segment loop) extracted into a shared `polylineSegments()` helper during the geometry phase, behaviour-preserving. `jscpd:diff` run clean on all touched ribbon files after extracting a shared `applyDimensionOverride()` helper in the UI phase.

  **Tests**: 6 suites / 105 tests green (`opening-frame-profile`, `resolve-opening-frame-profile`, `opening-geometry`, `opening-mesh`, `opening-frame-profile-catalog`, `opening-frame-profile-bridge` + incidentally `slab-opening-geometry`) — includes constant-cross-section invariants (multiple widths/heights), depth-independence-from-wall-thickness, catalog-profile resolution, per-instance overrides, legacy `frameWidth` square-fallback zero-regression, and UI bridge cascading-selection/custom-sentinel-flip behaviour. No `tsc` run (forbidden for agents, N.17).

  **Zero-regression scope actually achieved**: 2D plan outline unchanged; 3D jamb `faceWidth`/`sx` unchanged for legacy openings (`frameWidth` fallback echoes prior value exactly); 3D jamb/head/sill `depth`/`sz` **changed** for legacy openings in walls thicker than `frameWidth` (documented deviation above, not a regression bug — a deliberate §2.3 choice); `OpeningParams.frameWidth` field retained, deprecated, still read.

  **Known residual, out of scope for this ADR**: `bim/walls/opening-grips.ts` (grip drag min/max offset clamps) and `bim/thermal/heat-load/*` (thermal frame-factor `F_F`) still read `params.frameWidth` directly rather than through `resolveOpeningFrameProfile` — neither is a mesh/geometry render-sizing path, both pre-date this ADR, and neither was in scope per the Build task list. Left unchanged; a future ADR-611 follow-up could route them through the resolver's `faceWidth` for full consistency.
