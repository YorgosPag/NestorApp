/**
 * ADR-363 Phase 6.5.B / ADR-687 — MaterialEditorDialog form-model helpers (SSoT).
 *
 * Pure, React-free transforms between the dialog `FormState` and the persisted
 * material shapes (seed → form, form → save-input / update-patch / appearance /
 * PBR textures) + validation. Extracted from `MaterialEditorDialog.tsx` so the
 * container keeps only the form-state + save/upload lifecycle + JSX (file-size
 * SSoT, N.7.1): the dialog imports these; every builder stays independently
 * testable without mounting the dialog.
 */

import {
  MaterialThumbnailUploadError,
  type MaterialThumbnailUploadErrorCode,
} from '../../../bim/services/bim-material-thumbnail-upload.service';
import { type FormState } from './MaterialEditorSections';
import { getCategoryMaterialDef } from '../../../bim/materials/material-catalog-defs';
import { trueColorToHex } from '../../../utils/dxf-true-color';
import type {
  BimMaterial,
  BimMaterialAppearance,
  BimMaterialCategory,
  PbrMaterialTextures,
  SaveBimMaterialInput,
  UpdateBimMaterialPatch,
} from '../../../bim/types/bim-material-types';

/**
 * ADR-687 Φ8 — seed για create-mode «Διπλασίασε» από τη γενική βιβλιοθήκη (catalog/μπογιά): ανοίγει
 * ο editor με προ-συμπληρωμένο όνομα + κατηγορία + το ΠΡΑΓΜΑΤΙΚΟ appearance του καταλόγου (Revit
 * «Duplicate»). Μόνο σε create-mode χωρίς `initial`. Χωρίς seed → σημερινή συμπεριφορά (concrete).
 */
export interface MaterialEditorSeed {
  readonly nameEl: string;
  readonly nameEn: string;
  readonly category: BimMaterialCategory;
  readonly appearance: BimMaterialAppearance;
}

/**
 * ADR-687 Φ1 — the appearance form seed: the material's OWN appearance when it has
 * one, else the flat def of its category (so a legacy material opens showing its
 * real category colour, and saving it — override === category — is a no-op visually,
 * zero regression). Values are strings (form convention).
 */
function appearanceSeed(
  category: BimMaterialCategory,
  appearance: BimMaterialAppearance | null | undefined,
): {
  baseColorHex: string;
  metalness: string;
  roughness: string;
  emissiveHex: string;
  emissiveIntensity: string;
  emissiveCustom: boolean;
  opacity: string;
  clearcoat: string;
  clearcoatRoughness: string;
  transmission: string;
  ior: string;
  thickness: string;
} {
  if (appearance) {
    return {
      baseColorHex: appearance.baseColorHex,
      metalness: String(appearance.metalness),
      roughness: String(appearance.roughness),
      // ADR-687 Φ4 — emissive colour defaults to the BASE colour (Revit/C4D-intuitive: raising
      // just the intensity makes the surface glow IN ITS OWN colour, like a lit LED panel — a
      // black default would make the intensity slider a silent no-op). Intensity 0 = off.
      emissiveHex: appearance.emissiveHex ?? appearance.baseColorHex,
      emissiveIntensity: String(appearance.emissiveIntensity ?? 0),
      // Customised only if a distinct emissive colour was persisted (else it live-tracks the base).
      emissiveCustom: appearance.emissiveHex != null && appearance.emissiveHex !== appearance.baseColorHex,
      opacity: String(appearance.opacity ?? 1),
      // ADR-687 Φ5 — physical props (off/1.5 defaults for pre-Φ5 persisted appearance).
      clearcoat: String(appearance.clearcoat ?? 0),
      clearcoatRoughness: String(appearance.clearcoatRoughness ?? 0),
      transmission: String(appearance.transmission ?? 0),
      ior: String(appearance.ior ?? 1.5),
      thickness: String(appearance.thickness ?? 0),
    };
  }
  const def = getCategoryMaterialDef(category);
  const baseColorHex = trueColorToHex(def.color).toLowerCase();
  return {
    baseColorHex,
    metalness: String(def.metalness),
    roughness: String(def.roughness),
    // Emissive colour = base (off by intensity 0), tracking the base until customised;
    // opacity from the category def (e.g. glass 0.35).
    emissiveHex: baseColorHex,
    emissiveIntensity: '0',
    emissiveCustom: false,
    opacity: String(def.opacity ?? 1),
    // ADR-687 Φ5 — physical off by default (category defs carry no clearcoat/transmission).
    clearcoat: '0',
    clearcoatRoughness: '0',
    transmission: '0',
    ior: '1.5',
    thickness: '0',
  };
}

