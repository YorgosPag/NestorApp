/**
 * 🏢 ENTERPRISE ENTITY AVATAR — Contract
 *
 * What any identity image needs, independent of the domain it comes from: a name (for the monogram and
 * the accessible name), a stable seed (for the monogram tone), an optional image, and what kind of
 * thing it depicts. The domain decides the values (e.g. `resolveContactIdentityImage`); the design
 * system decides how they are drawn — shape, fit, size, tone — in ONE place.
 *
 * @see EntityAvatar for the renderer
 * @see ADR-190 §Display — identity image SSoT
 */

/**
 * What the image depicts — drives shape AND fit together, so they can never disagree:
 * - `person`       → circle, `object-cover` (a face fills its frame)
 * - `organization` → rounded square, `object-contain` on a neutral tile (a logo is never cropped)
 */
export type EntityAvatarKind = 'person' | 'organization';

/** Rendered box size. Each step maps to a fixed CSS size so the image request can match it exactly. */
export type EntityAvatarSize = 'sm' | 'md' | 'lg';

export interface EntityAvatarSpec {
  /** Display name — source of the monogram initials */
  readonly name: string;
  /** Stable identity (entity id) — the monogram tone is derived from it, never random */
  readonly seed: string;
  /** Image URL; absent ⇒ monogram */
  readonly imageUrl?: string;
  /** What the image depicts */
  readonly kind: EntityAvatarKind;
}
