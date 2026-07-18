/**
 * BIM Opening — Frame Profile (διατομή κάσας) type model — ADR-611 Foundation.
 *
 * A door/window (κούφωμα) frame profile is a first-class, editable, catalog-backed
 * concept **DECOUPLED** from the opening width/height. Changing an opening's
 * width/height MUST keep the frame member cross-sections CONSTANT (Revit
 * swept-profile = Cinema4D constant-cross-section = Figma 9-slice).
 *
 * Every aluminium manufacturer (Alumil / Europa / Elvial / Exalco) publishes its
 * own frame + sash series; the user picks and edits a profile per opening.
 *
 * ─── CROSS-SECTION SEMANTICS (two independent mm dimensions) ─────────────────
 *   - `faceWidth` = mm across the opening FACE (the visible width of the κάσα
 *     member as seen in elevation — the first "7" in a 7×7 profile).
 *   - `depth`     = mm through-the-wall-thickness direction (the second "7"),
 *     **INDEPENDENT** of `wall.thickness`. The frame member does not scale with
 *     the wall; a 70mm profile stays 70mm in a 250mm wall.
 *
 * Mirrors the beam/column catalog-profile-ID convention (IPE-300 + section
 * catalog + `CATALOG_CUSTOM_SENTINEL`). The custom sentinel is a single SSoT
 * imported from `bim/columns/section-catalog.ts` — never re-declared here.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-611-opening-frame-profile.md
 * @see bim/columns/section-catalog.ts — CATALOG_CUSTOM_SENTINEL SSoT
 */

import { CATALOG_CUSTOM_SENTINEL } from '../columns/section-catalog';
import type { ScopedLibraryDoc } from '../services/scoped-library-service';

// Re-export the single sentinel SSoT so frame-profile consumers import it from
// the domain-local module without reaching into the column catalog directly.
export { CATALOG_CUSTOM_SENTINEL };

// ─── Role discriminator ──────────────────────────────────────────────────────

/**
 * Structural role of a frame member within a κούφωμα.
 *   - `frame`   — perimeter κάσα (jamb / head / sill lining).
 *   - `sash`    — moving leaf frame (φύλλο).
 *   - `mullion` — vertical/horizontal divider between panes.
 *   - `sill`    — bottom rail / πατόσκαλο profile.
 */
export type FrameProfileRole = 'frame' | 'sash' | 'mullion' | 'sill';

// ─── Cross-section outline (ADR-676 ΒΗΜΑ 2 — swept realistic section) ──────────

/**
 * A single 2D vertex of a frame member's swept cross-section, in **mm**, expressed
 * in the member's local `(face × depth)` plane with the ORIGIN at the member
 * centerline (x = across the visible FACE, y = through the wall depth). A closed
 * `FrameSectionPoint[]` outline is swept along the member length (Revit *Profile
 * Family* / ArchiCAD *Complex Profile* / C4D constant-cross-section).
 *
 * SSoT NOTE: the dxf-viewer has no canonical shared 2D-point type (every module
 * declares a local `Vec2`); this named contract is the domain SSoT for the frame
 * section outline and is imported by the resolver + 3D geometry — do NOT re-declare.
 */
export interface FrameSectionPoint {
  readonly x: number;
  readonly y: number;
}

// ─── Catalog entry ────────────────────────────────────────────────────────────

/**
 * A single manufacturer frame profile. All linear dimensions in mm (Nestor
 * convention). `faceWidth` and `depth` are the two constant cross-section
 * dimensions — see file header for semantics.
 */
export interface OpeningFrameProfile {
  /** Catalog ID (persisted in `OpeningParams.frameProfileId`), e.g. 'ALUMIL-M9660-frame'. */
  readonly id: string;
  /** Manufacturer brand, e.g. 'Alumil' / 'Europa' / 'Elvial' / 'Exalco' / 'Generic'. */
  readonly manufacturer: string;
  /** Product series/system, e.g. 'M9660' / 'S350' / 'Slide 2500'. */
  readonly series: string;
  /** Member role within the κούφωμα. */
  readonly role: FrameProfileRole;
  /** mm across the opening FACE (visible κάσα width in elevation). */
  readonly faceWidth: number;
  /** mm through the wall-thickness direction (INDEPENDENT of wall.thickness). */
  readonly depth: number;
  /**
   * ADR-676 ΒΗΜΑ 2 — optional realistic swept cross-section (κλειστό outline, mm,
   * local `(face × depth)` plane, origin at centerline). Absent → the member is
   * the default `faceWidth × depth` rectangular box (zero regression). Present →
   * the outline is extruded along the member length (πατούρα/rebate/θερμοδιακοπή).
   */
  readonly section?: readonly FrameSectionPoint[];
  /** Optional human label; catalog data (not i18n) — code/dims are literal facts. */
  readonly label?: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

/** Default frame member face width (mm) when no profile resolves. */
export const DEFAULT_FRAME_PROFILE_FACE_MM = 50;

/** Default frame member depth (mm) when no profile resolves. */
export const DEFAULT_FRAME_PROFILE_DEPTH_MM = 50;

// ─── User library persisted doc (ADR-676 Phase 3 PILOT) ───────────────────────

/**
 * Firestore-persisted user/company/project-scoped frame profile preset.
 * Lives in `companies/{companyId}/opening_frame_presets/{id}` (mirrors the
 * `BimFamilyType` / `StairPresetDoc` 3-scope subcollection convention — see
 * `bim/family-types/opening-frame-profile-library-service.ts`). `origin`
 * distinguishes a from-scratch user entry (`'user'`) from a "Duplicate & edit"
 * of a builtin/user profile (`'derived'`, with `derivedFrom` provenance).
 */
export interface OpeningFrameProfilePresetDoc extends ScopedLibraryDoc {
  readonly id: string;
  readonly scope: string;
  /** User-visible name (DATA, not i18n — same convention as `BimFamilyType.name`). */
  readonly name: string;
  readonly origin: 'user' | 'derived';
  /** Source builtin/user profile id when `origin === 'derived'` (provenance). */
  readonly derivedFrom?: string;
  readonly manufacturer: string;
  readonly series: string;
  readonly role: FrameProfileRole;
  readonly faceWidth: number;
  readonly depth: number;
  /** ADR-676 ΒΗΜΑ 2 — persisted swept cross-section outline (mm). @see OpeningFrameProfile.section */
  readonly section?: readonly FrameSectionPoint[];
  readonly label?: string;
}

/**
 * Maps a persisted preset doc to the plain `OpeningFrameProfile` shape consumed
 * by the resolver/bridge (same fields the builtin catalog entries carry). Optional
 * fields (`label`, `section`) are spread in ONLY when present so an absent field
 * never becomes an explicit `undefined` (zero regression / Firestore-clean).
 */
export function frameProfilePresetDocToProfile(
  doc: OpeningFrameProfilePresetDoc,
): OpeningFrameProfile {
  let profile: OpeningFrameProfile = {
    id: doc.id,
    manufacturer: doc.manufacturer,
    series: doc.series,
    role: doc.role,
    faceWidth: doc.faceWidth,
    depth: doc.depth,
  };
  if (doc.section !== undefined) profile = { ...profile, section: doc.section };
  if (doc.label !== undefined) profile = { ...profile, label: doc.label };
  return profile;
}