export function buildInitialState(
  initial: BimMaterial | undefined,
  projectId?: string,
  seed?: MaterialEditorSeed,
): FormState {
  if (initial) {
    const appear = appearanceSeed(initial.category, initial.appearance);
    return {
      nameEl: initial.nameEl,
      nameEn: initial.nameEn,
      category: initial.category,
      // `appearanceSeed` returns exactly the FormState appearance keys (Φ1/Φ4/Φ5) → spread
      // as ONE unit, so a new appearance field needs no change here (SSoT, N.18 anti-clone).
      ...appear,
      density: initial.density != null ? String(initial.density) : '',
      defaultThickness: initial.defaultThickness != null ? String(initial.defaultThickness) : '',
      fireRating: initial.fireRating,
      atoeCategory: initial.atoeCategory,
      atoeArticle: initial.atoeArticle ?? '',
      defaultUnitCost: initial.defaultUnitCost != null ? String(initial.defaultUnitCost) : '',
      defaultUnit: initial.defaultUnit,
      brand: initial.brand ?? '',
      brandModel: initial.brandModel ?? '',
      notes: initial.notes ?? '',
      thumbnailUrl: initial.thumbnailUrl ?? '',
      albedoUrl: initial.pbrTextures?.albedoUrl ?? '',
      normalUrl: initial.pbrTextures?.normalUrl ?? '',
      roughnessUrl: initial.pbrTextures?.roughnessUrl ?? '',
      aoUrl: initial.pbrTextures?.aoUrl ?? '',
      tileSizeM: initial.pbrTextures ? String(initial.pbrTextures.tileSizeM) : '1',
      scope: initial.scope === 'system' ? 'company' : initial.scope,
    };
  }
  // ADR-687 Φ8 — create-mode «Διπλασίασε»: seed name/category/appearance από catalog/μπογιά.
  const category = seed?.category ?? 'concrete';
  const appear = appearanceSeed(category, seed?.appearance);
  return {
    nameEl: seed?.nameEl ?? '', nameEn: seed?.nameEn ?? '', category, density: '',
    defaultThickness: '', fireRating: 'none', atoeCategory: '',
    atoeArticle: '', defaultUnitCost: '', defaultUnit: 'm2',
    brand: '', brandModel: '', notes: '', thumbnailUrl: '',
    // ...appear = all appearance fields (Φ1/Φ4/Φ5) as ONE unit — see the initial branch above.
    ...appear,
    albedoUrl: '', normalUrl: '', roughnessUrl: '', aoUrl: '', tileSizeM: '1',
    scope: projectId ? 'project' : 'company',
  };
}

/**
 * ADR-687 Φ1 — build the persisted appearance from the form. Every authored/edited
 * material owns an explicit appearance (big-player: Revit/ArchiCAD/C4D materials
 * always carry appearance). Out-of-range guards mirror `appearanceToDef`.
 */
function buildAppearance(form: FormState): BimMaterialAppearance {
  const m = Number(form.metalness);
  const r = Number(form.roughness);
  const ei = Number(form.emissiveIntensity);
  const op = Number(form.opacity);
  const cc = Number(form.clearcoat);
  const ccr = Number(form.clearcoatRoughness);
  const tr = Number(form.transmission);
  const ir = Number(form.ior);
  const th = Number(form.thickness);
  return {
    baseColorHex: form.baseColorHex,
    metalness: isNaN(m) ? 0 : m,
    roughness: isNaN(r) ? 0.5 : r,
    // ADR-687 Φ4 — concrete values only (never undefined → Firestore-safe).
    emissiveHex: form.emissiveHex,
    emissiveIntensity: isNaN(ei) ? 0 : ei,
    opacity: isNaN(op) ? 1 : op,
    // ADR-687 Φ5 — physical props (concrete values → Firestore-safe; off/1.5 defaults).
    clearcoat: isNaN(cc) ? 0 : cc,
    clearcoatRoughness: isNaN(ccr) ? 0 : ccr,
    transmission: isNaN(tr) ? 0 : tr,
    ior: isNaN(ir) ? 1.5 : ir,
    thickness: isNaN(th) ? 0 : th,
  };
}

