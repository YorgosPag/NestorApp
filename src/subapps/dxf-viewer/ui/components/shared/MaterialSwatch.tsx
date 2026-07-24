'use client';

/**
 * MaterialSwatch — the shared material preview chip (ADR-413 §2D appearance).
 *
 * A small square showing a material's appearance, reused by every material picker
 * (slab/roof layer editor, wall DNA editor, materials library panel) so they read
 * uniformly — like Revit's material browser swatch.
 *
 * Resolution (single source of truth — see `material-thumbnail-resolver.ts`):
 *   - prefer the user-uploaded appearance `thumbnailUrl` (ADR-413 §2D Phase 2 —
 *     Revit «Appearance asset → image»), when the consumer holds a `BimMaterial`
 *     doc that carries one — this WINS over everything;
 *   - else the user-uploaded 3D PBR `albedoUrl` (ADR-413 §2D Phase 3 — ONE Revit
 *     appearance asset: the 2D chip reuses the 3D base-colour map when no separate
 *     thumbnail was set);
 *   - else the material's PBR `albedo.jpg` (the exact 3D-render image), resolved
 *     by `materialId` (DNA prefix) or `category` (library `bmat_*` docs);
 *   - degrade to the material's flat colour chip when no texture slug maps.
 *
 * @see ../../../bim/materials/material-thumbnail-resolver.ts
 * @see ../../../bim/materials/material-catalog-defs.ts
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { BimMaterialAppearance, BimMaterialCategory } from '../../../bim/types/bim-material-types';
import { catalogFlatColorOrNull } from '../../../bim/materials/material-catalog-defs';
import {
  slugForMaterialId,
  slugForMaterialCategory,
  useMaterialThumbnailUrl,
} from '../../../bim/materials/material-thumbnail-resolver';
import { useMaterialAppearanceThumbnail } from '../../../bim-3d/preview/material-appearance-thumbnail-store';
import {
  resolveThumbnailDef,
  resolveThumbnailTextureSet,
  preloadThumbnailTextures,
} from '../../../bim-3d/preview/material-thumbnail-spec';
import { useBim3DEntitiesStore } from '../../../bim-3d/stores/Bim3DEntitiesStore';

/** Neutral grey when neither materialId nor category yields a colour. */
const NEUTRAL_FALLBACK = '#b0b0b0';

export interface MaterialSwatchProps {
  /** DNA materialId (e.g. 'mat-concrete-c25'). Drives the image + fallback colour. */
  readonly materialId?: string;
  /** Library category fallback when there is no texture-mapped materialId. */
  readonly category?: BimMaterialCategory;
  /**
   * ADR-413 §2D Phase 2 — user-uploaded appearance image (`BimMaterial.thumbnailUrl`).
   * When non-empty it WINS over the albedo/category swatch. Pass `material.thumbnailUrl`
   * from any consumer that holds the `BimMaterial` doc.
   */
  readonly thumbnailUrl?: string | null;
  /**
   * ADR-413 §2D Phase 3 — the material's user-uploaded 3D PBR base-colour map
   * (`BimMaterial.pbrTextures.albedoUrl`). Used as the swatch image when no
   * separate `thumbnailUrl` was set (ONE Revit appearance asset). Pass
   * `material.pbrTextures?.albedoUrl` from any consumer that holds the doc.
   */
  readonly albedoUrl?: string | null;
  /**
   * ADR-687 Φ6 — per-material PBR appearance (χρώμα/γυαλάδα/μέταλλο + Φ5 clearcoat/
   * transmission). When set (and no user image wins), the swatch shows a REAL rendered
   * sphere thumbnail of it (C4D/Revit Material Manager), not a flat colour. Pass
   * `material.appearance`. `null` → today's category/flat fallback (back-compat).
   */
  readonly appearance?: BimMaterialAppearance | null;
  /**
   * ADR-687 Φ7 — legacy flat wall-covering paint colour (`#rrggbb`). In sphere mode it
   * renders a coloured sphere (no texture). Ignored outside sphere mode.
   */
  readonly color?: string;
  /**
   * ADR-687 Φ7 — render EVERY kind as a real 3D sphere thumbnail (C4D/Revit Material
   * Manager): appearance → its PBR look; catalog `mat-*` → the catalog def WITH its texture
   * on the sphere; `bmat_*` → the library texture set; `color` → a flat colour sphere.
   * Opt-in (the «Υλικά όψης» bar + library list), so layer editors keep their flat chips.
   */
  readonly sphere?: boolean;
  /** Extra classes (size override etc.). Default is a 20px square. */
  readonly className?: string;
}