/**
 * Build the Firestore `PbrMaterialTextures` from the form URL fields, or null when
 * no albedo is present (albedo is mandatory — without it there is no textured
 * material). In create mode the URLs are empty (maps are staged) so this returns
 * null; the panel uploads + patches the textures after the doc exists.
 */
function buildPbrTextures(form: FormState): PbrMaterialTextures | null {
  if (!form.albedoUrl) return null;
  const tile = Number(form.tileSizeM);
  return {
    albedoUrl: form.albedoUrl,
    normalUrl: form.normalUrl || null,
    roughnessUrl: form.roughnessUrl || null,
    aoUrl: form.aoUrl || null,
    tileSizeM: tile > 0 ? tile : 1,
  };
}

/** Maps an upload-service error to its i18n key under `thumbnail.errors`. */
export function thumbnailErrorKey(err: unknown): string {
  const code: MaterialThumbnailUploadErrorCode | 'uploadFailed' =
    err instanceof MaterialThumbnailUploadError ? err.code : 'uploadFailed';
  switch (code) {
    case 'format': return 'thumbnail.errors.format';
    case 'size': return 'thumbnail.errors.size';
    default: return 'thumbnail.errors.uploadFailed';
  }
}

export function validate(form: FormState, t: (k: string) => string): string | null {
  if (!form.nameEl.trim() || !form.nameEn.trim()) return t('validation.nameRequired');
  if (!form.atoeCategory.trim()) return t('validation.atoeCategoryRequired');
  if (form.density && (isNaN(Number(form.density)) || Number(form.density) <= 0)) {
    return t('validation.densityPositive');
  }
  return null;
}

function toNumber(s: string): number | undefined {
  const n = parseFloat(s);
  return isNaN(n) ? undefined : n;
}

export function buildSaveInput(form: FormState): SaveBimMaterialInput {
  return {
    scope: form.scope,
    nameEl: form.nameEl.trim(),
    nameEn: form.nameEn.trim(),
    category: form.category,
    atoeCategory: form.atoeCategory.trim(),
    defaultUnit: form.defaultUnit,
    fireRating: form.fireRating,
    ...(form.density ? { density: toNumber(form.density) } : {}),
    ...(form.defaultThickness ? { defaultThickness: toNumber(form.defaultThickness) } : {}),
    ...(form.atoeArticle.trim() ? { atoeArticle: form.atoeArticle.trim() } : {}),
    ...(form.defaultUnitCost ? { defaultUnitCost: toNumber(form.defaultUnitCost) } : {}),
    ...(form.brand.trim() ? { brand: form.brand.trim() } : {}),
    ...(form.brandModel.trim() ? { brandModel: form.brandModel.trim() } : {}),
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    ...(form.thumbnailUrl ? { thumbnailUrl: form.thumbnailUrl } : {}),
    ...(buildPbrTextures(form) ? { pbrTextures: buildPbrTextures(form)! } : {}),
    // ADR-687 Φ1 — every new material carries an explicit appearance.
    appearance: buildAppearance(form),
  };
}

export function buildUpdatePatch(form: FormState): UpdateBimMaterialPatch {
  return {
    nameEl: form.nameEl.trim(),
    nameEn: form.nameEn.trim(),
    category: form.category,
    atoeCategory: form.atoeCategory.trim(),
    defaultUnit: form.defaultUnit,
    fireRating: form.fireRating,
    density: toNumber(form.density),
    defaultThickness: toNumber(form.defaultThickness),
    atoeArticle: form.atoeArticle.trim() || undefined,
    defaultUnitCost: toNumber(form.defaultUnitCost),
    brand: form.brand.trim() || undefined,
    brandModel: form.brandModel.trim() || undefined,
    notes: form.notes.trim() || undefined,
    // Empty → null removes the uploaded image (back to albedo fallback).
    thumbnailUrl: form.thumbnailUrl || null,
    // Empty albedo → null removes the whole texture set (back to flat by category).
    pbrTextures: buildPbrTextures(form),
    // ADR-687 Φ1 — persist the edited appearance (never undefined → Firestore-safe).
    appearance: buildAppearance(form),
  };
}