export function MaterialSwatch({
  materialId,
  category,
  thumbnailUrl,
  albedoUrl,
  appearance,
  color,
  sphere,
  className,
}: MaterialSwatchProps): React.ReactElement {
  const slug = materialId
    ? slugForMaterialId(materialId)
    : category
      ? slugForMaterialCategory(category)
      : null;
  const resolvedAlbedoUrl = useMaterialThumbnailUrl(slug);

  // ADR-687 Φ6/Φ7 — rendered sphere thumbnail. Enabled in `sphere` mode (bar + library) OR
  // whenever an appearance is present (Φ6 back-compat). Resolves the def for every material
  // kind + its ALREADY-loaded texture set; a `textureAssetVersion` bump re-resolves so a
  // catalog swatch upgrades flat-sphere → textured-sphere the moment its maps finish loading.
  const wantSphere = sphere || !!appearance;
  const sphereDef = wantSphere ? resolveThumbnailDef({ appearance, materialId, category, color }) : null;
  const texVersion = useBim3DEntitiesStore((s) => (wantSphere ? s.textureAssetVersion : 0));
  const sphereSet = wantSphere ? resolveThumbnailTextureSet(materialId, texVersion) : null;
  useEffect(() => {
    if (wantSphere) preloadThumbnailTextures(materialId);
  }, [wantSphere, materialId]);
  const sphereThumb = useMaterialAppearanceThumbnail(sphereDef, sphereSet);

  // ADR-691 Φ3 — μια σφαίρα **χωρίς δικό της χρώμα ΚΑΙ χωρίς υφή** (υλικό με `appearance: null`
  // που πέφτει στο γενικό χρώμα κατηγορίας) είναι κυριολεκτικά ένα γκρι μπαλάκι: δεν λέει τίποτα
  // για το υλικό. Όταν υπάρχει πραγματική ανεβασμένη υφή, ΕΚΕΙΝΗ προηγείται. Μετρημένο σε
  // εισαγόμενα μοντέλα (ADR-691): η γκρι σφαίρα έκρυβε τη φωτογραφία της υφής.
  const colourlessFallbackSphere = wantSphere && !appearance && !sphereSet;
  const preferredSphere = colourlessFallbackSphere ? null : sphereThumb;

  // Precedence: user thumbnail (Phase 2) → rendered sphere (Φ6/Φ7) → user 3D albedo photo
  // (Phase 3) → resolved slug albedo → flat colour chip.
  const url = thumbnailUrl || preferredSphere || albedoUrl || sphereThumb || resolvedAlbedoUrl;

  // ADR-693 Γ3 — τελευταίο δίχτυ: αν η επιλεγμένη εικόνα ΔΕΝ φορτώσει (ληγμένο signed URL, σβησμένο
  // αρχείο στο Storage, εκφυλισμένο data URL από χαμένο GL context), πέφτουμε στο flat colour chip
  // αντί να δείξουμε το broken-image icon του browser. Ο χρήστης πρέπει ΠΑΝΤΑ να βλέπει χρώμα —
  // ένα σπασμένο εικονίδιο διαβάζεται ως κατεστραμμένο υλικό, ενώ το υλικό είναι μια χαρά (Revit/
  // Figma συμβόλαιο). Το κλειδί στο `key` επαναφέρει τη δοκιμή όταν αλλάξει το url.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const handleError = useCallback(() => { setBrokenUrl(url || null); }, [url]);

  const base = `inline-block h-5 w-5 shrink-0 rounded-sm border border-black/20 ${className ?? ''}`;

  if (url && url !== brokenUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={url}
        src={url}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={handleError}
        className={`${base} object-cover`}
      />
    );
  }

  // Flat colour fallback — data-driven colour requires an inline style (the same
  // accepted exception as the MEP circuit colour chip; CLAUDE.md N.3).
  //
  // ADR-693 — σειρά: μπογιά (`color`) → το ΠΡΑΓΜΑΤΙΚΟ χρώμα του υλικού (`appearance.baseColorHex`)
  // → catalog flat χρώμα ΜΟΝΟ για γνωστό `mat-*`/`elem-*` id → ουδέτερο γκρι. Πριν, ένα υλικό
  // βιβλιοθήκης (`bmat_*`) περνούσε από `getMaterialFlatColorHex` → `resolveMaterialKey` → concrete,
  // δηλαδή έπαιρνε το ΓΚΡΙ ΤΟΥ ΣΚΥΡΟΔΕΜΑΤΟΣ ενώ κουβαλούσε δικό του χρώμα (ADR-693 §2.2).
  const fallbackColor =
    color
    || appearance?.baseColorHex
    || (materialId ? catalogFlatColorOrNull(materialId) : null)
    || NEUTRAL_FALLBACK;
  return <span aria-hidden="true" className={base} style={{ backgroundColor: fallbackColor }} />;
}
